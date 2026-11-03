# NFR checklist (starter, owner to set real numbers)

Every NFR in a PRD needs a number. Defaults below are placeholders, not decisions.

| Category | Question | Placeholder |
|---|---|---|
| Performance | p95 latency per endpoint | <300 ms |
| Availability | Monthly uptime target | 99.5 percent |
| Scalability | Peak requests per second | state expected, plus 10x headroom |
| Security | See security-checklist.md | all items addressed |
| Accessibility | Standard | WCAG 2.2 AA |
| Observability | Logs, metrics, traces, alerts with thresholds | defined per feature |
| Data retention | Retention and deletion periods | defined per data type |
| Compliance | Applicable regimes | owner to state |
| Cost | Monthly cost at expected scale | stated in TDD |
