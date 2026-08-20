import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const workerSource = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
const workerModule = await import(`data:text/javascript;base64,${Buffer.from(workerSource).toString('base64')}`);

class D1Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async first() { return this.db.prepare(this.sql).get(...this.values) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.values) }; }
  async run() {
    const result = this.db.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes || 0) } };
  }
}

class D1Database {
  constructor(db) { this.db = db; }
  prepare(sql) { return new D1Statement(this.db, sql); }
  async batch(statements) {
    const results = [];
    this.db.exec('BEGIN');
    try {
      for (const statement of statements) results.push(await statement.run());
      this.db.exec('COMMIT');
      return results;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE users(user_id TEXT PRIMARY KEY,status TEXT,source TEXT,created_at TEXT,updated_at TEXT,last_seen_at TEXT);
  CREATE TABLE orders(order_id TEXT PRIMARY KEY,user_id TEXT,shop_id TEXT,status TEXT,service_fee INTEGER,pickup_deadline TEXT,redeemed_at TEXT,updated_at TEXT);
  CREATE TABLE tickets(ticket_id TEXT PRIMARY KEY,order_id TEXT,user_id TEXT,shop_id TEXT,status TEXT,pickup_deadline TEXT,redeemed_at TEXT,updated_at TEXT);
  CREATE TABLE order_status_events(event_id TEXT PRIMARY KEY,order_id TEXT,from_status TEXT,to_status TEXT,reason TEXT,actor_type TEXT,actor_id TEXT,created_at TEXT);
  CREATE TABLE partner_rule_versions(rule_version TEXT PRIMARY KEY,eligible_revenue_type TEXT,service_fee_rate_bps INTEGER,plus_eligible INTEGER,review_days INTEGER,inactivity_days INTEGER,effective_at TEXT,retired_at TEXT,created_at TEXT);
  CREATE TABLE partner_profiles(user_id TEXT PRIMARY KEY,partner_status TEXT,last_qualifying_activity_at TEXT,created_at TEXT,updated_at TEXT);
  CREATE TABLE referral_relations(relation_id TEXT PRIMARY KEY,referrer_user_id TEXT,shop_id TEXT,status TEXT,rule_version TEXT,last_qualifying_activity_at TEXT,updated_at TEXT);
  CREATE TABLE partner_commission_ledger(entry_id TEXT PRIMARY KEY,relation_id TEXT,referrer_user_id TEXT,shop_id TEXT,order_id TEXT,commission_source TEXT,service_fee_amount INTEGER,commission_rate_bps INTEGER,commission_amount_x10000 INTEGER,rule_version TEXT,status TEXT,review_until TEXT,available_at TEXT,voided_at TEXT,void_reason TEXT,created_at TEXT,updated_at TEXT,UNIQUE(relation_id,order_id,commission_source));
  CREATE TABLE identities(user_id TEXT PRIMARY KEY,kyc_status TEXT,legal_name TEXT);
  CREATE TABLE partner_contracts(contract_id TEXT PRIMARY KEY,user_id TEXT,contract_version TEXT,status TEXT,signed_at TEXT);
  CREATE TABLE partner_payout_profiles(user_id TEXT PRIMARY KEY,status TEXT,bank_account_last5 TEXT,account_holder TEXT);

  INSERT INTO users VALUES('U-BUYER','ACTIVE','TEST',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO users VALUES('U-PARTNER','ACTIVE','TEST',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO orders VALUES('O-1','U-BUYER','S-1','PAID',10,datetime('now','+1 hour'),NULL,CURRENT_TIMESTAMP);
  INSERT INTO tickets VALUES('T-1','O-1','U-BUYER','S-1','ACTIVE',datetime('now','+1 hour'),NULL,CURRENT_TIMESTAMP);
  INSERT INTO partner_rule_versions VALUES('PARTNER-2.0-SERVICE-FEE-ONLY','SERVICE_FEE_ONLY',5000,0,14,365,CURRENT_TIMESTAMP,NULL,CURRENT_TIMESTAMP);
  INSERT INTO partner_profiles VALUES('U-PARTNER','ACTIVE',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO referral_relations VALUES('R-1','U-PARTNER','S-1','ACTIVE','PARTNER-2.0-SERVICE-FEE-ONLY',NULL,CURRENT_TIMESTAMP);

  INSERT INTO identities VALUES('U-BUYER','VERIFIED','測試使用者');
  INSERT INTO partner_contracts VALUES('PC-OLD','U-BUYER','PARTNER-1.0','SIGNED',CURRENT_TIMESTAMP);
  INSERT INTO partner_payout_profiles VALUES('U-BUYER','VERIFIED','12345','測試使用者');
`);

const env = {
  DB: new D1Database(db),
  SESSION_SECRET: 'flow-test-session-secret',
  LINE_LOGIN_CHANNEL_ID: 'flow-test-channel'
};

const nativeFetch = globalThis.fetch;
globalThis.fetch = async input => {
  const url = String(input);
  if (url.startsWith('https://api.line.me/oauth2/v2.1/verify')) {
    return Response.json({ client_id: env.LINE_LOGIN_CHANNEL_ID, expires_in: 3600 });
  }
  if (url === 'https://api.line.me/v2/profile') return Response.json({ userId: 'U-BUYER' });
  return nativeFetch(input);
};

const login = await workerModule.default.fetch(new Request('https://seefood.test/api/auth/line', {
  method: 'POST',
  body: new URLSearchParams({ accessToken: 'valid-test-token' })
}), env);
if (login.status !== 200) throw new Error(`LINE login failed: ${login.status}`);
const cookie = String(login.headers.get('set-cookie') || '').split(';')[0];
if (!cookie.startsWith('sf_session=')) throw new Error('Session cookie missing');

const action = async params => workerModule.default.fetch(new Request('https://seefood.test/api/action', {
  method: 'POST',
  headers: { Cookie: cookie },
  body: new URLSearchParams(params)
}), env);

let response = await action({ action: 'syncCore', uid: 'U-PARTNER' });
let body = await response.json();
if (response.status !== 401 || body.code !== 'IDENTITY_MISMATCH') throw new Error('Session UID mismatch was not rejected');

response = await action({ action: 'getPartnerOnboarding', uid: 'U-BUYER' });
body = await response.json();
if (body.onboarding?.state !== 'CONTRACT_PENDING') throw new Error('Old Partner v1 contract was incorrectly accepted as current');

const paidCommissionCount = db.prepare(`SELECT COUNT(*) n FROM partner_commission_ledger WHERE order_id='O-1'`).get().n;
if (paidCommissionCount !== 0) throw new Error('PAID order already has commission before redemption');

response = await action({ action: 'verifyOrder', orderId: 'O-1', uid: 'U-BUYER' });
body = await response.json();
if (body.status !== 'success') throw new Error(`Redeem failed: ${JSON.stringify(body)}`);

const order = db.prepare(`SELECT status FROM orders WHERE order_id='O-1'`).get();
const commission = db.prepare(`SELECT service_fee_amount,commission_rate_bps,commission_amount_x10000,status FROM partner_commission_ledger WHERE order_id='O-1'`).get();
if (order.status !== 'REDEEMED') throw new Error('Order did not become REDEEMED');
if (!commission || commission.service_fee_amount !== 10 || commission.commission_rate_bps !== 5000 || commission.commission_amount_x10000 !== 50000 || commission.status !== 'PENDING_REVIEW') {
  throw new Error(`Commission rule mismatch: ${JSON.stringify(commission)}`);
}

response = await action({ action: 'verifyOrder', orderId: 'O-1', uid: 'U-BUYER' });
body = await response.json();
const count = db.prepare(`SELECT COUNT(*) n FROM partner_commission_ledger WHERE order_id='O-1'`).get().n;
if (body.status !== 'success' || count !== 1) throw new Error('Redeem retry was not idempotent');

console.log('WORKER FLOW PASS: UID binding; current-contract gate; PAID has no commission; REDEEMED-only 50%; idempotent retry');
