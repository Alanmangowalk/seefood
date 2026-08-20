# SEEFOOD — Cloudflare LINE Login setup

For the production Worker `seefood`:

1. Cloudflare Dashboard → Workers & Pages → `seefood` → Settings → Variables and Secrets.
2. Production `LINE_LOGIN_CHANNEL_ID` is `2010392646` (the channel that owns LIFF `2010392646-KEEBg8gS`). RC2.14 also pins this public ID in `wrangler.jsonc` as a normal variable.
3. Add `SESSION_SECRET` as an encrypted secret. Generate a long random value (at least 32 random bytes). Do not reuse an ECPay/Google/LINE channel secret, do not commit it to GitHub, and do not send it in chat.
4. Save/deploy the settings.
5. Open `/api/health`; `readiness.lineSession` must read `ENFORCED`.
6. Reopen the normal SEEFOOD URL inside LINE and test login.

If `readiness.lineSession` remains `REQUIRED_NOT_CONFIGURED`, one of the two settings is missing from the active production Worker/environment.
