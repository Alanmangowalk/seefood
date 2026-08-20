import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const worker = fs.readFileSync(new URL('worker.js', root), 'utf8');
const index = fs.readFileSync(new URL('index.html', root), 'utf8');
const wrangler = JSON.parse(fs.readFileSync(new URL('wrangler.jsonc', root), 'utf8'));
const assetsIgnore = fs.readFileSync(new URL('.assetsignore', root), 'utf8');

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

check(worker.includes("const PARTNER_RULE = 'PARTNER-2.0-SERVICE-FEE-ONLY'"), 'Partner rule is not v2 service-fee-only');
check(worker.includes("const RELEASE = '3.0-RC2.10.9.3-D1-SHADOW'"), 'Worker release marker is missing');
check(worker.includes("const PARTNER_CONTRACT_VERSION = 'PARTNER-2.0-SERVICE-FEE-ONLY'"), 'Partner contract is not v2');
check(worker.includes('const REFUND_WINDOW_DAYS = 14'), '14-day refund decision window is missing');
check(worker.includes("contract_version=? AND status='SIGNED'"), 'Onboarding does not require the current contract version');
check(worker.includes("PARTNER_CONSENT_VERSION"), 'Partner v2 consent version is missing');
check(worker.includes("request.method!=='POST'"), 'Action endpoint is not POST-only');
check(worker.includes('LINE_SESSION_NOT_CONFIGURED'), 'Missing LINE session is not fail-closed');
check(worker.includes("o.status==='REDEEMED'"), 'Redeemed commission gate is missing');
check(worker.includes("NOT EXISTS(SELECT 1 FROM order_disputes"), 'Dispute gate is missing from commission release/payout');
check(worker.includes("url.pathname==='/api/admin/order-complaints'"), 'Admin-only complaint route is missing');
check(worker.includes("code:'CUSTOMER_SERVICE_ONLY'"), 'Buyer self-service dispute is not blocked');
check(worker.includes("operation==='APPROVE_REFUND'"), 'Manual refund approval operation is missing');
check(worker.includes("operation==='MARK_REFUNDED'"), 'Gateway refund confirmation operation is missing');
check(worker.includes("INSERT INTO refunds("), 'Refund approval does not write the existing D1 refunds ledger');
check(worker.includes("status='RESOLVED_NO_REFUND'"), 'No-refund resolution does not use the frozen D1 status');
check(worker.includes("status='RESOLVED_REFUND'"), 'Refund resolution does not use the frozen D1 status');
check(!/order_disputes SET status='(?:CLOSED_NO_REFUND|REFUND_APPROVED|REFUNDED)'/.test(worker), 'Worker uses a dispute status rejected by the frozen D1 CHECK constraint');
check(worker.includes("status IN ('REQUESTED','PAID')"), 'Refund does not guard already locked Partner payouts');
check(worker.includes("o.status IN ('REDEEMED','EXPIRED')"), 'Merchant settlement does not include non-refundable expired pickups');
check(worker.includes('commission_amount_x10000'), 'Worker does not use the final frozen Step2H commission unit column');
check(worker.includes('amount_x10000'), 'Worker does not use the final frozen Step2H payout item unit column');
check(!/\bcommission_amount\b(?!_x10000)/.test(worker), 'Worker revives the superseded pre-Step2H commission_amount column');

const ecpayStart = worker.indexOf('async function ecpayReturn');
const verifyStart = worker.indexOf('async function verifyOrder');
const consentStart = worker.indexOf('async function recordConsent');
const ecpayBody = worker.slice(ecpayStart, verifyStart);
const verifyBody = worker.slice(verifyStart, consentStart);
check(!ecpayBody.includes('createCommission('), 'ECPay callback still creates commission before redemption');
check(verifyBody.includes('createCommission('), 'verifyOrder does not create commission after redemption');
check(worker.includes("ClientBackURL:`${new URL(request.url).origin}/?d1=1#orders`"), 'ECPay return loses D1 Shadow mode');
check(!worker.includes("'index.html#merchant'"), 'Merchant notification deep link loses D1 Shadow mode');

const expectedActions = [
  'syncCore','syncUser','getShopDashboard','getMerchantLiveState','register','updateStatus','buyItem','verifyOrder',
  'recordConsent','getMerchantOrders','createDispute','getMerchantAnalyticsBundle','getMerchantAnalytics',
  'setShopResponsibleMode','knockShop','setShopWatch','getMyHunts','markHunterNotificationsRead',
  'markHunterNotificationRead','searchPlaceCandidates','recommendPlace','getPartnerOnboarding','submitPartnerIdentity',
  'signReferralContract','savePartnerPayout','getPartnerHub','signContract','upgradeVip'
];
for (const action of expectedActions) check(worker.includes(`case '${action}'`), `Worker action missing: ${action}`);
check(worker.includes("url.pathname==='/api/ecpay/return'"), 'Dedicated ECPay callback route is missing');

check(index.includes('seefood-rc210871-scroll-shell-only'), 'Mobile scroll-shell fix regressed');
check(index.includes('sfCommitHomeFeed30'), 'Home Feed multi-tick commit fix regressed');
check(index.includes('sfScheduleHomeFeedCommit30'), 'Home Feed schedule fix regressed');
check(index.includes("get('d1') === '1'"), 'D1 Shadow switch is missing');
check(index.includes("const gasUrl = __sfD1Shadow ? '/api/action' : legacyGasUrl"), 'D1 action routing is missing');
check(index.includes("__sfD1Shadow?'/api/home':legacyGasUrl"), 'D1 Home Feed routing is missing');
check(index.includes('sfEstablishD1Session30'), 'D1 LINE session handshake is missing');
check(index.includes('D1_SHADOW_LIFF_NOT_CONFIGURED'), 'Shadow LIFF configuration gate is missing');
check(index.includes('?d1=1&liffId='), 'Shadow LIFF redirect does not preserve D1 mode');
check(index.includes('分潤合作約定 v2.0'), 'Frontend Partner contract label is not v2.0');
check(index.includes("seefood_tos_version')==='3.0.2'"), 'Refund policy did not bump the TOS version');
check(index.includes('買家延遲或逾期未取不受理取消／退款'), 'Late-pickup no-refund copy is missing');
check(!index.includes("action:'createDispute'"), 'Frontend still opens a buyer self-service dispute');
check(index.includes('https://line.me/R/ti/p/@398ndwec'), 'Official support handoff is missing');
check(!/VIP\s*\+?\s*150|Plus[^\n]{0,120}(?:分潤|收益)[^\n]{0,80}50%/i.test(index), 'Legacy Plus/VIP commission promise remains in Index');

check(wrangler.name === 'seefood-d1-shadow', `Unsafe Worker name: ${wrangler.name}`);
check(wrangler.d1_databases?.[0]?.database_name === 'seefood-staging', 'D1 binding is not staging');
for (const privatePath of ['worker.js', 'migrations/**', 'tests/**', 'VALIDATION_REPORT.md', 'SHA256SUMS.txt']) {
  check(assetsIgnore.includes(privatePath), `Static assets ignore is missing: ${privatePath}`);
}
check(!fs.existsSync(new URL('guide.html', root)) && !fs.existsSync(new URL('radar.html', root)), 'Guide/Radar must not be included in this package');

const inlineScripts = [...index.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(s => s.trim());
inlineScripts.forEach((source, i) => {
  try { new vm.Script(source, { filename: `index-inline-${i + 1}.js` }); }
  catch (error) { failures.push(`Index inline script ${i + 1} syntax: ${error.message}`); }
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(worker).toString('base64')}`;
const mod = await import(moduleUrl);
const request = (method, env) => mod.default.fetch(new Request('https://seefood.test/api/action?action=updateStatus', { method, body: method === 'POST' ? new URLSearchParams({ action: 'updateStatus', uid: 'U-test' }) : undefined }), env);

let response = await request('GET', {});
check(response.status === 405, `GET mutation expected 405, received ${response.status}`);

response = await request('POST', {});
check(response.status === 503, `Missing LINE session config expected 503, received ${response.status}`);

response = await request('POST', { SESSION_SECRET: 'test-secret', LINE_LOGIN_CHANNEL_ID: 'test-channel' });
check(response.status === 401, `Missing session cookie expected 401, received ${response.status}`);

if (failures.length) {
  console.error(`VALIDATION FAILED (${failures.length})`);
  failures.forEach(x => console.error(`- ${x}`));
  process.exit(1);
}

console.log(`VALIDATION PASS: ${expectedActions.length} GAS actions + ECPay callback; ${inlineScripts.length} Index scripts; security gates verified`);
