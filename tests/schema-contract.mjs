import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const root = new URL('../', import.meta.url);
const worker = fs.readFileSync(new URL('worker.js', root), 'utf8');
const migration = fs.readFileSync(new URL('migrations/0001_partner_rule_v2_reconciliation.sql', root), 'utf8');
const contract = fs.readFileSync(new URL('tests/fixtures/frozen_step2a_h_contract.sql', root), 'utf8');

const db = new DatabaseSync(':memory:');
db.exec(contract);
db.exec('PRAGMA foreign_keys=ON');

const tables = db.prepare("SELECT COUNT(*) n FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().n;
if (tables !== 45) throw new Error(`Frozen contract expected 45 tables, received ${tables}`);

const commissionColumns = db.prepare("PRAGMA table_info('partner_commission_ledger')").all().map(x => x.name);
if (!commissionColumns.includes('commission_amount_x10000') || commissionColumns.includes('commission_amount')) {
  throw new Error('Partner commission columns do not match the final frozen Step2H structure');
}

const disputeSql = db.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name='order_disputes'").get().sql;
for (const status of ['UNDER_REVIEW', 'RESOLVED_NO_REFUND', 'RESOLVED_REFUND']) {
  if (!disputeSql.includes(`'${status}'`)) throw new Error(`Frozen dispute status missing: ${status}`);
}

const preparedSql = /\.prepare\(\s*`([\s\S]*?)`\s*\)/g;
let match;
let prepared = 0;
while ((match = preparedSql.exec(worker))) {
  const line = worker.slice(0, match.index).split('\n').length;
  try {
    db.prepare(match[1]);
    prepared += 1;
  } catch (error) {
    throw new Error(`Worker SQL at line ${line} is incompatible with frozen Step2A-H: ${error.message}`);
  }
}

db.exec(migration);
const currentRule = db.prepare("SELECT COUNT(*) n FROM partner_rule_versions WHERE rule_version='PARTNER-2.0-SERVICE-FEE-ONLY'").get().n;
const policyMarker = db.prepare("SELECT COUNT(*) n FROM schema_versions WHERE version='3.1.2-ADMIN-REFUND-14D'").get().n;
if (currentRule !== 1 || policyMarker !== 1) throw new Error('Forward migration did not apply to the full frozen schema contract');

console.log(`FULL FROZEN SCHEMA CONTRACT PASS: ${tables} tables; ${prepared} Worker SQL statements; Step2H x10000 units; forward migration`);
