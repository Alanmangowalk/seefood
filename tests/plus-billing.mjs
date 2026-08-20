import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const root = new URL('../', import.meta.url);
const workerSource = fs.readFileSync(new URL('worker.js', root), 'utf8');
const contract = fs.readFileSync(new URL('tests/fixtures/frozen_step2a_h_contract.sql', root), 'utf8');
const migration1 = fs.readFileSync(new URL('migrations/0001_partner_rule_v2_reconciliation.sql', root), 'utf8');
const migration2 = fs.readFileSync(new URL('migrations/0002_plus_deferred_billing.sql', root), 'utf8');
const workerModule = await import(`data:text/javascript;base64,${Buffer.from(workerSource).toString('base64')}`);

class D1Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async first() { return this.db.prepare(this.sql).get(...this.values) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.values) }; }
  async run() { const result = this.db.prepare(this.sql).run(...this.values); return { meta: { changes: Number(result.changes || 0) } }; }
}
class D1Database {
  constructor(db) { this.db = db; }
  prepare(sql) { return new D1Statement(this.db, sql); }
  async batch(statements) {
    const results=[]; this.db.exec('BEGIN');
    try { for (const st of statements) results.push(await st.run()); this.db.exec('COMMIT'); return results; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
}

function twPeriodFor(date) {
  const d = new Date(date.getTime() + 8*60*60*1000);
  return `${d.toISOString().slice(0,7)}-${d.getUTCDate()<=15?'A':'B'}`;
}

const db = new DatabaseSync(':memory:');
db.exec(contract); db.exec(migration1); db.exec(migration2); db.exec('PRAGMA foreign_keys=ON');

db.exec(`
  INSERT INTO users(user_id,status,source,created_at,updated_at,last_seen_at) VALUES('U-OWNER','ACTIVE','TEST',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO merchant_accounts(account_id,owner_user_id,status,kyc_status,payout_status,signer_name,verified_at) VALUES('MA-1','U-OWNER','ACTIVE','VERIFIED','VERIFIED','王店長',CURRENT_TIMESTAMP);
  INSERT INTO shops(shop_id,merchant_account_id,name,status,risk_status,city,district) VALUES('S-PLUS','MA-1','Plus 測試店','ACTIVE','CLEAR','台北','中正');
  INSERT INTO shop_members(relation_id,shop_id,user_id,role,status) VALUES('SM-1','S-PLUS','U-OWNER','OWNER','ACTIVE');
  INSERT INTO merchant_contracts(contract_id,merchant_account_id,shop_id,contract_version,status,signer_name,signed_at) VALUES('MC-1','MA-1','S-PLUS','MERCHANT-1.0','SIGNED','王店長',CURRENT_TIMESTAMP);
  INSERT INTO merchant_payout_profiles(merchant_account_id,status,bank_code,branch_code,account_holder,bank_account_last5,verified_at) VALUES('MA-1','VERIFIED','004','001','王店長','12345',CURRENT_TIMESTAMP);
`);

const old1 = new Date(Date.now()-55*86400000);
const old2 = new Date(Date.now()-35*86400000);
const p1 = twPeriodFor(old1), p2 = twPeriodFor(old2);
if (p1 === p2) throw new Error('Test fixture periods unexpectedly collide');
const iso1 = old1.toISOString(), iso2 = old2.toISOString();
const addOrder = db.prepare(`INSERT INTO orders(order_id,user_id,shop_id,status,subtotal,service_fee,total_amount,currency,pickup_at,pickup_deadline,paid_at,redeemed_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
addOrder.run('O-LOW','U-OWNER','S-PLUS','REDEEMED',100,10,110,'TWD',iso1,iso1,iso1,iso1,iso1,iso1);
addOrder.run('O-HIGH','U-OWNER','S-PLUS','REDEEMED',300,20,320,'TWD',iso2,iso2,iso2,iso2,iso2,iso2);

const env={DB:new D1Database(db),SESSION_SECRET:'plus-test-secret',LINE_LOGIN_CHANNEL_ID:'plus-test-line',ADMIN_API_KEY:'plus-admin'};
const nativeFetch=globalThis.fetch;
globalThis.fetch=async input=>{
  const url=String(input);
  if(url.startsWith('https://api.line.me/oauth2/v2.1/verify'))return Response.json({client_id:env.LINE_LOGIN_CHANNEL_ID,expires_in:3600});
  if(url==='https://api.line.me/v2/profile')return Response.json({userId:'U-OWNER'});
  return nativeFetch(input);
};
const login=await workerModule.default.fetch(new Request('https://seefood.test/api/auth/line',{method:'POST',body:new URLSearchParams({accessToken:'valid'})}),env);
const cookie=String(login.headers.get('set-cookie')||'').split(';')[0];
if(!cookie.startsWith('sf_session='))throw new Error('Plus test session missing');
const action=async params=>workerModule.default.fetch(new Request('https://seefood.test/api/action',{method:'POST',headers:{Cookie:cookie},body:new URLSearchParams(params)}),env);
const adminClose=async period=>workerModule.default.fetch(new Request('https://seefood.test/api/admin/settlements',{method:'POST',headers:{'X-Admin-Key':env.ADMIN_API_KEY},body:new URLSearchParams({operation:'CLOSE_PERIOD',period,actorId:'TEST-HQ'})}),env);

let response=await action({action:'upgradeVip',uid:'U-OWNER',shopId:'S-PLUS'}),body=await response.json();
if(body.status!=='success'||body.plusOutstanding!==299)throw new Error(`Immediate Plus activation failed: ${JSON.stringify(body)}`);
let sub=db.prepare(`SELECT status,starts_at,ends_at FROM plus_subscriptions WHERE shop_id='S-PLUS' ORDER BY created_at DESC LIMIT 1`).get();
let charge=db.prepare(`SELECT amount_due,amount_collected,amount_outstanding,status FROM plus_billing_charges WHERE shop_id='S-PLUS' ORDER BY created_at DESC LIMIT 1`).get();
if(sub.status!=='ACTIVE'||new Date(sub.ends_at)-new Date(sub.starts_at)!==30*86400000)throw new Error(`Plus did not grant exactly 30 days: ${JSON.stringify(sub)}`);
if(charge.amount_due!==299||charge.amount_outstanding!==299||charge.status!=='OUTSTANDING')throw new Error(`Initial Plus charge mismatch: ${JSON.stringify(charge)}`);

response=await adminClose(p1); body=await response.json();
const first=body.results?.find(x=>x.shopId==='S-PLUS');
if(first?.status!=='READY_TO_PAY'||first.plusDeduction!==95||first.netPayout!==0)throw new Error(`First partial deduction mismatch: ${JSON.stringify(body)}`);
charge=db.prepare(`SELECT amount_collected,amount_outstanding,status FROM plus_billing_charges WHERE shop_id='S-PLUS' ORDER BY created_at DESC LIMIT 1`).get();
sub=db.prepare(`SELECT status FROM plus_subscriptions WHERE shop_id='S-PLUS' ORDER BY created_at DESC LIMIT 1`).get();
if(charge.amount_collected!==95||charge.amount_outstanding!==204||charge.status!=='PARTIALLY_COLLECTED')throw new Error(`Carry-over after partial payout mismatch: ${JSON.stringify(charge)}`);
if(sub.status!=='ACTIVE')throw new Error('Insufficient payout terminated Plus before the 30-day entitlement ended');

response=await action({action:'upgradeVip',uid:'U-OWNER',shopId:'S-PLUS'}); body=await response.json();
if(body.status!=='success'||!body.alreadyVip)throw new Error('Active Plus was incorrectly blocked by its own outstanding balance');

db.prepare(`UPDATE plus_subscriptions SET status='EXPIRED',ends_at=datetime('now','-1 minute') WHERE shop_id='S-PLUS' AND status='ACTIVE'`).run();
response=await action({action:'upgradeVip',uid:'U-OWNER',shopId:'S-PLUS'}); body=await response.json();
if(body.status!=='error'||body.code!=='PLUS_BALANCE_DUE'||body.plusOutstanding!==204)throw new Error(`Re-upgrade was not blocked while debt remained: ${JSON.stringify(body)}`);

response=await adminClose(p2); body=await response.json();
const second=body.results?.find(x=>x.shopId==='S-PLUS');
if(second?.status!=='READY_TO_PAY'||second.plusDeduction!==204||second.netPayout!==87)throw new Error(`Second deduction / residual payout mismatch: ${JSON.stringify(body)}`);
charge=db.prepare(`SELECT amount_collected,amount_outstanding,status FROM plus_billing_charges WHERE shop_id='S-PLUS' ORDER BY created_at DESC LIMIT 1`).get();
if(charge.amount_collected!==299||charge.amount_outstanding!==0||charge.status!=='SETTLED')throw new Error(`Plus charge did not settle: ${JSON.stringify(charge)}`);

response=await action({action:'upgradeVip',uid:'U-OWNER',shopId:'S-PLUS'}); body=await response.json();
if(body.status!=='success'||body.plusOutstanding!==299)throw new Error(`Re-upgrade was not restored after balance cleared: ${JSON.stringify(body)}`);
const charges=db.prepare(`SELECT COUNT(*) n FROM plus_billing_charges WHERE shop_id='S-PLUS'`).get().n;
if(charges!==2)throw new Error(`Expected a new Plus charge after re-upgrade, received ${charges}`);

console.log('PLUS BILLING PASS: immediate 30-day entitlement; next-payable deduction; partial carry-over; no early termination; re-upgrade blocked until zero; re-enabled after settlement');
