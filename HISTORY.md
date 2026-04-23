# 2.0.0 / 2026 (Nehonix fork)

- Full rewrite in strict TypeScript
- Multi-listener support via internal FIFO queue
- Improved input validation (`instanceof ServerResponse` check)
- Listeners are isolated: an error in one does not prevent others from running
- Null/undefined header values are silently skipped to prevent invalid header writes
- Inherits all fixes from upstream `1.1.0` (CVE-2025-7339)

  # 1.1.0 / 2025-07-17
  - Fix [CVE-2025-7339](https://www.cve.org/CVERecord?id=CVE-2025-7339) ([GHSA-76c9-3jph-rj3q](https://github.com/jshttp/on-headers/security/advisories/GHSA-76c9-3jph-rj3q))

  # 1.0.2 / 2019-02-21
  - Fix `res.writeHead` patch missing return value

  # 1.0.1 / 2015-09-29
  - perf: enable strict mode

  # 1.0.0 / 2014-08-10
  - Honor `res.statusCode` change in `listener`
  - Move to `jshttp` organization
  - Prevent `arguments`-related de-opt

  # 0.0.0 / 2014-05-13
  - Initial implementation
