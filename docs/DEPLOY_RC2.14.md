# SEEFOOD RC2.14 — deployment sequence

Current production health observed before this release:
- Worker: RC2.11
- D1: connected
- LINE settings were added in Cloudflare, but the running RC2.11 health still showed `REQUIRED_NOT_CONFIGURED`; RC2.14 pins the public channel ID in `wrangler.jsonc` and expects the existing encrypted `SESSION_SECRET`.
- Partner rule health showed `MISMATCH:PARTNER-1.0-SERVICE-FEE-ONLY`, so migration 0001 is still required.

## Do this in order

1. Back up the remote D1 database (`seefood-staging`).
2. In D1 Console, run `migrations/APPLY_BEFORE_RC2.14.sql` once.
3. Confirm the SQL finishes without an error.
4. Deploy the RC2.14 Worker/assets package to the existing `seefood` Worker (do not create a second Worker).
5. Open `/api/health` and confirm:
   - `release = 3.0-RC2.14.0-D1-MAIN-CANDIDATE`
   - `lineSession = ENFORCED`
   - `partnerRule = CURRENT`
   - `plusBilling = CURRENT`
6. Test LINE login, merchant dashboard, Radar → 前往獵場, and one non-financial merchant action before testing payments.

Do not paste or commit the real `SESSION_SECRET` anywhere; the existing Cloudflare encrypted secret should be reused.
