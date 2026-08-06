# Prioritized Release Checklist

Use this checklist as the final gate before public launch.

## P0 - Must Be Done Before Launch

- [x] Run a new production EAS build successfully after the `scripts/patch-expo-router.mjs` fix.
- [x] Install the release APK on a real Android device and complete a smoke test:
- [x] Verify login, logout, session restore, onboarding, and app relaunch.
- [x] Verify core flows for accounts, movements, debts, categories, and Gmail screens.
- [x] Verify the reports tab loads correctly with real user data.
- [x] Verify PDF export, Excel export, and share flows on-device.
- [x] Verify deep linking still works correctly after the Expo Router patch.
- [x] Confirm `GET /api/reports/financial` returns consistent data for real filters and accounts.
- [x] Confirm the canonical reports DTO still matches the mobile report view, PDF, and Excel outputs.
- [x] Verify the first scheduled `fint-gmail-watch-renewal` run using `docs/monitoring-setup.md`.
- [x] Finish Sentry acceptance checks for privacy, releases, source maps, uptime, alert email delivery, and owner response process. Follow `docs/mvp-sentry-legal-play-store-plan.md`.
- [x] Confirm all production secrets and environment variables are correct in EAS, Render, Supabase, and the mobile app.
- [x] Host the final privacy policy and terms on public HTTPS URLs.
- [x] Confirm the final legal operator data is present in public legal documents.
- [ ] Confirm the final app name is legally and commercially available before public submission.
- [x] Send and receive a support test message at `support@myfint.app` to confirm operational monitoring through Email Routing to `soporte.fint@gmail.com`.

## P1 - Strongly Recommended Before Launch

- [ ] Complete a closed-test release in Play Console and review feedback for blockers.
- [x] Prepare final Play Store assets:
- [x] Listing copy and screenshot plan prepared. See `docs/play-store-listing.md`.
- [ ] App name.
- [x] Short description.
- [x] Screenshots.
- [x] App icon `assets/images/fint-app-icon-512.png` (512x512).
- [x] Feature graphic `assets/images/fint-feature-graphic-1024x500.png` (1024x500).
- [x] Privacy policy URL.
- [x] Terms URL.
- [x] Content rating: `Apto para todos`.
- [x] Ads declaration: no ads.
- [x] Target audience prepared: `13-15`, `16-17` and `18+`.
- [ ] Run a focused visual QA pass for ocean-blue branding consistency across login, tabs, reports, and empty states.
- [ ] Review loading, empty, offline, timeout, and error states across core screens.
- [x] Add or confirm mobile tests for account, movement, and debt mutation flows. See `tests/unit/finance-mutations.test.ts`.
- [ ] Check API logs for slow queries, repeated failures, and timeout patterns under realistic usage.
- [ ] Measure first request latency after Render cold start and document acceptable baseline.
- [ ] Confirm release monitoring coverage for mobile errors, API errors, cron failures, and export failures.
- [x] Define a rollback and incident-response path for the first public release. See `docs/release-runbook.md`.

## P2 - Good Improvements If Time Allows

- [ ] Finalize replacement of temporary brand elements: app name, icon, and splash.
- [x] Create a repeatable release runbook with exact commands, owners, and sign-off steps. See `docs/release-runbook.md`.
- [x] Add a small post-launch support checklist for issue triage and user response. See `docs/post-launch-support-checklist.md`.
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
