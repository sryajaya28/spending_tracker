# Security checklist (starter, owner to fill in real policy)

Every TDD and PR is reviewed against this list.

1. Authentication: how callers prove identity; token lifetime; rotation.
2. Authorization: checked on every endpoint; object-level access (no IDOR); deny by default.
3. Input validation at the boundary: schema, length, type; reject unknown fields.
4. Injection: parameterized queries only; no string-built SQL or shell.
5. Secrets: never in code, logs, docs, or client bundles; env vars and the secret manager only.
6. PII: classify every field; synthetic data in staging; no PII in logs.
7. Rate limiting and abuse cases per endpoint.
8. Audit logging for security-relevant actions.
9. Multi-tenant isolation, if applicable.
10. Dependencies: justified, licensed, maintained; secret and dependency scans green.
11. Errors: no stack traces or internals returned to callers.
12. Data retention and deletion defined.
