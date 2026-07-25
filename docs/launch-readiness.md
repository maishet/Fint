# Launch Readiness

## Completed

- Android preview validated for startup, email authentication, session persistence, onboarding, core finance flows, and back navigation inside sheets.
- API requests now time out after 30 seconds and return actionable network and rate-limit errors.
- Core loading-error states offer an explicit retry action.
- API responses include an `X-Request-Id`; request and unhandled-error events are logged as structured JSON.
- API applies an in-memory per-client rate limit. Configure `API_RATE_LIMIT_PER_MINUTE` in Render for the production threshold.
- Mobile unit tests cover auth routing and actionable API error mapping.
- API includes a reproducible authenticated performance script and a Supabase Cron migration for Gmail watch renewal.
- Gmail sources whose Google refresh token is rejected are marked as requiring reconnection and expose a mobile recovery action.
- Reusable actions now block duplicate presses; Gmail sync shows progress and completion feedback.
- Sentry is integrated for mobile and API with PII and request-body collection disabled; alert rules are intentionally not configured yet.

## Remaining Before Public Launch

- Configure the Supabase Vault secrets and apply `20260723041844_gmail_watch_renewal.sql`, then verify the first Gmail watch renewal run. Render only needs `INTERNAL_CRON_SECRET`; `OPS_ALERT_WEBHOOK_URL` remains optional.
- Verify the first scheduled Supabase Cron run using the queries in `docs/monitoring-setup.md`.
- Add `EXPO_PUBLIC_SENTRY_ENVIRONMENT` to EAS preview and production, then validate the next Sentry-enabled APK and deployed API events.
- Measure the first request after Render sleeps; the warm authenticated baseline is documented in the API operations runbook.
- Verify managed backup retention and perform a restore drill in a separate Supabase project.
- Host completed privacy policy and terms on HTTPS URLs, then complete a Play closed-test release.
- Add mobile tests for account, movement, and debt mutation flows.
