/*!
 * xypriss-on-headers
 * Copyright(c) 2014 Douglas Christopher Wilson
 * Copyright(c) 2026 Nehonix Team
 * MIT Licensed
 */

import { ServerResponse, OutgoingHttpHeaders } from "http";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A listener called just before `writeHead` writes headers to the client.
 * `this` is bound to the `ServerResponse` instance so you can read/write
 * headers directly (e.g. `this.setHeader(...)`).
 *
 * @this {ServerResponse}
 */
export type OnHeadersListener = (this: ServerResponse) => void;

/**
 * Internal shape of a patched `ServerResponse` that carries the listener
 * queue used by `onHeaders`.
 *
 * @internal
 */
interface PatchedResponse extends ServerResponse {
  /** Ordered list of listeners registered via `onHeaders`. */
  __onHeadersListeners?: OnHeadersListener[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Register a listener that fires **once**, immediately before the HTTP
 * response flushes its headers to the client.
 *
 * Multiple calls on the same `res` are safe: listeners are queued and
 * executed in registration order.  Each listener runs at most one time,
 * even if `writeHead` is called more than once.
 *
 * @example
 * ```ts
 * import http      from "http";
 * import onHeaders from "xypriss-on-headers";
 *
 * http.createServer((req, res) => {
 *   onHeaders(res, function () {
 *     this.setHeader("X-Powered-By", "XyPriss-Engine");
 *   });
 *
 *   res.statusCode = 200;
 *   res.end("OK");
 * }).listen(3000);
 * ```
 *
 * @param res      - The active `ServerResponse` to observe.
 * @param listener - Callback executed before headers are written.
 *                   Receives no arguments; `this` is bound to `res`.
 *
 * @throws {TypeError} If `res` is falsy or not a `ServerResponse`.
 * @throws {TypeError} If `listener` is not a function.
 *
 * @public
 */
export default function onHeaders(
  res: ServerResponse,
  listener: OnHeadersListener,
): void {
  // ── Input validation ──────────────────────────────────────────────────────

  if (!res) {
    throw new TypeError("argument res is required");
  }

  if (!(res instanceof ServerResponse)) {
    throw new TypeError("argument res must be an instance of ServerResponse");
  }

  if (typeof listener !== "function") {
    throw new TypeError("argument listener must be a function");
  }

  // ── Patch writeHead once; subsequent calls just push to the queue ─────────

  const patched = res as PatchedResponse;

  if (!patched.__onHeadersListeners) {
    patched.__onHeadersListeners = [];
    patched.writeHead = createWriteHead(patched.writeHead, patched);
  }

  patched.__onHeadersListeners.push(listener);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Wrap the original `writeHead` so that all registered listeners are fired
 * exactly once before the real implementation runs.
 *
 * @param prevWriteHead - The original (or previously wrapped) `writeHead`.
 * @param res           - The response instance whose listener queue to drain.
 * @returns A replacement `writeHead` bound to the same response.
 *
 * @internal
 */
function createWriteHead(
  prevWriteHead: ServerResponse["writeHead"],
  res: PatchedResponse,
): ServerResponse["writeHead"] {
  let fired = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function writeHead(
    this: ServerResponse,
    statusCode: number,
    ...rest: any[]
  ) {
    // Normalise arguments (handle optional reason + headers overloads).
    const args = setWriteHeadHeaders.apply(this, [statusCode, ...rest] as any);

    if (!fired) {
      fired = true;
      drainListeners(res);

      // If a listener changed `this.statusCode`, propagate it back.
      if (typeof args[0] === "number" && this.statusCode !== args[0]) {
        args[0] = this.statusCode;
        args.length = 1;
      }
    }

    return (prevWriteHead as Function).apply(this, args);
  } as ServerResponse["writeHead"];
}

/**
 * Execute every registered listener in FIFO order, then clear the queue.
 * Errors thrown by individual listeners are caught and re-thrown after all
 * others have had a chance to run.
 *
 * @param res - The patched response whose listener queue to drain.
 *
 * @internal
 */
function drainListeners(res: PatchedResponse): void {
  const listeners = res.__onHeadersListeners;
  if (!listeners || listeners.length === 0) return;

  // Clear early so a listener can safely call onHeaders again for a *new*
  // response cycle without interfering with the current flush.
  res.__onHeadersListeners = [];

  const errors: unknown[] = [];

  for (const fn of listeners) {
    try {
      fn.call(res);
    } catch (err) {
      errors.push(err);
    }
  }

  // Surface the first error (subsequent ones are lost, but at least we
  // don't silently swallow the primary failure).
  if (errors.length > 0) {
    throw errors[0];
  }
}

/**
 * Apply any headers included in a `writeHead(statusCode[, reason][, headers])`
 * call to the response object and return a normalised argument list.
 *
 * Supported `writeHead` overloads:
 * - `writeHead(statusCode)`
 * - `writeHead(statusCode, headers)`
 * - `writeHead(statusCode, reason, headers)`
 *
 * @param statusCode - HTTP status code (e.g. `200`, `404`).
 * @param rest       - Optional reason string and/or headers object/array.
 * @returns Normalised argument array to forward to the original `writeHead`.
 *
 * @internal
 */
function setWriteHeadHeaders(
  this: ServerResponse,
  statusCode: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...rest: any[]
): any[] {
  // Determine where headers live in the argument list.
  const hasReasonString = rest.length > 0 && typeof rest[0] === "string";
  const headerIndex = hasReasonString ? 1 : 0;
  const headers: OutgoingHttpHeaders | readonly [string, string][] | undefined =
    rest.length > headerIndex ? rest[headerIndex] : undefined;

  this.statusCode = statusCode;

  if (Array.isArray(headers)) {
    setHeadersFromArray(this, headers as any[]);
  } else if (headers !== null && typeof headers === "object") {
    setHeadersFromObject(this, headers as OutgoingHttpHeaders);
  }

  // Return only the leading arguments (status code + optional reason string);
  // headers have already been applied via setHeader so we drop them.
  return [statusCode, ...rest.slice(0, headerIndex)];
}

/**
 * Apply an **array-encoded** header list to the response.
 *
 * Accepts two formats:
 * - **2-D** (`[string, string][]`): `[["key", "value"], ...]` — each inner
 *   array is a `[name, value]` pair.
 * - **1-D flat** (`string[]`): `["key1", "val1", "key2", "val2", ...]` — name
 *   and value are interleaved.  Uses `appendHeader` when available so that
 *   multiple values for the same header name are preserved.
 *
 * @param res     - Response to mutate.
 * @param headers - Array-encoded headers.
 *
 * @throws {TypeError} If the flat (1-D) array has an odd length.
 *
 * @internal
 */
function setHeadersFromArray(res: ServerResponse, headers: any[]): void {
  if (headers.length === 0) return;

  if (Array.isArray(headers[0])) {
    // ── 2-D format ─────────────────────────────────────────────────────────
    for (const pair of headers) {
      const key = pair[0];
      if (key) res.setHeader(key, pair[1]);
    }
  } else {
    // ── 1-D flat format ────────────────────────────────────────────────────
    if (headers.length % 2 !== 0) {
      throw new TypeError(
        `headers array must contain an even number of elements (name/value pairs); got ${headers.length}`,
      );
    }

    const supportsAppend = typeof (res as any).appendHeader === "function";

    if (supportsAppend) {
      // Remove existing values first, then append to preserve duplicates.
      for (let i = 0; i < headers.length; i += 2) {
        if (headers[i]) res.removeHeader(headers[i]);
      }
      for (let i = 0; i < headers.length; i += 2) {
        const key = headers[i];
        if (key) (res as any).appendHeader(key, headers[i + 1]);
      }
    } else {
      // Fallback: plain setHeader (last write wins for duplicate names).
      for (let i = 0; i < headers.length; i += 2) {
        const key = headers[i];
        if (key) res.setHeader(key, headers[i + 1]);
      }
    }
  }
}

/**
 * Apply an **object-encoded** header map to the response.
 *
 * Each own-enumerable key whose value is non-nullish is written via
 * `setHeader`, overwriting any previously set value for that name.
 *
 * @param res     - Response to mutate.
 * @param headers - Plain object mapping header names to their values.
 *
 * @internal
 */
function setHeadersFromObject(
  res: ServerResponse,
  headers: OutgoingHttpHeaders,
): void {
  for (const key of Object.keys(headers)) {
    const value = headers[key];
    if (key && value !== undefined && value !== null) {
      res.setHeader(key, value as string | string[] | number);
    }
  }
}
