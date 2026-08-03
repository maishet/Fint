# Prioritized Release Checklist

Use this checklist as the final gate before public launch.

## P0 - Must Be Done Before Launch

- [x] Run a new production EAS build successfully after the `scripts/patch-expo-router.mjs` fix.
- [x] Install the release APK on a real Android device and complete a smoke test:
- [x] Verify login, logout, session restore, onboarding, and app relaunch.
- [x] Verify core flows for accounts, movements, debts, categories, and Gmail screens.
- [x] Verify the reports tab loads correctly with real user data.
- [x] Verify PDF export, CSV export, and share flows on-device.
- [x] Verify deep linking still works correctly after the Expo Router patch.
- [x] Confirm `GET /api/reports/financial` returns consistent data for real filters and accounts.
- [x] Confirm the canonical reports DTO still matches the mobile report view, PDF, and CSV outputs.
- [x] Verify the first scheduled `fint-gmail-watch-renewal` run using `docs/monitoring-setup.md`.
- [ ] Finish remaining Sentry acceptance checks: alert email receipt, owner/response process, and optional repeated mobile controlled event. Follow `docs/mvp-sentry-legal-play-store-plan.md`.
- [x] Confirm all production secrets and environment variables are correct in EAS, Render, Supabase, and the mobile app.
- [ ] Host the final privacy policy and terms on public HTTPS URLs.
- [ ] Confirm the final legal operator data is present in public legal documents.
- [ ] Confirm the final app name is legally and commercially available before public submission.
- [ ] Ensure support email is active and monitored.

## P1 - Strongly Recommended Before Launch

- [ ] Complete a closed-test release in Play Console and review feedback for blockers.
- [ ] Prepare final Play Store assets:
- [ ] App name.
- [ ] Short description.
- [ ] Screenshots.
- [ ] Privacy policy URL.
- [ ] Terms URL.
- [ ] Content rating and store metadata.
- [ ] Run a focused visual QA pass for ocean-blue branding consistency across login, tabs, reports, and empty states.
- [ ] Review loading, empty, offline, timeout, and error states across core screens.
- [ ] Add or confirm mobile tests for account, movement, and debt mutation flows.
- [ ] Check API logs for slow queries, repeated failures, and timeout patterns under realistic usage.
- [ ] Measure first request latency after Render cold start and document acceptable baseline.
- [ ] Confirm release monitoring coverage for mobile errors, API errors, cron failures, and export failures.
- [ ] Define a rollback and incident-response path for the first public release.

## P2 - Good Improvements If Time Allows

- [ ] Finalize replacement of temporary brand elements: app name, icon, and splash.
- [ ] Create a repeatable release runbook with exact commands, owners, and sign-off steps.
- [ ] Add a small post-launch support checklist for issue triage and user response.
- [ ] Expand regression coverage around reports, export edge cases, and Gmail reconnection flows.
- [ ] Validate degraded-network behavior on lower-end Android devices.
- [ ] Prepare App Store launch assets and requirements if iOS release is near.

## Suggested Launch Order

1. Production EAS build.
2. Real-device Android smoke test.
3. Reports export and deep link validation.
4. Cron verification.
5. Legal documents and support readiness.
6. Play Console closed test and listing review.
7. Public release decision.

## Related Docs

- `docs/launch-readiness.md`
- `docs/play-store-launch.md`
- `docs/monitoring-setup.md`
- `docs/mvp-sentry-legal-play-store-plan.md`
- `docs/brand-and-license-decision.md`
