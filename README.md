# XyPriss Header Interception (xypriss-on-headers)

> [!NOTE]
> **Internalized Fork**: This module is a strictly typed TypeScript port of the original `on-headers` library. It has been internalized into the XyPriss ecosystem to reduce external dependency surfaces and ensure architectural consistency within XyPriss framework plugins.

## Overview

The `xypriss-on-headers` module provides a robust mechanism to execute a listener function precisely before an HTTP response begins writing its headers to the client. This is essential for middleware that needs to modify headers based on the final state of the response, such as compression filters or security policy enforcers.

## Installation

This module is distributed and managed via the XyPriss Package Manager.

```sh
xfpm install xypriss-on-headers
```

## Usage

Integrate the interception logic using ESM syntax.

```typescript
import http from "http";
import onHeaders from "xypriss-on-headers";

http
  .createServer((req, res) => {
    onHeaders(res, function () {
      // This function executes just before writeHead is called
      this.setHeader("X-Powered-By", "XyPriss-Engine");
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain");
    res.end("Operational");
  })
  .listen(3000);
```

## Technical Implementation

- **Strict TypeScript Port**: Built from the ground up utilizing native TypeScript for optimal IDE support and compile-time safety.
- **Compatibility Bridge**: Maintains one-to-one behavioral parity with standard Node.js `http.ServerResponse.prototype.writeHead` interceptors.
- **Performance Optimized**: Eliminates unnecessary legacy object cloning and utilizes direct stack references for minimal overhead during high-concurrency event cycles.

## License Declarations

Copyright © 2014 Douglas Christopher Wilson  
Copyright © 2026 Nehonix Team  
Released under the MIT License.
