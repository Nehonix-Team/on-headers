# XyPriss Header Interception — `xypriss-on-headers`

> [!NOTE]
> **Internalized Fork**: This module is a strictly typed TypeScript port of the original `on-headers` library. It has been internalized into the XyPriss ecosystem to reduce external dependency surfaces and ensure architectural consistency within XyPriss framework plugins.

---

## Overview

`xypriss-on-headers` lets you register one or more listeners that fire **once**, immediately before an HTTP response flushes its headers to the client. This is the foundation for middleware that needs to inspect or mutate headers based on the final response state — compression filters, security policy enforcers, timing injectors, etc.

---

## Installation

```sh
xfpm install xypriss-on-headers
```

---

## Usage

### Basic — single listener

```typescript
import http from "http";
import onHeaders from "xypriss-on-headers";

http
  .createServer((req, res) => {
    onHeaders(res, function () {
      // Runs once, just before writeHead flushes headers
      this.setHeader("X-Powered-By", "XyPriss-Engine");
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain");
    res.end("Operational");
  })
  .listen(3000);
```

### Multiple listeners on the same response

Multiple calls on the same `res` are safe. Listeners are queued and executed in **registration order** (FIFO).

```typescript
onHeaders(res, function () {
  this.setHeader("X-Request-Id", generateId());
});

onHeaders(res, function () {
  this.setHeader("X-Response-Time", `${Date.now() - start}ms`);
});
```

### Modifying the status code inside a listener

If a listener changes `res.statusCode`, the new value is automatically forwarded to `writeHead`.

```typescript
onHeaders(res, function () {
  if (!this.getHeader("Content-Type")) {
    this.statusCode = 500;
  }
});
```

---

## API

### `onHeaders(res, listener)`

| Parameter  | Type                | Description                                                             |
| ---------- | ------------------- | ----------------------------------------------------------------------- |
| `res`      | `ServerResponse`    | The active HTTP response to observe.                                    |
| `listener` | `OnHeadersListener` | Callback executed before headers are written. `this` is bound to `res`. |

**Returns** `void`.

**Throws**

- `TypeError` — if `res` is falsy or not a `ServerResponse` instance.
- `TypeError` — if `listener` is not a function.

---

### `OnHeadersListener` _(exported type)_

```typescript
type OnHeadersListener = (this: ServerResponse) => void;
```

Use this type when building middleware that accepts or forwards listeners:

```typescript
import onHeaders, { OnHeadersListener } from "xypriss-on-headers";

function applySecurityHeaders(res: ServerResponse, extra?: OnHeadersListener) {
  onHeaders(res, function () {
    this.setHeader("X-Content-Type-Options", "nosniff");
    extra?.call(this);
  });
}
```

---

## Error Handling

If a listener throws, the error is **re-thrown after all other listeners have run** — no listener silently suppresses a failure in another.

```typescript
onHeaders(res, function () {
  throw new Error("something went wrong");
});

onHeaders(res, function () {
  // This still runs even though the previous listener threw
  this.setHeader("X-Trace-Id", "abc123");
});
// → Error: something went wrong  (thrown after second listener completes)
```

---

## Technical Implementation

- **Strict TypeScript port** — built from the ground up with native TypeScript; no runtime dependencies.
- **Single patch, listener queue** — `writeHead` is patched only once per response; subsequent `onHeaders` calls push to an internal FIFO queue, avoiding redundant wrapping.
- **Behavioral parity** — fully compatible with all `writeHead` overloads: `(statusCode)`, `(statusCode, headers)`, and `(statusCode, reason, headers)`. Supports both 2-D and flat 1-D header arrays as well as plain header objects.
- **`appendHeader` awareness** — on Node.js versions that support it, flat header arrays use `appendHeader` to preserve duplicate header values.
- **CVE-2025-7339 patched** — see changelog below.

---

## Changelog

See [HISTORY.md](./HISTORY.md) for a detailed list of changes and security fixes.

---

## License

Copyright © 2014 Douglas Christopher Wilson  
Copyright © 2026 Nehonix Team  
Released under the [MIT License](./LICENSE).
