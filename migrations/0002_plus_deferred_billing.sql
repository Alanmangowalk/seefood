PRAGMA foreign_keys=ON;

-- SEEFOOD Plus deferred billing (無痛升級)
-- Product rule confirmed 2026-08-20:
-- 1) Plus is activated immediately for 30 days with no upfront payment.
-- 2) The $299 charge starts collecting from the next merchant payout that is actually payable.
-- 3) If payout is insufficient, collect only what is available and carry the remainder forward.
-- 4) Plus entitlement still lasts the full 30 days regardless of collection progress.
-- 5) Outstanding Plus debt is never externally chased, but blocks a new Plus activation until fully collected.
-- 6) This migration intentionally does NOT backfill historical subscriptions into debt.

CREATE TABLE IF NOT EXISTS plus_billing_charges (
  charge_id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL UNIQUE,
  shop_id TEXT NOT NULL,
  charge_type TEXT NOT NULL DEFAULT 'PLUS_MONTHLY'
    CHECK (charge_type = 'PLUS_MONTHLY'),
  amount_due INTEGER NOT NULL DEFAULT 299 CHECK (amount_due >= 0),
  amount_collected INTEGER NOT NULL DEFAULT 0 CHECK (amount_collected >= 0),
  amount_outstanding INTEGER NOT NULL DEFAULT 299 CHECK (amount_outstanding >= 0),
  currency TEXT NOT NULL DEFAULT 'TWD',
  status TEXT NOT NULL DEFAULT 'OUTSTANDING'
    CHECK (status IN ('OUTSTANDING','PARTIALLY_COLLECTED','SETTLED','WAIVED')),
  eligible_from TEXT NOT NULL,
  settled_at TEXT,
  waived_at TEXT,
  waive_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_id) REFERENCES plus_subscriptions(subscription_id) ON DELETE RESTRICT,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE RESTRICT,
  CHECK (amount_collected + amount_outstanding = amount_due)
);

CREATE TABLE IF NOT EXISTS plus_billing_collections (
  collection_id TEXT PRIMARY KEY,
  charge_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  settlement_batch_id TEXT NOT NULL,
  settlement_period TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  source TEXT NOT NULL DEFAULT 'MERCHANT_SETTLEMENT'
    CHECK (source = 'MERCHANT_SETTLEMENT'),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (charge_id) REFERENCES plus_billing_charges(charge_id) ON DELETE RESTRICT,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE RESTRICT,
  FOREIGN KEY (settlement_batch_id) REFERENCES merchant_settlement_batches(batch_id) ON DELETE RESTRICT,
  UNIQUE (charge_id, settlement_batch_id)
);

CREATE INDEX IF NOT EXISTS idx_plus_billing_charges_shop_open
ON plus_billing_charges(shop_id, status, eligible_from, created_at);

CREATE INDEX IF NOT EXISTS idx_plus_billing_collections_batch
ON plus_billing_collections(settlement_batch_id, charge_id);

INSERT OR IGNORE INTO schema_versions(version, description)
VALUES(
  '3.1.3-PLUS-DEFERRED-BILLING',
  'Plus $299 deferred billing: full 30-day entitlement, next-payable collection, partial carry-over, re-upgrade block while outstanding; no historical debt backfill'
);
