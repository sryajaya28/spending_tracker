# API conventions (starter)

1. JSON over HTTPS. Versioned under /v1.
2. Errors: { "error": { "code": "<machine_code>", "message": "<plain text>", "request_id": "<id>" } } with correct HTTP status.
3. Mutating endpoints accept an Idempotency-Key header.
4. Lists are paginated with a cursor and a maximum page size.
5. Timestamps are ISO 8601 UTC.
6. Every request gets a request id, logged and returned.
7. Breaking changes need a new version and a TDD amendment.
8. Every API has a health endpoint at /health that reports build id.
