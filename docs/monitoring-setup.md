# Monitoring Setup

## Verify Supabase Cron

The Gmail renewal job runs at minute `0` every 12 hours. After its next scheduled execution, run this in Supabase SQL Editor:

```sql
select start_time, end_time, status, return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'fint-gmail-watch-renewal')
order by start_time desc
limit 5;
```

Then verify the HTTP result:

```sql
select status_code, content, error_msg, created
from net._http_response
order by created desc
limit 5;
```

The expected result is `status_code = 200` and `failed = 0` in the response content.

## Optional Operations Webhook

1. Create an incoming webhook in Slack, Discord, or another compatible operations channel.
2. In Render, set `OPS_ALERT_WEBHOOK_URL` to the webhook URL.
3. Redeploy the API.
4. A Gmail token rejection sends `gmail_reconnect_required`; other renewal failures send `gmail_watch_renewal_failed`.

## Sentry For Mobile

1. Create a React Native project at [Sentry](https://sentry.io).
2. Add `@sentry/react-native` following Sentry's Expo setup guide.
3. Store the DSN in an EAS secret, not in source code.
4. Initialize Sentry in the root layout with release and environment metadata.
5. Build a preview APK and trigger a controlled test exception to confirm capture.

Sentry is configured without a placeholder DSN. It remains disabled in local environments that do not define `EXPO_PUBLIC_SENTRY_DSN`.

Mobile EAS environments use `EXPO_PUBLIC_SENTRY_DSN` and `EXPO_PUBLIC_SENTRY_ENVIRONMENT`. Configure `EXPO_PUBLIC_SENTRY_ENVIRONMENT=preview` for preview and `EXPO_PUBLIC_SENTRY_ENVIRONMENT=production` for production. The DSN is public by design; `SENTRY_AUTH_TOKEN` must remain an EAS secret and is used only for source-map uploads.
