# SMART TIME v8.3.14 — Authentication Review/Fix

## What was corrected

1. **Login is explicitly a login screen**
   - Login supports three methods:
     - Email + password
     - Username + password
     - Phone + SMS OTP
   - The old misleading tab label "البريد الإلكتروني" is no longer the main login tab.

2. **Username is stored in SQLite**
   - `users.username` was added with a unique index.
   - Registration requires a username.
   - Existing email-only accounts remain usable by email until they have a username.

3. **Email registration persists correctly**
   - Registration writes `email`, `username`, password hash, name and phone to `users`.
   - Phone verification is still required before the 3-trip-search welcome gift is granted.

4. **Existing email accounts and the trip gift**
   - If an existing account logs in by email and tries to open Trips while the phone is not verified, the app sends the user to the phone verification flow.
   - Successful verification grants 3 free trip searches when the phone has not already claimed the gift.

5. **Password reset no longer lies about email delivery**
   - The server only returns `emailSent: true` after the configured mail provider accepts the message.
   - If mail is not configured, the UI shows an error instead of saying "تم الإرسال".
   - Real email delivery supports Resend through the existing Node `fetch` API.
   - Local development can optionally use `ALLOW_DEV_EMAIL_CODE=true` to display a development code, but this is disabled by default.

## Required server environment for real password-reset email

Set these on the server/Railway:

- `EMAIL_PROVIDER=resend`
- `EMAIL_FROM=<verified sender address>`
- `RESEND_API_KEY=<secret>`
- `ALLOW_DEV_EMAIL_CODE=false`

No email secret is included in the project archive.
