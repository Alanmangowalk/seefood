import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const worker = fs.readFileSync(new URL('worker.js', root), 'utf8');
const index = fs.readFileSync(new URL('index.html', root), 'utf8');
const radar = fs.readFileSync(new URL('radar.html', root), 'utf8');
const wrangler = JSON.parse(fs.readFileSync(new URL('wrangler.jsonc', root), 'utf8'));
const assetsIgnore = fs.readFileSync(new URL('.assetsignore', root), 'utf8');

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

check(worker.includes("const PARTNER_RULE = 'PARTNER-2.0-SERVICE-FEE-ONLY'"), 'Partner rule is not v2 service-fee-only');
check(worker.includes("const RELEASE = '3.0-RC2.14.0-D1-MAIN-CANDIDATE'"), 'Worker main-candidate release marker is missing');
check(worker.includes("const PARTNER_CONTRACT_VERSION = 'PARTNER-2.0-SERVICE-FEE-ONLY'"), 'Partner contract is not v2');
check(worker.includes('const REFUND_WINDOW_DAYS = 14'), '14-day refund decision window is missing');
check(worker.includes('plus_billing_charges'), 'Plus deferred billing ledger is missing');
check(worker.includes("code:'PLUS_BALANCE_DUE'"), 'Plus re-upgrade debt gate is missing');
check(worker.includes('async function closeSettlementPeriod'), 'Merchant settlement close foundation is missing');
check(worker.includes("operation||'')!=='CLOSE_PERIOD'"), 'Admin settlement close operation is missing');
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
check(worker.includes("ClientBackURL:`${new URL(request.url).origin}/#orders`"), 'ECPay return does not return to the main site');
check(!worker.includes('?d1=1'), 'Worker still emits Shadow deep links');

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
check(!index.includes('legacyGasUrl'), 'Legacy GAS runtime URL is still present in the main site');
check(!index.includes('__sfD1Shadow'), 'Shadow query switch is still present in the main site');
check(index.includes("const gasUrl = '/api/action'"), 'Main-site action routing is not fixed to Worker + D1');
check(index.includes("const __homeUrl='/api/home?t='"), 'Main-site Home Feed is not fixed to Worker + D1');
check(index.includes('sfEstablishD1Session30'), 'LINE server-session handshake is missing');
check(index.includes("const __sfLiffId = __sfProductionLiffId"), 'Main site is not fixed to the production LIFF ID');
check(!index.includes('?d1=1'), 'Shadow query parameters still exist in Index');
check(index.includes('分潤合作約定 v2.0'), 'Frontend Partner contract label is not v2.0');
check(index.includes("seefood_tos_version')==='3.0.2'"), 'Refund policy did not bump the TOS version');
check(index.includes('買家延遲或逾期未取不受理取消／退款'), 'Late-pickup no-refund copy is missing');
check(!index.includes("action:'createDispute'"), 'Frontend still opens a buyer self-service dispute');
check(index.includes('https://line.me/R/ti/p/@398ndwec'), 'Official support handoff is missing');
check(!/VIP\s*\+?\s*150|Plus[^\n]{0,120}(?:分潤|收益)[^\n]{0,80}50%/i.test(index), 'Legacy Plus/VIP commission promise remains in Index');

check(wrangler.name === 'seefood', `Main Worker name should be seefood, received: ${wrangler.name}`);
check(wrangler.d1_databases?.[0]?.database_name === 'seefood-staging', 'Current live D1 binding changed unexpectedly; review data migration before renaming');
check(wrangler.vars?.LINE_LOGIN_CHANNEL_ID === '2010392646', 'Production LINE Login channel ID is not pinned as a non-secret Worker variable');
check(wrangler.secrets?.required?.includes('SESSION_SECRET'), 'SESSION_SECRET is not declared as a required deployment secret');
check(!wrangler.secrets?.required?.includes('LINE_LOGIN_CHANNEL_ID'), 'LINE_LOGIN_CHANNEL_ID should be a normal variable, not a required secret');
for (const privatePath of ['worker.js', 'migrations/**', 'tests/**', 'VALIDATION_REPORT.md', 'SHA256SUMS.txt']) {
  check(assetsIgnore.includes(privatePath), `Static assets ignore is missing: ${privatePath}`);
}
check(fs.existsSync(new URL('guide.html', root)) && fs.existsSync(new URL('radar.html', root)), 'Main-site package must include Guide and Radar');

check(index.includes("let targetShopFocusId = ''"), 'Main-site target-shop focus state is missing');
check(index.includes("if (targetShopFocusId) filtered = filtered.filter"), 'targetShopId does not narrow Home Feed to the selected shop');
check(radar.includes('>前往獵場</button>'), 'Radar CTA label was not restored to 前往獵場');
check(!radar.includes('>地圖查看</button>'), 'Legacy 地圖查看 CTA remains in Radar');
check(radar.includes("location.href=`/?${q.toString()}#home`"), 'Radar 前往獵場 does not return to the canonical SEEFOOD main site');

check(index.includes('const vip = s.isVip ? 10 : 0;'), 'Plus recommendation weight (+10) is missing');
check(index.includes("if (currentSortMethod === 'recommend') { filtered.forEach(s => s.huntScore = calculateHuntScore(s));"), 'Plus/recommendation score is not confined to Recommend sorting');
check(index.includes("else filtered.sort((a,b) => a.distance - b.distance);"), 'Distance sort is no longer pure distance');
check(index.includes("${s.isVip ? ' <span title=\"SEEFOOD Plus 獵場\""), 'Active Plus identity marker is not shown independently of deep-discount styling');
check(index.includes('let isGoldenVip = s.isVip && s.discountRate <= 0.5;'), 'Plus-only <=5折 priority frame rule is missing');
check(index.includes('不用先付款'), 'Plus deferred-billing copy is missing from the merchant UI');
check(index.includes('清零後即可再次升級'), 'Plus outstanding-balance re-upgrade copy is missing');

const inlineScripts = [...index.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(s => s.trim());
inlineScripts.forEach((source, i) => {
  try { new vm.Script(source, { filename: `index-inline-${i + 1}.js` }); }
  catch (error) { failures.push(`Index inline script ${i + 1} syntax: ${error.message}`); }
});
const radarInlineScripts = [...radar.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(s => s.trim());
radarInlineScripts.forEach((source, i) => {
  try { new vm.Script(source, { filename: `radar-inline-${i + 1}.js` }); }
  catch (error) { failures.push(`Radar inline script ${i + 1} syntax: ${error.message}`); }
});
check(index.includes('<div id="sf-perf-audit" style="display:none">'), 'Main-site PERF HUD is not hidden by default');
check(radar.includes('<body><div id="sf-perf-audit" class="hidden-by-user">'), 'Radar PERF HUD is not hidden by default');

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

console.log(`VALIDATION PASS: ${expectedActions.length} GAS actions + ECPay callback; ${inlineScripts.length} Index scripts; ${radarInlineScripts.length} Radar scripts; security gates verified`);
