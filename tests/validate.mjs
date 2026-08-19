import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const worker = fs.readFileSync(new URL('worker.js', root), 'utf8');
const index = fs.readFileSync(new URL('index.html', root), 'utf8');
const guide = fs.readFileSync(new URL('guide.html', root), 'utf8');
const radar = fs.readFileSync(new URL('radar.html', root), 'utf8');
const wrangler = JSON.parse(fs.readFileSync(new URL('wrangler.jsonc', root), 'utf8'));
const assetsIgnore = fs.readFileSync(new URL('.assetsignore', root), 'utf8');

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

check(worker.includes("const PARTNER_RULE = 'PARTNER-2.0-SERVICE-FEE-ONLY'"), 'Partner rule is not v2 service-fee-only');
check(worker.includes("const RELEASE = '3.0-RC2.10.9.4-D1-PRIMARY'"), 'Primary Worker release marker is missing');
check(worker.includes("mode:'PRIMARY'"), 'Health response does not identify PRIMARY mode');
check(worker.includes("sourceOfTruth:'D1'"), 'Health response does not identify D1 as source of truth');
check(worker.includes("const PARTNER_CONTRACT_VERSION = 'PARTNER-2.0-SERVICE-FEE-ONLY'"), 'Partner contract is not v2');
check(worker.includes('const REFUND_WINDOW_DAYS = 14'), '14-day refund decision window is missing');
check(worker.includes("contract_version=? AND status='SIGNED'"), 'Onboarding does not require the current contract version');
check(worker.includes('PARTNER_CONSENT_VERSION'), 'Partner v2 consent version is missing');
check(worker.includes("request.method!=='POST'"), 'Action endpoint is not POST-only');
check(worker.includes('LINE_SESSION_NOT_CONFIGURED'), 'Missing LINE session is not fail-closed');
check(worker.includes("o.status==='REDEEMED'"), 'Redeemed commission gate is missing');
check(worker.includes('NOT EXISTS(SELECT 1 FROM order_disputes'), 'Dispute gate is missing from commission release/payout');
check(worker.includes("url.pathname==='/api/admin/order-complaints'"), 'Admin-only complaint route is missing');
check(worker.includes("code:'CUSTOMER_SERVICE_ONLY'"), 'Buyer self-service dispute is not blocked');
check(worker.includes("operation==='APPROVE_REFUND'"), 'Manual refund approval operation is missing');
check(worker.includes("operation==='MARK_REFUNDED'"), 'Gateway refund confirmation operation is missing');
check(worker.includes('INSERT INTO refunds('), 'Refund approval does not write the existing D1 refunds ledger');
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
check(worker.includes("ClientBackURL:`${new URL(request.url).origin}/#orders`"), 'ECPay return does not target the official order page');
check(worker.includes("'index.html#merchant'"), 'Merchant notification deep link is missing');
check(!worker.includes('d1=1'), 'Worker still emits a Shadow-only query flag');

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
check(index.includes("const actionApiUrl = '/api/action'"), 'Official D1 action routing is missing');
check(index.includes("const __homeUrl='/api/home?t='"), 'Official D1 Home Feed routing is missing');
check(index.includes('sfEstablishServerSession30'), 'D1 LINE session handshake is missing');
check(index.includes("const __sfLiffId = '2010392646-KEEBg8gS'"), 'Official LIFF ID is missing');
check(index.includes("get('perf')==='1'"), 'Performance panel is not opt-in');
check(index.includes("document.body.classList.toggle('sf-perf-enabled',window.__SF_PERF_ON)"), 'Performance-panel layout flag is missing');
check(index.includes('const defaultHeroBanners30 = ['), 'Three-entry banner fallback is missing');
check(index.includes('try{startBannerCarousel();}'), 'Banner carousel is not booted independently from the backend');
check(index.includes('.sf-support-handle{display:flex!important}'), 'Support headset visibility override is missing');
check(index.includes('分潤合作約定 v2.0'), 'Frontend Partner contract label is not v2.0');
check(index.includes("seefood_tos_version')==='3.0.2'"), 'Refund policy did not bump the TOS version');
check(index.includes('買家延遲或逾期未取不受理取消／退款'), 'Late-pickup no-refund copy is missing');
check(!index.includes("action:'createDispute'"), 'Frontend still opens a buyer self-service dispute');
check(index.includes('https://line.me/R/ti/p/@398ndwec'), 'Official support handoff is missing');
check(!/VIP\s*\+?\s*150|Plus[^\n]{0,120}(?:分潤|收益)[^\n]{0,80}50%/i.test(index), 'Legacy Plus/VIP commission promise remains in Index');
check(!/(?:legacyGasUrl|__sfD1Shadow|D1_SHADOW|staging LIFF|d1=1)/.test(index), 'Index still contains Shadow/GAS fallback runtime');
check(!/script\.google|googleusercontent\.com\/macros/i.test(index), 'Index still contains a Google Apps Script endpoint');

check(guide.includes('SEEFOOD GUIDE 3.3.3'), 'Updated Guide version is missing');
check(guide.includes('買家延遲或逾期未取也不受理退款'), 'Guide does not state the late-pickup policy');
check(guide.includes('付款後 14 天內'), 'Guide does not state the manual refund window');
check(guide.includes('Plus、月費與其他加值收入</small><b>0%</b>'), 'Guide does not exclude Plus revenue from commission');
check(!/VIP\s*\+?\s*150|Plus[^\n]{0,120}(?:分潤|收益)[^\n]{0,80}50%/i.test(guide), 'Legacy Plus/VIP commission promise remains in Guide');

check(radar.includes("const HOME_API='/api/home'"), 'Radar does not use the official D1 Home endpoint');
check(radar.includes("const ACTION_API='/api/action'"), 'Radar does not use the official D1 Action endpoint');
check(radar.includes("credentials:'same-origin'"), 'Radar action requests do not carry the server session');
check(!/script\.google|googleusercontent\.com\/macros|d1=1|\bconst GAS\b/i.test(radar), 'Radar still contains a GAS/Shadow runtime path');

check(wrangler.name === 'seefood', `Worker must deploy to the existing official service: ${wrangler.name}`);
check(wrangler.keep_vars === true, 'Deployment does not preserve existing dashboard variables');
check(wrangler.d1_databases?.[0]?.binding === 'DB', 'D1 binding is not DB');
check(wrangler.d1_databases?.[0]?.database_name === 'seefood-staging', 'Existing populated D1 resource was unexpectedly renamed');
check(wrangler.r2_buckets?.[0]?.binding === 'DOCS' && wrangler.r2_buckets?.[0]?.bucket_name === 'seefood-private-docs', 'Private-document R2 binding is missing');
for (const requiredSecret of ['SESSION_SECRET','LINE_LOGIN_CHANNEL_ID','ADMIN_API_KEY','DATA_ENCRYPTION_KEY']) {
  check(wrangler.secrets?.required?.includes(requiredSecret), `Required secret declaration is missing: ${requiredSecret}`);
}
for (const privatePath of ['worker.js', 'migrations/**', 'tests/**', 'VALIDATION_REPORT.md', 'SHA256SUMS.txt']) {
  check(assetsIgnore.includes(privatePath), `Static assets ignore is missing: ${privatePath}`);
}
check(fs.existsSync(new URL('guide.html', root)) && fs.existsSync(new URL('radar.html', root)), 'Guide/Radar are missing from the official package');

const validateInlineScripts = (html, label) => {
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(s => s.trim());
  scripts.forEach((source, i) => {
    try { new vm.Script(source, { filename: `${label}-inline-${i + 1}.js` }); }
    catch (error) { failures.push(`${label} inline script ${i + 1} syntax: ${error.message}`); }
  });
  return scripts.length;
};
const indexScripts = validateInlineScripts(index, 'Index');
const guideScripts = validateInlineScripts(guide, 'Guide');
const radarScripts = validateInlineScripts(radar, 'Radar');

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

console.log(`VALIDATION PASS: ${expectedActions.length} D1 actions + ECPay callback; inline scripts ${indexScripts}/${guideScripts}/${radarScripts}; primary routing and security gates verified`);
