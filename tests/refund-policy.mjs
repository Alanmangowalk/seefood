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
  PRAGMA foreign_keys=ON;
  CREATE TABLE users(user_id TEXT PRIMARY KEY,status TEXT,source TEXT,created_at TEXT,updated_at TEXT,last_seen_at TEXT);
  CREATE TABLE merchant_accounts(account_id TEXT PRIMARY KEY);
  CREATE TABLE shops(shop_id TEXT PRIMARY KEY,name TEXT,merchant_account_id TEXT,status TEXT);
  CREATE TABLE orders(
    order_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,shop_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('PAYMENT_PENDING','PAID','REDEEMED','PAYMENT_FAILED','CANCELLED','EXPIRED','ABNORMAL_REVIEW','DISPUTED','REFUND_PENDING','REFUNDED')),
    subtotal INTEGER,service_fee INTEGER,total_amount INTEGER,currency TEXT,pickup_at TEXT,pickup_deadline TEXT,payment_hold_expires_at TEXT,paid_at TEXT,redeemed_at TEXT,created_at TEXT,updated_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(user_id),FOREIGN KEY(shop_id) REFERENCES shops(shop_id)
  );
  CREATE TABLE payments(
    payment_id TEXT PRIMARY KEY,order_id TEXT NOT NULL,provider TEXT,merchant_trade_no TEXT UNIQUE,amount INTEGER,currency TEXT,
    status TEXT NOT NULL CHECK(status IN ('PENDING','PAID','FAILED','CANCELLED','REFUND_PENDING','REFUNDED','ABNORMAL_REVIEW')),
    provider_trade_no TEXT,callback_fingerprint TEXT,paid_at TEXT,failed_at TEXT,refunded_at TEXT,created_at TEXT,updated_at TEXT,
    FOREIGN KEY(order_id) REFERENCES orders(order_id)
  );
  CREATE TABLE tickets(
    ticket_id TEXT PRIMARY KEY,order_id TEXT UNIQUE,user_id TEXT,shop_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('ACTIVE','REDEEMED','EXPIRED','CANCELLED')),
    pickup_at TEXT,pickup_deadline TEXT,redeemed_at TEXT,redeemed_by_user_id TEXT,created_at TEXT,updated_at TEXT,
    FOREIGN KEY(order_id) REFERENCES orders(order_id)
  );
  CREATE TABLE order_disputes(
    dispute_id TEXT PRIMARY KEY,order_id TEXT NOT NULL,opened_by_user_id TEXT,dispute_type TEXT,description TEXT,
    status TEXT NOT NULL CHECK(status IN ('OPEN','UNDER_REVIEW','RESOLVED_NO_REFUND','RESOLVED_REFUND','REJECTED','CANCELLED')),
    resolution_note TEXT,resolved_by_user_id TEXT,opened_at TEXT,resolved_at TEXT,updated_at TEXT,
    FOREIGN KEY(order_id) REFERENCES orders(order_id),FOREIGN KEY(opened_by_user_id) REFERENCES users(user_id),FOREIGN KEY(resolved_by_user_id) REFERENCES users(user_id)
  );
  CREATE TABLE refunds(
    refund_id TEXT PRIMARY KEY,order_id TEXT NOT NULL,payment_id TEXT NOT NULL,dispute_id TEXT,amount INTEGER NOT NULL,reason TEXT,
    status TEXT NOT NULL CHECK(status IN ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED')),
    provider_refund_no TEXT,requested_at TEXT,completed_at TEXT,failed_at TEXT,updated_at TEXT,
    FOREIGN KEY(order_id) REFERENCES orders(order_id),FOREIGN KEY(payment_id) REFERENCES payments(payment_id),FOREIGN KEY(dispute_id) REFERENCES order_disputes(dispute_id)
  );
  CREATE TABLE partner_commission_ledger(entry_id TEXT PRIMARY KEY,order_id TEXT,status TEXT,available_at TEXT,voided_at TEXT,void_reason TEXT,updated_at TEXT);
  CREATE TABLE order_status_events(event_id TEXT PRIMARY KEY,order_id TEXT,from_status TEXT,to_status TEXT,reason TEXT,actor_type TEXT,actor_id TEXT,created_at TEXT);
  CREATE TABLE audit_logs(audit_id TEXT PRIMARY KEY,actor_type TEXT,actor_id TEXT,action TEXT,entity_type TEXT,entity_id TEXT,before_json TEXT,after_json TEXT,ip_hash TEXT,user_agent TEXT,created_at TEXT);
  CREATE TABLE merchant_payout_profiles(merchant_account_id TEXT PRIMARY KEY,status TEXT,bank_code TEXT,branch_code TEXT,account_holder TEXT,bank_account_last5 TEXT);
  CREATE TABLE merchant_contracts(shop_id TEXT,status TEXT);
  CREATE TABLE plus_subscriptions(shop_id TEXT,status TEXT,starts_at TEXT);

  INSERT INTO users VALUES('U-BUYER','ACTIVE','TEST',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO merchant_accounts VALUES('MA-1');
  INSERT INTO shops VALUES('S-1','測試店家','MA-1','ACTIVE');
  INSERT INTO merchant_payout_profiles VALUES('MA-1','VERIFIED','004','001','測試店家','12345');
  INSERT INTO merchant_contracts VALUES('S-1','SIGNED');
  INSERT INTO orders(order_id,user_id,shop_id,status,subtotal,service_fee,total_amount,currency,paid_at,redeemed_at,created_at,updated_at) VALUES('O-QUALITY','U-BUYER','S-1','REDEEMED',100,10,110,'TWD',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO orders(order_id,user_id,shop_id,status,subtotal,service_fee,total_amount,currency,paid_at,created_at,updated_at) VALUES('O-LATE','U-BUYER','S-1','EXPIRED',100,10,110,'TWD',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO orders(order_id,user_id,shop_id,status,subtotal,service_fee,total_amount,currency,paid_at,created_at,updated_at) VALUES('O-OLD','U-BUYER','S-1','EXPIRED',100,10,110,'TWD',datetime('now','-15 day'),datetime('now','-15 day'),CURRENT_TIMESTAMP);
  INSERT INTO orders(order_id,user_id,shop_id,status,subtotal,service_fee,total_amount,currency,paid_at,redeemed_at,created_at,updated_at) VALUES('O-HOLD','U-BUYER','S-1','REDEEMED',100,10,110,'TWD',datetime('now','-5 day'),datetime('now','-5 day'),datetime('now','-5 day'),CURRENT_TIMESTAMP);
  INSERT INTO orders(order_id,user_id,shop_id,status,subtotal,service_fee,total_amount,currency,paid_at,redeemed_at,created_at,updated_at) VALUES('O-NOREF','U-BUYER','S-1','REDEEMED',100,10,110,'TWD',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO payments(payment_id,order_id,provider,merchant_trade_no,amount,currency,status,paid_at,created_at,updated_at) VALUES('P-QUALITY','O-QUALITY','ECPAY','T-QUALITY',110,'TWD','PAID',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO payments(payment_id,order_id,provider,merchant_trade_no,amount,currency,status,paid_at,created_at,updated_at) VALUES('P-LATE','O-LATE','ECPAY','T-LATE',110,'TWD','PAID',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO payments(payment_id,order_id,provider,merchant_trade_no,amount,currency,status,paid_at,created_at,updated_at) VALUES('P-OLD','O-OLD','ECPAY','T-OLD',110,'TWD','PAID',datetime('now','-15 day'),datetime('now','-15 day'),CURRENT_TIMESTAMP);
  INSERT INTO payments(payment_id,order_id,provider,merchant_trade_no,amount,currency,status,paid_at,created_at,updated_at) VALUES('P-NOREF','O-NOREF','ECPAY','T-NOREF',110,'TWD','PAID',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO tickets(ticket_id,order_id,user_id,shop_id,status,pickup_deadline,redeemed_at,created_at,updated_at) VALUES('T-QUALITY','O-QUALITY','U-BUYER','S-1','REDEEMED',datetime('now','+1 hour'),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO tickets(ticket_id,order_id,user_id,shop_id,status,pickup_deadline,created_at,updated_at) VALUES('T-LATE','O-LATE','U-BUYER','S-1','EXPIRED',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO tickets(ticket_id,order_id,user_id,shop_id,status,pickup_deadline,created_at,updated_at) VALUES('T-OLD','O-OLD','U-BUYER','S-1','EXPIRED',datetime('now','-15 day'),datetime('now','-15 day'),CURRENT_TIMESTAMP);
  INSERT INTO tickets(ticket_id,order_id,user_id,shop_id,status,pickup_deadline,redeemed_at,created_at,updated_at) VALUES('T-NOREF','O-NOREF','U-BUYER','S-1','REDEEMED',datetime('now','+1 hour'),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO partner_commission_ledger VALUES('C-QUALITY','O-QUALITY','AVAILABLE',CURRENT_TIMESTAMP,NULL,NULL,CURRENT_TIMESTAMP);
`);

const env = {
  DB: new D1Database(db),
  ADMIN_API_KEY: 'test-admin-key',
  SESSION_SECRET: 'refund-test-session-secret',
  LINE_LOGIN_CHANNEL_ID: 'refund-test-channel'
};

const nativeFetch = globalThis.fetch;
globalThis.fetch = async input => {
  const url = String(input);
  if (url.startsWith('https://api.line.me/oauth2/v2.1/verify')) return Response.json({ client_id: env.LINE_LOGIN_CHANNEL_ID, expires_in: 3600 });
  if (url === 'https://api.line.me/v2/profile') return Response.json({ userId: 'U-BUYER' });
  return nativeFetch(input);
};

const login = await workerModule.default.fetch(new Request('https://seefood.test/api/auth/line', {
  method: 'POST',
  body: new URLSearchParams({ accessToken: 'valid-test-token' })
}), env);
const cookie = String(login.headers.get('set-cookie') || '').split(';')[0];

let response = await workerModule.default.fetch(new Request('https://seefood.test/api/action', {
  method: 'POST',
  headers: { Cookie: cookie },
  body: new URLSearchParams({ action: 'createDispute', uid: 'U-BUYER', orderId: 'O-QUALITY', reason: 'QUALITY_ISSUE' })
}), env);
let body = await response.json();
if (body.status !== 'support_required' || body.code !== 'CUSTOMER_SERVICE_ONLY') throw new Error('Buyer self-service complaint was not blocked');
if (db.prepare(`SELECT COUNT(*) n FROM order_disputes`).get().n !== 0) throw new Error('Buyer self-service unexpectedly wrote a complaint');

const admin = async payload => workerModule.default.fetch(new Request('https://seefood.test/api/admin/order-complaints', {
  method: 'POST',
  headers: { 'X-Admin-Key': env.ADMIN_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
}), env);

response = await admin({ operation: 'OPEN', orderId: 'O-LATE', adminId: 'CS-1', disputeType: 'LATE_PICKUP', description: '買家逾期未取' });
body = await response.json();
if (response.status !== 400 || body.code !== 'COMPLAINT_TYPE_NOT_ALLOWED') throw new Error('Late pickup was incorrectly accepted as a refund complaint');

response = await admin({ operation: 'OPEN', orderId: 'O-OLD', adminId: 'CS-1', disputeType: 'QUALITY_ISSUE', description: '超過期限的申訴' });
body = await response.json();
if (response.status !== 409 || body.code !== 'REFUND_WINDOW_EXPIRED') throw new Error('Complaint outside 14-day window was not rejected');

response = await admin({ operation: 'OPEN', orderId: 'O-NOREF', adminId: 'CS-1', disputeType: 'ITEM_MISMATCH', description: '客服查核品項差異' });
body = await response.json();
if (response.status !== 200 || body.caseStatus !== 'UNDER_REVIEW') throw new Error('No-refund test complaint did not open');
response = await admin({ operation: 'CLOSE_NO_REFUND', orderId: 'O-NOREF', adminId: 'CS-1', resolutionNote: '店家影像與訂單資料一致，不成立退款' });
body = await response.json();
if (response.status !== 200 || body.caseStatus !== 'RESOLVED_NO_REFUND') throw new Error('No-refund complaint did not use the frozen D1 terminal status');
if (db.prepare(`SELECT status FROM order_disputes WHERE order_id='O-NOREF'`).get().status !== 'RESOLVED_NO_REFUND') throw new Error('No-refund complaint status was not persisted');

response = await admin({ operation: 'OPEN', orderId: 'O-QUALITY', adminId: 'CS-1', disputeType: 'QUALITY_ISSUE', description: '餐點品質異常，客服已取得照片' });
body = await response.json();
if (response.status !== 200 || body.caseStatus !== 'UNDER_REVIEW') throw new Error(`Admin complaint open failed: ${JSON.stringify(body)}`);
if (db.prepare(`SELECT status FROM partner_commission_ledger WHERE entry_id='C-QUALITY'`).get().status !== 'PENDING_REVIEW') throw new Error('Open complaint did not hold available commission');

response = await admin({ operation: 'APPROVE_REFUND', orderId: 'O-QUALITY', adminId: 'CS-1', resolutionNote: '照片與店家回覆確認品質不符' });
body = await response.json();
if (response.status !== 200 || body.orderStatus !== 'REFUND_PENDING' || !body.requiresGatewayRefund) throw new Error(`Refund approval failed: ${JSON.stringify(body)}`);
const approvedOrder = db.prepare(`SELECT status FROM orders WHERE order_id='O-QUALITY'`).get();
const approvedPayment = db.prepare(`SELECT status FROM payments WHERE order_id='O-QUALITY'`).get();
const approvedCommission = db.prepare(`SELECT status,void_reason FROM partner_commission_ledger WHERE entry_id='C-QUALITY'`).get();
const pendingRefund = db.prepare(`SELECT refund_id,amount,status FROM refunds WHERE order_id='O-QUALITY'`).get();
if (approvedOrder.status !== 'REFUND_PENDING' || approvedPayment.status !== 'REFUND_PENDING') throw new Error('Approved refund did not stop merchant settlement');
if (approvedCommission.status !== 'VOID' || approvedCommission.void_reason !== 'CUSTOMER_SERVICE_REFUND_APPROVED') throw new Error('Approved refund did not void Partner commission');
if (!pendingRefund || pendingRefund.amount !== 110 || pendingRefund.status !== 'PENDING') throw new Error('Approved refund did not create the D1 refund ledger entry');

response = await admin({ operation: 'MARK_REFUNDED', orderId: 'O-QUALITY', adminId: 'CS-1' });
body = await response.json();
if (response.status !== 400 || body.code !== 'GATEWAY_REFERENCE_REQUIRED') throw new Error('Refund completion did not require a gateway reference');

response = await admin({ operation: 'MARK_REFUNDED', orderId: 'O-QUALITY', adminId: 'CS-1', gatewayReference: 'ECPAY-REFUND-001' });
body = await response.json();
if (response.status !== 200 || body.orderStatus !== 'REFUNDED') throw new Error(`Refund confirmation failed: ${JSON.stringify(body)}`);
if (db.prepare(`SELECT status FROM orders WHERE order_id='O-QUALITY'`).get().status !== 'REFUNDED') throw new Error('Order was not marked REFUNDED');
const completedPayment = db.prepare(`SELECT status,refunded_at FROM payments WHERE order_id='O-QUALITY'`).get();
const completedRefund = db.prepare(`SELECT status,provider_refund_no,completed_at FROM refunds WHERE order_id='O-QUALITY'`).get();
const completedDispute = db.prepare(`SELECT status,resolved_at FROM order_disputes WHERE order_id='O-QUALITY'`).get();
if (completedPayment.status !== 'REFUNDED' || !completedPayment.refunded_at) throw new Error('Payment was not marked REFUNDED with timestamp');
if (completedRefund.status !== 'COMPLETED' || completedRefund.provider_refund_no !== 'ECPAY-REFUND-001' || !completedRefund.completed_at) throw new Error('Refund ledger was not completed with provider reference');
if (completedDispute.status !== 'RESOLVED_REFUND' || !completedDispute.resolved_at) throw new Error('Complaint was not resolved with the legal D1 status');

response = await workerModule.default.fetch(new Request('https://seefood.test/api/admin/settlements', {
  method: 'GET',
  headers: { 'X-Admin-Key': env.ADMIN_API_KEY }
}), env);
body = await response.json();
const settlement = body.rows?.find(row => row.shopId === 'S-1');
if (response.status !== 200 || !settlement || settlement.gross !== 100 || settlement.refundReviewHold !== 100) {
  throw new Error(`14-day merchant settlement gate mismatch: ${JSON.stringify(body)}`);
}

console.log('REFUND POLICY PASS: buyer blocked; late pickup rejected; 14-day gate; no-refund resolution; expired-order payout; admin approval hold; gateway-confirmed refund');
