# Backend Observability Runbook

## Signals

- `GET /api/health` is the liveness probe. It must return HTTP 200 without contacting dependencies.
- `GET /api/ready` checks PostgreSQL, Redis, NATS, and upload storage. PostgreSQL and storage are required by default; configure `READINESS_REQUIRED_SERVICES` for the deployed topology.
- `GET /api/metrics` exports low-cardinality Prometheus text metrics. Production requires `METRICS_TOKEN` and `Authorization: Bearer <token>`.
- Every response carries `x-request-id`. JSON request logs contain timestamp, service, request ID, method, matched route pattern, status, and latency; they intentionally omit raw URLs, bodies, query strings, credentials, and user identifiers.

## Recommended alerts

| Alert | Condition | First response |
| --- | --- | --- |
| API unavailable | Health probe fails twice in 2 minutes | Check process/container state and the latest startup logs. Restart only after identifying crash or resource pressure. |
| Not ready | Readiness returns 503 for 2 minutes | Inspect `unavailableRequired`; validate PostgreSQL or storage before routing traffic. |
| Degraded dependencies | Readiness remains `degraded` for 5 minutes | Inspect Redis/NATS connectivity. Core HTTP traffic may continue, but cache/event behavior must be verified. |
| Elevated server errors | 5xx ratio exceeds 2% for 5 minutes | Group JSON logs by request ID and deploy version; stop rollout if correlated with the candidate. |
| High latency | p95 exceeds 1 second for 10 minutes | Check database saturation, downstream latency, and recent deploys. |
| Payment/webhook failures | Any sustained failure or signature error spike | Pause payment-affecting rollout, preserve event IDs, and reconcile with the provider before retrying. |
| Scheduled-job failure | Two consecutive escrow or matching-expiry failures | Disable duplicate runners, inspect database/NATS, and verify idempotency before replay. |

## Staging validation

1. Deploy the immutable candidate with a non-default JWT secret and metrics token.
2. Confirm health is `ok`, readiness is `ready` or an explicitly accepted `degraded`, and metrics require authentication.
3. Send a request with a known `x-request-id`; verify the same ID in the response and structured logs.
4. Generate one controlled 404 and verify request counters/logs without sensitive payloads.
5. In a maintenance window, make one optional dependency unavailable and confirm the degraded alert; restore it and resolve the alert.
6. Do not simulate required-dependency failure in production. Record timestamps, screenshots/log references, candidate SHA, and operator in the release evidence ledger.

## Rollback

- Stop promotion when readiness fails, 5xx/latency breaches the alert threshold, or any High/Critical security or payment defect appears.
- Route traffic back to the last known-good immutable artifact. Do not reverse a production migration without its separately reviewed rollback procedure.
- Verify health, readiness, metrics, three dashboard smoke flows, and payment/webhook processing after rollback.
