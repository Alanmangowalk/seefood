-- SEEFOOD forward-only D1 data migration.
-- Do not rerun the historical Step 2 / Step 3 migration files.

BEGIN TRANSACTION;

INSERT OR IGNORE INTO partner_rule_versions (
  rule_version,
  eligible_revenue_type,
  service_fee_rate_bps,
  plus_eligible,
  review_days,
  inactivity_days,
  effective_at,
  created_at
)
VALUES (
  'PARTNER-2.0-SERVICE-FEE-ONLY',
  'SERVICE_FEE_ONLY',
  5000,
  0,
  14,
  365,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Defensive cleanup in case an earlier Shadow candidate ever created a
-- commission before pickup redemption. Requested/paid entries are left for
-- manual audit rather than being changed automatically.
UPDATE partner_commission_ledger
SET
  status = 'VOID',
  voided_at = CURRENT_TIMESTAMP,
  void_reason = 'PRE_REDEEM_SHADOW_RECONCILIATION',
  updated_at = CURRENT_TIMESTAMP
WHERE status IN ('PENDING_REVIEW', 'AVAILABLE')
  AND order_id IN (
    SELECT order_id
    FROM orders
    WHERE status <> 'REDEEMED'
  );

INSERT OR IGNORE INTO schema_versions (version, description)
VALUES (
  '3.1.1-PARTNER-RULE-V2',
  'Partner v2 service-fee-only rule; commission begins after REDEEMED and excludes unresolved disputes'
);

INSERT OR IGNORE INTO schema_versions (version, description)
VALUES (
  '3.1.2-ADMIN-REFUND-14D',
  'Paid-order complaints are admin-only; refund approval window is 14 days; merchant settlement excludes refund review holds'
);

COMMIT;

SELECT
  (SELECT COUNT(*) FROM partner_rule_versions WHERE rule_version = 'PARTNER-2.0-SERVICE-FEE-ONLY') AS partner_v2_rule,
  (SELECT COUNT(*) FROM partner_commission_ledger WHERE void_reason = 'PRE_REDEEM_SHADOW_RECONCILIATION') AS reconciled_pre_redeem_entries,
  (SELECT COUNT(*) FROM schema_versions WHERE version = '3.1.2-ADMIN-REFUND-14D') AS refund_policy_marker;
