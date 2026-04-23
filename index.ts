/*!
 * on-headers
 * Copyright(c) 2014 Douglas Christopher Wilson
 * Copyright(c) 2026 Nehonix Team
 * MIT Licensed
 */

import { ServerResponse } from "http";

/**
 * Execute a listener when a response is about to write headers.
 *
 * @param {ServerResponse} res
 * @param {() => void} listener
 * @public
 */
export default function onHeaders(
  res: ServerResponse,
  listener: (this: ServerResponse) => void,
): void {
  if (!res) {
    throw new TypeError("argument res is required");
  }

  if (typeof listener !== "function") {
    throw new TypeError("argument listener must be a function");
  }

  res.writeHead = createWriteHead(res.writeHead, listener);
}

/**
 * Create a replacement writeHead method.
 *
 * @param {Function} prevWriteHead
 * @param {Function} listener
 * @private
 */
function createWriteHead(
  prevWriteHead: Function,
  listener: (this: ServerResponse) => void,
): any {
  let fired = false;

  return function writeHead(this: ServerResponse, statusCode: number) {
    // set headers from arguments
    const args = setWriteHeadHeaders.apply(this, arguments as any);

    // fire listener
    if (!fired) {
      fired = true;
      listener.call(this);

      // pass-along an updated status code
      if (typeof args[0] === "number" && this.statusCode !== args[0]) {
        args[0] = this.statusCode;
        args.length = 1;
      }
    }

    return prevWriteHead.apply(this, args);
  };
}

/**
 * Set headers and other properties on the response object.
 *
 * @param {number} statusCode
 * @private
 */
function setWriteHeadHeaders(this: ServerResponse, statusCode: number) {
  const length = arguments.length;
  const headerIndex = length > 1 && typeof arguments[1] === "string" ? 2 : 1;

  const headers =
    length >= headerIndex + 1 ? arguments[headerIndex] : undefined;

  this.statusCode = statusCode;

  if (Array.isArray(headers)) {
    // handle array case
    setHeadersFromArray(this, headers);
  } else if (headers) {
    // handle object case
    setHeadersFromObject(this, headers);
  }

  // copy leading arguments
  const args = new Array(Math.min(length, headerIndex));
  for (let i = 0; i < args.length; i++) {
    args[i] = arguments[i];
  }

  return args;
}

/**
 * Set headers contained in array on the response object.
 *
 * @param {ServerResponse} res
 * @param {any[]} headers
 * @private
 */
function setHeadersFromArray(res: ServerResponse, headers: any[]) {
  if (headers.length && Array.isArray(headers[0])) {
    // 2D
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i][0];
      if (key) res.setHeader(key, headers[i][1]);
    }
  } else {
    // 1D
    if (headers.length % 2 !== 0) {
      throw new TypeError("headers array is malformed");
    }

    // older node versions don't have appendHeader
    const isAppendHeaderSupported =
      typeof (res as any).appendHeader === "function";

    if (isAppendHeaderSupported) {
      for (let i = 0; i < headers.length; i += 2) {
        res.removeHeader(headers[i]);
      }
      for (let j = 0; j < headers.length; j += 2) {
        const key = headers[j];
        if (key) (res as any).appendHeader(key, headers[j + 1]);
      }
    } else {
      for (let i = 0; i < headers.length; i += 2) {
        const key = headers[i];
        if (key) res.setHeader(key, headers[i + 1]);
      }
    }
  }
}

/**
 * Set headers contained in object on the response object.
 *
 * @param {ServerResponse} res
 * @param {Record<string, any>} headers
 * @private
 */
function setHeadersFromObject(
  res: ServerResponse,
  headers: Record<string, any>,
) {
  const keys = Object.keys(headers);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k) res.setHeader(k, headers[k]);
  }
}
