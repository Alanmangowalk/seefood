# SEEFOOD RC2.14 D1 Main Candidate — Validation Report

Date: 2026-08-20
Release: `3.0-RC2.14.0-D1-MAIN-CANDIDATE`

## Result

Local code validation is PASS. Production deployment remains intentionally BLOCKED until the remote D1 migration and Cloudflare runtime requirements are confirmed.

### Passed

- Worker syntax
- Main-site routing contract: no GAS fallback, no `?d1=1`
- LINE server-session fail-closed behavior
- Frozen 45-table D1 contract + forward migrations to 47 tables
- Partner v2 service-fee-only flow
- REDEEMED-only 50% Partner commission + idempotency
- Admin-only refund policy and 14-day gate
- Plus recommendation +10 confined to Recommend sorting
- Plus identity marker independent of special frame
- Plus-only `<=5折` special frame contract
- Plus immediate full 30-day entitlement
- $299 deferred charge creation with no upfront payment
- Next-payable merchant settlement deduction
- Insufficient payout partial collection and carry-over
- Insufficient payout does not terminate the active Plus entitlement
- Re-upgrade blocked while Plus balance remains
- Re-upgrade restored after Plus balance reaches zero
- Settlement close idempotency foundation via unique period batch
- Plus billing collections linked to settlement batches
- No automatic historical Plus debt backfill in migration

### Not yet production-ready

- Remote D1 `0002_plus_deferred_billing.sql` not yet confirmed applied
- LINE settings are confirmed in Cloudflare service settings (`LINE_LOGIN_CHANNEL_ID=2010392646`; encrypted `SESSION_SECRET` present); `/api/health` must be rechecked after RC2.14 deploy
- R2 `DOCS` not yet confirmed
- `DATA_ENCRYPTION_KEY` not yet confirmed
- ECPay Worker secrets / environment not yet confirmed
- HQ admin authentication not yet confirmed
- HQ visual console not yet implemented

Historical Shadow validation remains under `archive/VALIDATION_REPORT_SHADOW_2026-08-19.md`.

## RC2.14 focused checks

- Radar `前往獵場` returns to canonical `/` with `targetShopId`.
- Main Home Feed narrows to the selected shop when `targetShopId` is present.
- Public header remains `3.0`; internal release is health-only.
- `LINE_LOGIN_CHANNEL_ID` is deployed as a normal var; `SESSION_SECRET` remains secret.
