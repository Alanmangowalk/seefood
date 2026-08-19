-- TEST CONTRACT ONLY. DO NOT APPLY TO D1.
-- Final frozen Step2A-H schema used only to compile-check Worker SQL.

CREATE TABLE api_usage_logs (
  usage_id TEXT PRIMARY KEY,
  usage_date TEXT NOT NULL,
  user_id TEXT NOT NULL,
  api_name TEXT NOT NULL,
  query_hash TEXT,
  result_count INTEGER NOT NULL DEFAULT 0 CHECK (result_count >= 0),
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

CREATE TABLE audit_logs (
  audit_id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE banners (
  banner_id TEXT PRIMARY KEY,
  placement TEXT NOT NULL DEFAULT 'HOME',
  title TEXT NOT NULL,
  subtitle TEXT,
  kicker TEXT,
  cta_text TEXT,
  image_url TEXT,
  link_type TEXT,
  link_target TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','SCHEDULED','ARCHIVED')),
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE consents (
  consent_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  document_version TEXT NOT NULL,
  status TEXT NOT NULL,
  agreed_at TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

CREATE TABLE document_records (
  document_id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL
    CHECK (owner_type IN ('USER','MERCHANT_ACCOUNT','SHOP','PARTNER')),
  owner_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','REPLACED','REVOKED','DELETED')),
  storage_provider TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT,
  sha256 TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (storage_provider, storage_key)
);

CREATE TABLE identities (
  identity_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  kyc_status TEXT NOT NULL DEFAULT 'NOT_STARTED',
  legal_name TEXT,
  legal_id_hash TEXT,
  legal_id_last4 TEXT,
  verified_at TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

CREATE TABLE inventory_events (
  event_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  order_id TEXT,
  reservation_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'OPEN',
    'RESTOCK',
    'WITHDRAW',
    'RESERVE',
    'RESERVATION_RELEASE',
    'SALE_CONFIRMED',
    'MANUAL_CORRECTION',
    'AUTO_CLOSE',
    'MANUAL_CLOSE'
  )),
  quantity_delta INTEGER NOT NULL DEFAULT 0,
  quantity_after INTEGER NOT NULL DEFAULT 0 CHECK (quantity_after >= 0),
  reason TEXT,
  source TEXT,
  actor_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES shop_items(item_id) ON DELETE RESTRICT,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE RESTRICT,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL,
  FOREIGN KEY (reservation_id) REFERENCES inventory_reservations(reservation_id) ON DELETE SET NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE inventory_reservations (
  reservation_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'HELD'
    CHECK (status IN ('HELD','CONFIRMED','RELEASED','EXPIRED')),
  expires_at TEXT NOT NULL,
  confirmed_at TEXT,
  released_at TEXT,
  release_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES shop_items(item_id) ON DELETE RESTRICT,
  UNIQUE (order_id, item_id)
);

CREATE TABLE item_sale_sessions (
  session_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  pickup_cutoff TEXT,
  auto_close_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  closed_at TEXT,
  close_reason TEXT,
  opening_stock INTEGER NOT NULL DEFAULT 0 CHECK (opening_stock >= 0),
  latest_stock INTEGER NOT NULL DEFAULT 0 CHECK (latest_stock >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES shop_items(item_id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
);

CREATE TABLE knock_requests (
  knock_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  knock_date TEXT NOT NULL,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
  UNIQUE (user_id, shop_id, knock_date)
);

CREATE TABLE kyc_verifications (
  verification_id TEXT PRIMARY KEY,
  merchant_account_id TEXT NOT NULL,
  shop_id TEXT,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  risk_score INTEGER,
  image_quality_score INTEGER,
  signature_score INTEGER,
  id_format_score INTEGER,
  submitted_at TEXT,
  verified_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_account_id) REFERENCES merchant_accounts(account_id) ON DELETE RESTRICT,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

CREATE TABLE merchant_accounts (
  account_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  kyc_status TEXT NOT NULL DEFAULT 'NOT_STARTED',
  payout_status TEXT NOT NULL DEFAULT 'NOT_STARTED',
  signer_name TEXT,
  signer_id_last4 TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

CREATE TABLE merchant_contracts (
  contract_id TEXT PRIMARY KEY,
  merchant_account_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK (status IN ('PENDING_REVIEW','SIGNED','REJECTED','TERMINATED')),
  signer_name TEXT,
  signed_at TEXT,
  terminated_at TEXT,
  termination_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, signing_source TEXT, ip_hash TEXT, user_agent TEXT,
  FOREIGN KEY (merchant_account_id) REFERENCES merchant_accounts(account_id) ON DELETE RESTRICT,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE RESTRICT,
  UNIQUE (shop_id, contract_version)
);

CREATE TABLE merchant_payout_profiles (
  merchant_account_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (status IN ('NOT_STARTED','PENDING_REVIEW','VERIFIED','REJECTED','SUSPENDED')),
  bank_code TEXT,
  branch_code TEXT,
  account_holder TEXT,
  bank_account_last5 TEXT,
  bank_account_ciphertext TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_account_id) REFERENCES merchant_accounts(account_id) ON DELETE RESTRICT
);

CREATE TABLE merchant_settlement_batches (
  batch_id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  gross_sales INTEGER NOT NULL DEFAULT 0 CHECK (gross_sales >= 0),
  gateway_fees INTEGER NOT NULL DEFAULT 0 CHECK (gateway_fees >= 0),
  plus_fees INTEGER NOT NULL DEFAULT 0 CHECK (plus_fees >= 0),
  adjustments INTEGER NOT NULL DEFAULT 0,
  net_payout INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACCUMULATING'
    CHECK (status IN (
      'ACCUMULATING',
      'CLOSED',
      'RECONCILING',
      'READY_TO_PAY',
      'PAID',
      'ON_HOLD',
      'CANCELLED'
    )),
  closed_at TEXT,
  paid_at TEXT,
  external_reference TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE RESTRICT,
  UNIQUE (shop_id, period_start, period_end)
);

CREATE TABLE merchant_settlement_items (
  settlement_item_id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  item_type TEXT NOT NULL
    CHECK (item_type IN (
      'ORDER',
      'REFUND',
      'GATEWAY_FEE',
      'PLUS_FEE',
      'ADJUSTMENT',
      'DISPUTE_ADJUSTMENT'
    )),
  order_id TEXT,
  payment_id TEXT,
  amount INTEGER NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES merchant_settlement_batches(batch_id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT,
  FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE RESTRICT
);

CREATE TABLE notification_queue (
  queue_id TEXT PRIMARY KEY,
  notification_id TEXT,
  channel TEXT NOT NULL
    CHECK (channel IN ('LINE','EMAIL','IN_APP')),
  recipient TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','PROCESSING','SENT','RETRY','FAILED','CANCELLED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TEXT,
  last_error TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (notification_id) REFERENCES notifications(notification_id) ON DELETE CASCADE
);

CREATE TABLE notifications (
  notification_id TEXT PRIMARY KEY,
  audience_type TEXT NOT NULL
    CHECK (audience_type IN ('HUNTER','MERCHANT','PARTNER','SYSTEM')),
  user_id TEXT,
  shop_id TEXT,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  deep_link TEXT,
  status TEXT NOT NULL DEFAULT 'UNREAD'
    CHECK (status IN ('UNREAD','READ','ARCHIVED')),
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
);

CREATE TABLE order_disputes (
  dispute_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  opened_by_user_id TEXT,
  dispute_type TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN (
      'OPEN',
      'UNDER_REVIEW',
      'RESOLVED_NO_REFUND',
      'RESOLVED_REFUND',
      'REJECTED',
      'CANCELLED'
    )),
  resolution_note TEXT,
  resolved_by_user_id TEXT,
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT,
  FOREIGN KEY (opened_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE order_items (
  order_item_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  original_unit_price INTEGER NOT NULL DEFAULT 0 CHECK (original_unit_price >= 0),
  sale_unit_price INTEGER NOT NULL DEFAULT 0 CHECK (sale_unit_price >= 0),
  line_total INTEGER NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES shop_items(item_id) ON DELETE RESTRICT
);

CREATE TABLE order_status_events (
  event_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  actor_type TEXT,
  actor_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

CREATE TABLE orders (
  order_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PAYMENT_PENDING'
    CHECK (status IN (
      'PAYMENT_PENDING',
      'PAID',
      'REDEEMED',
      'PAYMENT_FAILED',
      'CANCELLED',
      'EXPIRED',
      'ABNORMAL_REVIEW',
      'DISPUTED',
      'REFUND_PENDING',
      'REFUNDED'
    )),
  subtotal INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  service_fee INTEGER NOT NULL DEFAULT 0 CHECK (service_fee >= 0),
  total_amount INTEGER NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'TWD',
  pickup_at TEXT,
  pickup_deadline TEXT,
  payment_hold_expires_at TEXT,
  paid_at TEXT,
  redeemed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE RESTRICT
);

CREATE TABLE partner_commission_ledger (
  entry_id TEXT PRIMARY KEY,
  relation_id TEXT NOT NULL,
  referrer_user_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  commission_source TEXT NOT NULL DEFAULT 'SERVICE_FEE'
    CHECK (commission_source = 'SERVICE_FEE'),
  service_fee_amount INTEGER NOT NULL
    CHECK (service_fee_amount >= 0),
  commission_rate_bps INTEGER NOT NULL
    CHECK (commission_rate_bps >= 0 AND commission_rate_bps <= 10000),
  commission_amount_x10000 INTEGER NOT NULL
    CHECK (commission_amount_x10000 >= 0),
  rule_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK (status IN (
      'PENDING_REVIEW',
      'AVAILABLE',
      'REQUESTED',
      'PAID',
      'VOID'
    )),
  review_until TEXT NOT NULL,
  available_at TEXT,
  voided_at TEXT,
  void_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (relation_id) REFERENCES referral_relations(relation_id) ON DELETE RESTRICT,
  FOREIGN KEY (referrer_user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE RESTRICT,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT,
  FOREIGN KEY (rule_version) REFERENCES partner_rule_versions(rule_version) ON DELETE RESTRICT,
  UNIQUE (relation_id, order_id, commission_source)
);

CREATE TABLE partner_contracts (
  contract_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NOT_SIGNED'
    CHECK (status IN ('NOT_SIGNED','PENDING','SIGNED','TERMINATED')),
  signed_at TEXT,
  terminated_at TEXT,
  termination_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, signed_name TEXT, signing_source TEXT, ip_hash TEXT, user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  UNIQUE (user_id, contract_version)
);

CREATE TABLE partner_payout_items (
  payout_request_id TEXT NOT NULL,
  commission_entry_id TEXT NOT NULL UNIQUE,
  amount_x10000 INTEGER NOT NULL CHECK (amount_x10000 >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (payout_request_id, commission_entry_id),
  FOREIGN KEY (payout_request_id) REFERENCES partner_payout_requests(payout_request_id) ON DELETE CASCADE,
  FOREIGN KEY (commission_entry_id) REFERENCES partner_commission_ledger(entry_id) ON DELETE RESTRICT
);

CREATE TABLE partner_payout_profiles (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (status IN ('NOT_STARTED','PENDING_REVIEW','VERIFIED','REJECTED','SUSPENDED')),
  bank_code TEXT,
  branch_code TEXT,
  account_holder TEXT,
  bank_account_last5 TEXT,
  bank_account_ciphertext TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

CREATE TABLE partner_payout_requests (
  payout_request_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  requested_amount INTEGER NOT NULL CHECK (requested_amount > 0),
  processing_fee INTEGER NOT NULL DEFAULT 0 CHECK (processing_fee >= 0),
  net_amount INTEGER NOT NULL CHECK (net_amount >= 0),
  status TEXT NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED','REVIEWING','APPROVED','PAID','REJECTED','CANCELLED')),
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  paid_at TEXT,
  external_reference TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

CREATE TABLE partner_profiles (
  user_id TEXT PRIMARY KEY,
  partner_status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (partner_status IN ('ACTIVE','DORMANT','SUSPENDED','TERMINATED')),
  last_qualifying_activity_at TEXT,
  dormant_at TEXT,
  reactivated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

CREATE TABLE partner_rule_versions (
  rule_version TEXT PRIMARY KEY,
  eligible_revenue_type TEXT NOT NULL DEFAULT 'SERVICE_FEE_ONLY'
    CHECK (eligible_revenue_type = 'SERVICE_FEE_ONLY'),
  service_fee_rate_bps INTEGER NOT NULL DEFAULT 5000
    CHECK (service_fee_rate_bps >= 0 AND service_fee_rate_bps <= 10000),
  plus_eligible INTEGER NOT NULL DEFAULT 0
    CHECK (plus_eligible = 0),
  review_days INTEGER NOT NULL DEFAULT 14
    CHECK (review_days >= 0),
  inactivity_days INTEGER NOT NULL DEFAULT 365
    CHECK (inactivity_days >= 1),
  effective_at TEXT NOT NULL,
  retired_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
  payment_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  merchant_trade_no TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'TWD',
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING',
      'PAID',
      'FAILED',
      'CANCELLED',
      'REFUND_PENDING',
      'REFUNDED',
      'ABNORMAL_REVIEW'
    )),
  provider_trade_no TEXT,
  callback_fingerprint TEXT,
  paid_at TEXT,
  failed_at TEXT,
  refunded_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT
);

CREATE TABLE plus_subscriptions (
  subscription_id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  plan_code TEXT NOT NULL DEFAULT 'PLUS',
  price_amount INTEGER NOT NULL DEFAULT 299 CHECK (price_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'TWD',
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','EXPIRED','CANCELLED','REFUNDED')),
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  source_order_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE RESTRICT
);

CREATE TABLE referral_relations (
  relation_id TEXT PRIMARY KEY,
  referrer_user_id TEXT NOT NULL,
  shop_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_IDENTITY_CHECK'
    CHECK (status IN (
      'PENDING_IDENTITY_CHECK',
      'ACTIVE',
      'DORMANT',
      'SELF_REFERRAL_BLOCKED',
      'SUSPENDED',
      'TERMINATED'
    )),
  binding_source TEXT,
  rule_version TEXT NOT NULL,
  bound_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_qualifying_activity_at TEXT,
  dormant_at TEXT,
  reactivated_at TEXT,
  terminated_at TEXT,
  termination_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE RESTRICT,
  FOREIGN KEY (rule_version) REFERENCES partner_rule_versions(rule_version) ON DELETE RESTRICT,
  CHECK (referrer_user_id <> owner_user_id)
);

CREATE TABLE refunds (
  refund_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  dispute_id TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING',
      'PROCESSING',
      'COMPLETED',
      'FAILED',
      'CANCELLED'
    )),
  provider_refund_no TEXT,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  failed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT,
  FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE RESTRICT,
  FOREIGN KEY (dispute_id) REFERENCES order_disputes(dispute_id) ON DELETE SET NULL
);

CREATE TABLE risk_alerts (
  alert_id TEXT PRIMARY KEY,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIUM'
    CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  user_id TEXT,
  shop_id TEXT,
  order_id TEXT,
  payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','REVIEWING','RESOLVED','DISMISSED')),
  summary TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  resolved_by_user_id TEXT,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL,
  FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE schema_versions (
  version TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE shop_business_profiles (
  shop_id TEXT PRIMARY KEY,
  merchant_type TEXT,
  responsible_name TEXT,
  responsible_phone TEXT,
  kyc_inherited INTEGER NOT NULL DEFAULT 0 CHECK (kyc_inherited IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, responsible_mode TEXT NOT NULL DEFAULT 'SAME'
  CHECK (responsible_mode IN ('SAME','OTHER')),
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
);

CREATE TABLE shop_items (
  item_id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  slot_index INTEGER NOT NULL,
  item_type TEXT,
  name TEXT NOT NULL,
  description TEXT,
  original_price INTEGER NOT NULL DEFAULT 0 CHECK (original_price >= 0),
  sale_price INTEGER NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  status TEXT NOT NULL DEFAULT 'OFF' CHECK (status IN ('ON','OFF','PENDING_REVIEW','DISABLED')),
  pickup_cutoff TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
  UNIQUE (shop_id, slot_index)
);

CREATE TABLE shop_members (
  relation_id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'OWNER',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  UNIQUE (shop_id, user_id, role)
);

CREATE TABLE shop_watchlist (
  watch_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','PAUSED','CANCELLED')),
  last_notified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,
  UNIQUE (user_id, shop_id)
);

CREATE TABLE shops (
  shop_id TEXT PRIMARY KEY,
  merchant_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  latitude REAL,
  longitude REAL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  risk_status TEXT NOT NULL DEFAULT 'CLEAR',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, city TEXT, district TEXT,
  FOREIGN KEY (merchant_account_id) REFERENCES merchant_accounts(account_id) ON DELETE RESTRICT
);

CREATE TABLE store_candidates (
  candidate_id TEXT PRIMARY KEY,
  google_place_id TEXT UNIQUE,
  name TEXT NOT NULL,
  formatted_address TEXT,
  latitude REAL,
  longitude REAL,
  city TEXT,
  district TEXT,
  status TEXT NOT NULL DEFAULT 'CANDIDATE'
    CHECK (status IN ('CANDIDATE','CONTACTING','JOINED','REJECTED','ARCHIVED')),
  recommend_count INTEGER NOT NULL DEFAULT 0 CHECK (recommend_count >= 0),
  joined_shop_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (joined_shop_id) REFERENCES shops(shop_id) ON DELETE SET NULL
);

CREATE TABLE store_recommendations (
  recommendation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (candidate_id) REFERENCES store_candidates(candidate_id) ON DELETE CASCADE,
  UNIQUE (user_id, candidate_id)
);

CREATE TABLE system_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'STRING'
    CHECK (value_type IN ('STRING','INTEGER','DECIMAL','BOOLEAN','JSON')),
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tickets (
  ticket_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','REDEEMED','EXPIRED','CANCELLED')),
  pickup_at TEXT,
  pickup_deadline TEXT NOT NULL,
  redeemed_at TEXT,
  redeemed_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE RESTRICT,
  FOREIGN KEY (redeemed_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  source TEXT,
  display_name TEXT,
  picture_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT
);

CREATE INDEX idx_api_usage_day_api
ON api_usage_logs(usage_date, api_name, status);

CREATE INDEX idx_api_usage_user_day
ON api_usage_logs(user_id, usage_date, api_name);

CREATE INDEX idx_audit_logs_actor_time
ON audit_logs(actor_type, actor_id, created_at);

CREATE INDEX idx_audit_logs_entity_time
ON audit_logs(entity_type, entity_id, created_at);

CREATE INDEX idx_banners_placement_status_order
ON banners(placement, status, sort_order);

CREATE UNIQUE INDEX idx_consents_one_version
ON consents(user_id, document_type, document_version);

CREATE INDEX idx_consents_user_type ON consents(user_id, document_type, status);

CREATE INDEX idx_disputes_order_status
ON order_disputes(order_id, status, opened_at);

CREATE INDEX idx_document_records_owner
ON document_records(owner_type, owner_id, document_type, status);

CREATE INDEX idx_identities_kyc ON identities(kyc_status);

CREATE INDEX idx_inventory_events_item_time
ON inventory_events(item_id, created_at);

CREATE INDEX idx_inventory_events_order
ON inventory_events(order_id, created_at);

CREATE INDEX idx_inventory_events_shop_time
ON inventory_events(shop_id, created_at);

CREATE INDEX idx_inventory_reservations_item_status
ON inventory_reservations(item_id, status);

CREATE INDEX idx_inventory_reservations_status_expiry
ON inventory_reservations(status, expires_at);

CREATE INDEX idx_item_sale_sessions_item_status
ON item_sale_sessions(item_id, status, auto_close_at);

CREATE UNIQUE INDEX idx_item_sale_sessions_one_open
ON item_sale_sessions(item_id)
WHERE status = 'OPEN';

CREATE INDEX idx_item_sale_sessions_shop_status
ON item_sale_sessions(shop_id, status, auto_close_at);

CREATE INDEX idx_knock_requests_shop_date
ON knock_requests(shop_id, knock_date);

CREATE INDEX idx_knock_requests_user_date
ON knock_requests(user_id, knock_date);

CREATE INDEX idx_kyc_verifications_account_time
ON kyc_verifications(merchant_account_id, submitted_at);

CREATE INDEX idx_kyc_verifications_user_status
ON kyc_verifications(user_id, status);

CREATE INDEX idx_merchant_accounts_owner ON merchant_accounts(owner_user_id);

CREATE INDEX idx_merchant_accounts_status ON merchant_accounts(status, kyc_status);

CREATE INDEX idx_merchant_contracts_account_status
ON merchant_contracts(merchant_account_id, status);

CREATE INDEX idx_merchant_contracts_shop_status
ON merchant_contracts(shop_id, status);

CREATE INDEX idx_merchant_payout_status
ON merchant_payout_profiles(status);

CREATE INDEX idx_notification_queue_status_time
ON notification_queue(status, next_attempt_at, created_at);

CREATE INDEX idx_notifications_shop_status_time
ON notifications(shop_id, status, created_at);

CREATE INDEX idx_notifications_user_status_time
ON notifications(user_id, status, created_at);

CREATE INDEX idx_order_items_item
ON order_items(item_id);

CREATE UNIQUE INDEX idx_order_items_one_item_per_order
ON order_items(order_id);

CREATE INDEX idx_order_items_order
ON order_items(order_id);

CREATE INDEX idx_order_status_events_order_time
ON order_status_events(order_id, created_at);

CREATE INDEX idx_orders_payment_hold
ON orders(status, payment_hold_expires_at);

CREATE INDEX idx_orders_shop_status_time
ON orders(shop_id, status, created_at);

CREATE INDEX idx_orders_user_status_time
ON orders(user_id, status, created_at);

CREATE INDEX idx_partner_commission_order
ON partner_commission_ledger(order_id);

CREATE INDEX idx_partner_commission_shop_time
ON partner_commission_ledger(shop_id, created_at);

CREATE INDEX idx_partner_commission_user_status
ON partner_commission_ledger(referrer_user_id, status, review_until);

CREATE INDEX idx_partner_contracts_user_status
ON partner_contracts(user_id, status);

CREATE INDEX idx_partner_payout_profiles_status
ON partner_payout_profiles(status);

CREATE INDEX idx_partner_payout_requests_user_status
ON partner_payout_requests(user_id, status, requested_at);

CREATE INDEX idx_partner_profiles_status
ON partner_profiles(partner_status);

CREATE INDEX idx_payments_order
ON payments(order_id, status);

CREATE INDEX idx_payments_provider_trade
ON payments(provider, provider_trade_no);

CREATE UNIQUE INDEX idx_plus_one_active_per_shop
ON plus_subscriptions(shop_id)
WHERE status = 'ACTIVE';

CREATE INDEX idx_plus_subscriptions_active
ON plus_subscriptions(status, ends_at);

CREATE INDEX idx_plus_subscriptions_shop_status
ON plus_subscriptions(shop_id, status, starts_at);

CREATE INDEX idx_referral_relations_referrer_status
ON referral_relations(referrer_user_id, status);

CREATE INDEX idx_referral_relations_shop_status
ON referral_relations(shop_id, status);

CREATE INDEX idx_refunds_order_status
ON refunds(order_id, status, requested_at);

CREATE INDEX idx_refunds_payment
ON refunds(payment_id, status);

CREATE INDEX idx_risk_alerts_order
ON risk_alerts(order_id, status);

CREATE INDEX idx_risk_alerts_status_severity
ON risk_alerts(status, severity, created_at);

CREATE INDEX idx_settlement_batches_shop_status_period
ON merchant_settlement_batches(shop_id, status, period_end);

CREATE INDEX idx_settlement_items_batch
ON merchant_settlement_items(batch_id, item_type);

CREATE INDEX idx_settlement_items_order
ON merchant_settlement_items(order_id, item_type);

CREATE UNIQUE INDEX idx_settlement_order_once
ON merchant_settlement_items(order_id)
WHERE item_type = 'ORDER' AND order_id IS NOT NULL;

CREATE INDEX idx_shop_items_live
ON shop_items(status, current_stock, pickup_cutoff);

CREATE INDEX idx_shop_items_shop_status
ON shop_items(shop_id, status);

CREATE INDEX idx_shop_members_shop ON shop_members(shop_id, status);

CREATE INDEX idx_shop_members_user ON shop_members(user_id, status);

CREATE INDEX idx_shop_watchlist_shop_status
ON shop_watchlist(shop_id, status);

CREATE INDEX idx_shop_watchlist_user_status
ON shop_watchlist(user_id, status);

CREATE INDEX idx_shops_account ON shops(merchant_account_id);

CREATE INDEX idx_shops_city_district_status
ON shops(city, district, status);

CREATE INDEX idx_shops_status ON shops(status, risk_status);

CREATE INDEX idx_store_candidates_place
ON store_candidates(google_place_id);

CREATE INDEX idx_store_candidates_status_area
ON store_candidates(status, city, district);

CREATE INDEX idx_store_recommendations_candidate
ON store_recommendations(candidate_id, created_at);

CREATE INDEX idx_tickets_shop_status
ON tickets(shop_id, status, pickup_deadline);

CREATE INDEX idx_tickets_user_status
ON tickets(user_id, status, pickup_deadline);

CREATE INDEX idx_users_status ON users(status);


