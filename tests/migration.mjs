import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const sql = fs.readFileSync(new URL('../migrations/0001_partner_rule_v2_reconciliation.sql', import.meta.url), 'utf8');
const db = new DatabaseSync(':memory:');

db.exec(`
  CREATE TABLE partner_rule_versions(
    rule_version TEXT PRIMARY KEY,
    eligible_revenue_type TEXT,
    service_fee_rate_bps INTEGER,
    plus_eligible INTEGER,
    review_days INTEGER,
    inactivity_days INTEGER,
    effective_at TEXT,
    created_at TEXT
  );
  CREATE TABLE orders(order_id TEXT PRIMARY KEY, status TEXT);
  CREATE TABLE partner_commission_ledger(
    entry_id TEXT PRIMARY KEY,
    order_id TEXT,
    status TEXT,
    voided_at TEXT,
    void_reason TEXT,
    updated_at TEXT
  );
  CREATE TABLE schema_versions(version TEXT PRIMARY KEY, description TEXT);

  INSERT INTO orders VALUES('O-PRE','PAID');
  INSERT INTO orders VALUES('O-DONE','REDEEMED');
  INSERT INTO partner_commission_ledger VALUES('C-PRE','O-PRE','PENDING_REVIEW',NULL,NULL,CURRENT_TIMESTAMP);
  INSERT INTO partner_commission_ledger VALUES('C-DONE','O-DONE','AVAILABLE',NULL,NULL,CURRENT_TIMESTAMP);
  INSERT INTO partner_commission_ledger VALUES('C-REQUESTED','O-PRE','REQUESTED',NULL,NULL,CURRENT_TIMESTAMP);
`);

db.exec(sql);

const rule = db.prepare(`SELECT * FROM partner_rule_versions WHERE rule_version='PARTNER-2.0-SERVICE-FEE-ONLY'`).get();
const pre = db.prepare(`SELECT status,void_reason FROM partner_commission_ledger WHERE entry_id='C-PRE'`).get();
const done = db.prepare(`SELECT status FROM partner_commission_ledger WHERE entry_id='C-DONE'`).get();
const requested = db.prepare(`SELECT status FROM partner_commission_ledger WHERE entry_id='C-REQUESTED'`).get();
const version = db.prepare(`SELECT version FROM schema_versions WHERE version='3.1.1-PARTNER-RULE-V2'`).get();
const refundPolicyVersion = db.prepare(`SELECT version FROM schema_versions WHERE version='3.1.2-ADMIN-REFUND-14D'`).get();

if (!rule || rule.eligible_revenue_type !== 'SERVICE_FEE_ONLY' || rule.service_fee_rate_bps !== 5000 || rule.plus_eligible !== 0) {
  throw new Error(`Partner v2 rule mismatch: ${JSON.stringify(rule)}`);
}
if (pre.status !== 'VOID' || pre.void_reason !== 'PRE_REDEEM_RULE_V2_RECONCILIATION') {
  throw new Error(`Pre-redeem commission was not reconciled: ${JSON.stringify(pre)}`);
}
if (done.status !== 'AVAILABLE') throw new Error('Redeemed commission was incorrectly voided');
if (requested.status !== 'REQUESTED') throw new Error('Requested commission was incorrectly changed');
if (!version) throw new Error('Schema version marker was not inserted');
if (!refundPolicyVersion) throw new Error('Refund policy version marker was not inserted');

console.log('D1 FORWARD MIGRATION SQL PASS: v2 rule; pre-redeem reconciliation; requested/paid safety gate; admin-only 14-day refund marker');
