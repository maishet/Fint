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
- EAS preview and production environments include the public Sentry environment value, and the new preview APK was generated and validated.
- The API Sentry changes and environment variables were deployed to Render.
- Gmail multi-account synchronization, confirmation, discard, deduplication, token revocation, and reconnection were validated end to end.
- The final APK smoke test covering installation, authentication, onboarding, core mutations, navigation, persistence, and relaunch passed.

## Remaining Before Public Launch

- Verify the first scheduled Supabase Cron run using the queries in `docs/monitoring-setup.md`.
- Measure the first request after Render sleeps; the warm authenticated baseline is documented in the API operations runbook.
- Host completed privacy policy and terms on HTTPS URLs, then complete a Play closed-test release.
- Add mobile tests for account, movement, and debt mutation flows.
- Implement the prioritized work in `docs/mvp-improvements-and-reports.md`.

## Explicitly Out Of Scope

- Managed backup verification and a restore drill are not part of the current MVP launch scope by product decision.
- Controlled Sentry event validation and alert-rule configuration are not public-launch gates by product decision.
