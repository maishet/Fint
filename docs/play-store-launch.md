# Play Store Launch Checklist

## Store Listing

- App name: Fint.
- Short description: track accounts, movements, and debts in one place.
- Prepare at least two phone screenshots showing dashboard, movement registration, and debts.
- Use the production Android application ID `com.fint.finanzasmobilev2`.
- Publish first through a closed testing track before production.

## Privacy Policy Draft

Fint stores financial records that users enter, including accounts, movements, categories, debts, and optional Gmail-derived pending movements. Gmail is read only after the user connects an account and only messages matching user-configured sender filters are considered. Fint never creates a financial movement from Gmail without user confirmation.

Authentication is handled by Supabase. Financial data is stored in Supabase and processed by the Fint API. OAuth tokens for Gmail are encrypted server-side and removed when the user disconnects Gmail.

The public policy must include the operator's legal name, support email, jurisdiction, effective date, deletion request process, and the final hosted policy URL before the Play Store submission.

## Terms Draft

Fint provides personal-finance organization tools and does not provide financial, banking, tax, or investment advice. Users are responsible for reviewing entries and decisions made from the information shown by the app. Gmail detection is a suggestion feature and requires user confirmation.

The public terms must include the operator's legal name, support email, jurisdiction, effective date, account termination process, acceptable use rules, and the final hosted terms URL before submission.

## Release Gate

- Google sign-in and Gmail multi-account flows pass on the release APK.
- Privacy policy and terms are hosted on public HTTPS URLs and added to Play Console.
- Support email is monitored.
- Closed-test feedback has no unresolved blocker.

## Public Legal URLs

Configure the final HTTPS addresses in EAS preview and production:

```text
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://<public-domain>/privacy
EXPO_PUBLIC_TERMS_URL=https://<public-domain>/terms
```

Recommended presentation, in order:

1. Responsive HTML pages under the official Fint domain, with a visible effective date, contact email and links between both documents.
2. A small static legal site deployed through a managed host such as Cloudflare Pages, Vercel or GitHub Pages while the official domain is prepared.
3. Public PDF files only as a temporary fallback. HTML is preferable for accessibility, mobile reading and Play Store review.

Do not publish the placeholder `fint.app` links unless that domain is owned, deployed and serving the final documents. The app shows a clear unavailable message when these environment variables are not configured.
