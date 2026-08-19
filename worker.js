const APP_NAME = 'SEEFOOD';
const DB_NAME = 'seefood-primary';
const RELEASE = '3.0-RC2.10.9.4-D1-PRIMARY';
const PARTNER_RULE = 'PARTNER-2.0-SERVICE-FEE-ONLY';
const PARTNER_CONTRACT_VERSION = 'PARTNER-2.0-SERVICE-FEE-ONLY';
const PARTNER_CONSENT_VERSION = '2.0-SERVICE-FEE-ONLY';
const MERCHANT_CONTRACT_VERSION = 'MERCHANT-1.0';
const SERVICE_FEE_RATE = 0.10;
const SERVICE_FEE_MIN = 5;
const SERVICE_FEE_MAX = 20;
const GATEWAY_RATE = 0.0315;
const GATEWAY_MIN = 5;
const PLUS_PRICE = 299;
const BASIC_SLOT_LIMIT = 3;
const PLUS_SLOT_LIMIT = 10;
const HOLD_SECONDS = 90;
const ITEM_TTL_MS = 8 * 60 * 60 * 1000;
const REFUND_WINDOW_DAYS = 14;
const SUPPORT_LINE_URL = 'https://line.me/R/ti/p/@398ndwec';
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function text(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'text/plain; charset=utf-8');
  return new Response(body, { ...init, headers });
}

function clean(v, max = 500) {
  return String(v ?? '').replace(/<\/?[^>]+(>|$)/g, '').replace(/[<>'"\\]/g, '').trim().slice(0, max);
}
function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function int(v, d = 0) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }
function bool(v) { return ['1','true','TRUE','yes','YES'].includes(String(v)); }
function id(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
function isoNow() { return new Date().toISOString(); }
function addMs(iso, ms) { return new Date(new Date(iso).getTime() + ms).toISOString(); }
function twDateKey(date = new Date()) { return new Date(date.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10); }
function twDateTimeForEcpay(date = new Date()) {
  const d = new Date(date.getTime() + TZ_OFFSET_MS).toISOString();
  return `${d.slice(0,10).replace(/-/g,'/')} ${d.slice(11,19)}`;
}
function twPeriod(date = new Date()) {
  const d = new Date(date.getTime() + TZ_OFFSET_MS);
  const ym = d.toISOString().slice(0,7);
  return `${ym}-${d.getUTCDate() <= 15 ? 'A' : 'B'}`;
}
function periodBounds(period) {
  const m = /^(\d{4})-(\d{2})-([AB])$/.exec(String(period || ''));
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), half = m[3];
  const startLocal = half === 'A' ? Date.UTC(y, mo - 1, 1) : Date.UTC(y, mo - 1, 16);
  const endLocal = half === 'A' ? Date.UTC(y, mo - 1, 16) : Date.UTC(y, mo, 1);
  return {
    start: new Date(startLocal - TZ_OFFSET_MS).toISOString(),
    end: new Date(endLocal - TZ_OFFSET_MS).toISOString()
  };
}
function previousPeriod(period) {
  const m = /^(\d{4})-(\d{2})-([AB])$/.exec(String(period || ''));
  if (!m) return '';
  const y = Number(m[1]), mo = Number(m[2]), h = m[3];
  if (h === 'B') return `${m[1]}-${m[2]}-A`;
  const d = new Date(Date.UTC(y, mo - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-B`;
}
function parseLocalPickup(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    return new Date(`${s}${s.length === 16 ? ':00' : ''}+08:00`).toISOString();
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function legacyStatus(s) {
  return ({PAYMENT_PENDING:'Pending',PAID:'Paid',REDEEMED:'Redeemed',PAYMENT_FAILED:'PaymentFailed',CANCELLED:'Cancelled',EXPIRED:'Expired',ABNORMAL_REVIEW:'PaymentLateSuccess',DISPUTED:'Disputed',REFUND_PENDING:'RefundPending',REFUNDED:'Refunded'})[String(s)] || String(s || '');
}
function normalizeVerified(s) { return ['VERIFIED','VERIFIED_BASIC'].includes(String(s || '').toUpperCase()); }
function serviceFee(price) { return Math.max(SERVICE_FEE_MIN, Math.min(SERVICE_FEE_MAX, Math.round(num(price) * SERVICE_FEE_RATE))); }
function gatewayFee(price) { const p = num(price); return p > 0 ? Math.max(GATEWAY_MIN, Math.round(p * GATEWAY_RATE)) : 0; }
function minIso(...values) {
  const ds = values.filter(Boolean).map(x => new Date(x)).filter(d => !Number.isNaN(d.getTime()));
  return ds.length ? new Date(Math.min(...ds.map(d => d.getTime()))).toISOString() : null;
}
function toLegacyContract(status) { return String(status || '').toUpperCase() === 'SIGNED' ? '已完成' : 'PENDING_REVIEW'; }

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,'0')).join('');
}

function b64urlBytes(bytes) {
  let bin=''; for(const b of new Uint8Array(bytes))bin+=String.fromCharCode(b);
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64urlText(value) { return b64urlBytes(new TextEncoder().encode(String(value))); }
function b64urlDecodeText(value) {
  const s=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
  const pad=s+'='.repeat((4-s.length%4)%4),bin=atob(pad),out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
  return new TextDecoder().decode(out);
}
async function hmacSignature(secret,value) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(secret)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return b64urlBytes(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(String(value))));
}
function parseCookies(request) {
  const out={}; for(const part of String(request.headers.get('Cookie')||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=part.slice(i+1).trim();}
  return out;
}
async function makeSessionCookie(env,uid,maxAge=3600) {
  const payload=b64urlText(JSON.stringify({uid:String(uid),exp:Math.floor(Date.now()/1000)+maxAge})),sig=await hmacSignature(env.SESSION_SECRET,payload);
  return `sf_session=${payload}.${sig}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
async function sessionUser(env,request) {
  if(!env.SESSION_SECRET)return null;
  const raw=parseCookies(request).sf_session;if(!raw)return null;
  const i=raw.lastIndexOf('.');if(i<=0)return null;const payload=raw.slice(0,i),sig=raw.slice(i+1),expected=await hmacSignature(env.SESSION_SECRET,payload);
  if(sig.length!==expected.length)return null;let diff=0;for(let j=0;j<sig.length;j++)diff|=sig.charCodeAt(j)^expected.charCodeAt(j);if(diff)return null;
  try{const data=JSON.parse(b64urlDecodeText(payload));if(!data.uid||num(data.exp)<=Math.floor(Date.now()/1000))return null;return String(data.uid);}catch(_e){return null;}
}
async function lineSessionLogin(env,p) {
  if(!env.SESSION_SECRET||!env.LINE_LOGIN_CHANNEL_ID)return {response:json({status:'config_required',code:'LINE_SESSION_NOT_CONFIGURED',msg:'LINE 登入服務尚未設定 LINE_LOGIN_CHANNEL_ID 與 SESSION_SECRET'},{status:503})};
  const token=String(p.accessToken||'').trim();if(!token)return {response:json({status:'error',msg:'缺少 LINE access token'},{status:401})};
  const verify=await fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(token)}`);
  if(!verify.ok)return {response:json({status:'error',msg:'LINE 登入憑證無效或已過期'},{status:401})};
  const v=await verify.json();if(String(v.client_id||'')!==String(env.LINE_LOGIN_CHANNEL_ID)||num(v.expires_in)<=0)return {response:json({status:'error',msg:'LINE 登入憑證不屬於 SEEFOOD'},{status:401})};
  const profileRes=await fetch('https://api.line.me/v2/profile',{headers:{Authorization:`Bearer ${token}`}});if(!profileRes.ok)return {response:json({status:'error',msg:'無法取得 LINE 使用者資料'},{status:401})};
  const profile=await profileRes.json(),uid=String(profile.userId||'');if(!uid)return {response:json({status:'error',msg:'LINE 使用者識別失敗'},{status:401})};
  await ensureUser(env,uid,'LINE_VERIFIED');const maxAge=Math.max(300,Math.min(3600,num(v.expires_in,3600))),cookie=await makeSessionCookie(env,uid,maxAge);
  return {response:json({status:'success',userId:uid,sessionExpiresIn:maxAge},{headers:{'Set-Cookie':cookie}})};
}
async function enforceActionSession(env,request,p) {
  if(!env.SESSION_SECRET||!env.LINE_LOGIN_CHANNEL_ID)return {status:'config_required',httpStatus:503,code:'LINE_SESSION_NOT_CONFIGURED',msg:'D1 後台尚未啟用 LINE server session'};
  const uid=await sessionUser(env,request);if(!uid)return {status:'error',code:'SESSION_REQUIRED',msg:'LINE 登入驗證已失效，請重新登入'};
  const claimed=String(p.uid||p.lineUid||p.buyerUid||'');if(claimed&&claimed!=='LINE_GUEST'&&claimed!==uid)return {status:'error',code:'IDENTITY_MISMATCH',msg:'登入身分不一致'};
  p.uid=uid;if(Object.prototype.hasOwnProperty.call(p,'lineUid'))p.lineUid=uid;if(Object.prototype.hasOwnProperty.call(p,'buyerUid'))p.buyerUid=uid;
  return null;
}
async function encryptSensitive(env, value) {
  if (!env.DATA_ENCRYPTION_KEY) throw new Error('DATA_ENCRYPTION_KEY_NOT_CONFIGURED');
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(env.DATA_ENCRYPTION_KEY)));
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, new TextEncoder().encode(String(value)));
  const enc = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return JSON.stringify({v:1,iv:enc(iv),ct:enc(ct)});
}
function base64Bytes(s) {
  const raw = String(s || '').replace(/^data:[^,]+,/, '');
  const bin = atob(raw);
  const out = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
  return out;
}
function isValidTwId(idv) {
  const v = String(idv||'').toUpperCase();
  if (!/^[A-Z][12]\d{8}$/.test(v)) return false;
  const codes={A:10,B:11,C:12,D:13,E:14,F:15,G:16,H:17,I:34,J:18,K:19,L:20,M:21,N:22,O:35,P:23,Q:24,R:25,S:26,T:27,U:28,V:29,W:32,X:30,Y:31,Z:33};
  const c=codes[v[0]]; if(!c)return false;
  let sum=Math.floor(c/10)+(c%10)*9;
  for(let i=1;i<=8;i++) sum+=Number(v[i])*(9-i);
  sum+=Number(v[9]); return sum%10===0;
}
function isValidTaxId(idv) {
  const v=String(idv||''); if(!/^\d{8}$/.test(v))return false;
  const w=[1,2,1,2,1,2,4,1];let sum=0;
  for(let i=0;i<8;i++){const p=Number(v[i])*w[i];sum+=Math.floor(p/10)+(p%10);}
  return sum%5===0||(v[6]==='7'&&(sum+1)%5===0);
}
function kycRisk(p) {
  const iw=int(p.imageWidth), ih=int(p.imageHeight), fs=int(p.imageFileSize), variance=num(p.imageVariance), brightness=num(p.imageBrightness);
  const sigLen=num(p.signatureLength), sigW=num(p.signatureWidth), sigH=num(p.signatureHeight), sigTurns=int(p.signatureTurns), sigStrokes=int(p.signatureStrokes);
  const signerId=clean(p.signerId,30).toUpperCase(), isPersonal=/^[A-Z]/.test(signerId), idOk=isPersonal?isValidTwId(signerId):isValidTaxId(signerId);
  const ocrAvailable=String(p.ocrAvailable||'0')==='1', ocrMatch=String(p.ocrIdMatched||'0')==='1';
  let imageScore=0; if(iw>=1000&&ih>=600)imageScore+=35;else if(iw>=700&&ih>=450)imageScore+=22; if(fs>=90000)imageScore+=20;else if(fs>=45000)imageScore+=10; if(variance>=24)imageScore+=25;else if(variance>=14)imageScore+=12; if(brightness>=45&&brightness<=215)imageScore+=20;else if(brightness>=28&&brightness<=235)imageScore+=10; imageScore=Math.min(100,imageScore);
  let sigScore=0; if(sigLen>=420)sigScore+=30;else if(sigLen>=260)sigScore+=18; if(sigW>=120)sigScore+=20;else if(sigW>=80)sigScore+=10; if(sigH>=42)sigScore+=18;else if(sigH>=28)sigScore+=8; if(sigTurns>=6&&sigTurns<=120)sigScore+=17;else if(sigTurns>=3)sigScore+=8; if(sigStrokes>=2&&sigStrokes<=20)sigScore+=15; sigScore=Math.min(100,sigScore);
  const idScore=idOk?100:0;
  if(!idOk||imageScore<65||sigScore<62||sigStrokes<2)return {status:'RESUBMIT_REQUIRED',riskScore:Math.round(imageScore*.35+sigScore*.30+idScore*.20),imageScore,signatureScore:sigScore,idFormatScore:idScore};
  if(ocrAvailable&&!ocrMatch)return {status:'RESUBMIT_REQUIRED',riskScore:55,imageScore,signatureScore:sigScore,idFormatScore:idScore};
  if(!ocrAvailable)return {status:'MANUAL_REVIEW',riskScore:68,imageScore,signatureScore:sigScore,idFormatScore:idScore};
  const riskScore=Math.round(imageScore*.35+sigScore*.30+idScore*.20+15);
  return {status:riskScore>=78?'VERIFIED':'MANUAL_REVIEW',riskScore,imageScore,signatureScore:sigScore,idFormatScore:idScore};
}

async function formParams(request) {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) return await request.json();
  const fd = await request.formData(); const o={}; for(const [k,v] of fd.entries()) o[k]=typeof v==='string'?v:String(v); return o;
}
async function ensureUser(env, uid, source='WEB') {
  if(!uid||uid==='LINE_GUEST') return;
  const now=isoNow();
  await env.DB.prepare(`INSERT INTO users(user_id,status,source,created_at,updated_at,last_seen_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET updated_at=excluded.updated_at,last_seen_at=excluded.last_seen_at`).bind(uid,'ACTIVE',source,now,now,now).run();
}
async function ownedShop(env, uid, shopId) {
  if(!uid||!shopId)return null;
  return await env.DB.prepare(`SELECT s.* FROM shop_members sm JOIN shops s ON s.shop_id=sm.shop_id WHERE sm.user_id=? AND sm.shop_id=? AND sm.status='ACTIVE' AND sm.role IN ('OWNER','ADMIN') LIMIT 1`).bind(uid,shopId).first();
}
async function activePlus(env, shopId) {
  return !!(await env.DB.prepare(`SELECT 1 x FROM plus_subscriptions WHERE shop_id=? AND status='ACTIVE' AND (ends_at IS NULL OR datetime(ends_at)>CURRENT_TIMESTAMP) LIMIT 1`).bind(shopId).first());
}
async function getOwnerUid(env, shopId) {
  const r=await env.DB.prepare(`SELECT ma.owner_user_id FROM shops s JOIN merchant_accounts ma ON ma.account_id=s.merchant_account_id WHERE s.shop_id=?`).bind(shopId).first();
  return r?.owner_user_id||'';
}
async function latestRule(env) {
  return await env.DB.prepare(`SELECT * FROM partner_rule_versions WHERE rule_version=? LIMIT 1`).bind(PARTNER_RULE).first()
    || await env.DB.prepare(`SELECT * FROM partner_rule_versions WHERE retired_at IS NULL ORDER BY datetime(effective_at) DESC LIMIT 1`).first()
    || {rule_version:PARTNER_RULE,service_fee_rate_bps:5000,review_days:14,inactivity_days:365};
}
async function ensureCurrentPartnerRule(env) {
  await env.DB.prepare(`INSERT OR IGNORE INTO partner_rule_versions(rule_version,eligible_revenue_type,service_fee_rate_bps,plus_eligible,review_days,inactivity_days,effective_at,created_at) VALUES(?,'SERVICE_FEE_ONLY',5000,0,14,365,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).bind(PARTNER_RULE).run();
  return latestRule(env);
}
async function audit(env, {actorType='SYSTEM',actorId=null,action,entityType,entityId=null,before=null,after=null,request=null}) {
  let ipHash=null,ua=null;
  if(request){const ip=request.headers.get('CF-Connecting-IP'); if(ip)ipHash=await sha256Hex(ip);ua=(request.headers.get('User-Agent')||'').slice(0,500);}
  await env.DB.prepare(`INSERT INTO audit_logs(audit_id,actor_type,actor_id,action,entity_type,entity_id,before_json,after_json,ip_hash,user_agent,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(id('AUD'),actorType,actorId,action,entityType,entityId,before?JSON.stringify(before):null,after?JSON.stringify(after):null,ipHash,ua,isoNow()).run();
}

async function health(env) {
  const [counts,rule]=await Promise.all([
    env.DB.prepare(`SELECT (SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM shops) shops,(SELECT COUNT(*) FROM shop_items) shop_items,(SELECT COUNT(*) FROM orders) orders,(SELECT COUNT(*) FROM payments) payments,(SELECT COUNT(*) FROM tickets) tickets`).first(),
    latestRule(env)
  ]);
  return {status:'ok',service:APP_NAME,release:RELEASE,mode:'PRIMARY',sourceOfTruth:'D1',database:DB_NAME,d1:'connected',counts,readiness:{lineSession:(env.SESSION_SECRET&&env.LINE_LOGIN_CHANNEL_ID)?'ENFORCED':'REQUIRED_NOT_CONFIGURED',partnerRule:rule?.rule_version===PARTNER_RULE?'CURRENT':`MISMATCH:${rule?.rule_version||'NONE'}`,refundPolicy:`ADMIN_ONLY_${REFUND_WINDOW_DAYS}D`,ecpay:(env.ECPAY_MERCHANT_ID&&env.ECPAY_HASH_KEY&&env.ECPAY_HASH_IV&&env.ECPAY_URL)?'CONFIGURED':'NOT_CONFIGURED',places:env.GOOGLE_PLACES_API_KEY?'CONFIGURED':'NOT_CONFIGURED',privateDocs:env.DOCS?'CONFIGURED':'NOT_CONFIGURED',encryption:env.DATA_ENCRYPTION_KEY?'CONFIGURED':'NOT_CONFIGURED'}};
}

async function homeFeed(env) {
  const started=Date.now(), today=twDateKey();
  const [summary,merchants,items,growth,orderDays,banners]=await Promise.all([
    env.DB.prepare(`SELECT (SELECT COUNT(*) FROM shops WHERE status='ACTIVE') registered_stores,(SELECT COUNT(*) FROM orders) food_orders`).first(),
    env.DB.prepare(`SELECT s.shop_id,s.name,s.city,s.district,s.latitude,s.longitude,s.address,s.phone,s.created_at,COALESCE(bp.merchant_type,'公司/行號') merchant_type,CASE WHEN ps.shop_id IS NULL THEN 0 ELSE 1 END is_plus,ma.kyc_status,CASE WHEN mc.shop_id IS NULL THEN 'PENDING_REVIEW' ELSE 'SIGNED' END contract_status FROM shops s JOIN merchant_accounts ma ON ma.account_id=s.merchant_account_id LEFT JOIN shop_business_profiles bp ON bp.shop_id=s.shop_id LEFT JOIN (SELECT DISTINCT shop_id FROM plus_subscriptions WHERE status='ACTIVE' AND (ends_at IS NULL OR datetime(ends_at)>CURRENT_TIMESTAMP)) ps ON ps.shop_id=s.shop_id LEFT JOIN (SELECT DISTINCT shop_id FROM merchant_contracts WHERE status='SIGNED') mc ON mc.shop_id=s.shop_id WHERE s.status='ACTIVE' ORDER BY datetime(s.created_at),s.shop_id`).all(),
    env.DB.prepare(`SELECT i.item_id,i.shop_id,i.slot_index,i.item_type,i.name item_name,i.description,i.original_price,i.sale_price,i.current_stock,i.pickup_cutoff,i.updated_at,s.name shop_name,s.city,s.district,s.address,s.phone,s.latitude,s.longitude,COALESCE(bp.merchant_type,'公司/行號') merchant_type,CASE WHEN ps.shop_id IS NULL THEN 0 ELSE 1 END is_plus,ses.opened_at,ses.auto_close_at FROM shop_items i JOIN shops s ON s.shop_id=i.shop_id JOIN item_sale_sessions ses ON ses.item_id=i.item_id AND ses.status='OPEN' AND datetime(ses.auto_close_at)>CURRENT_TIMESTAMP LEFT JOIN shop_business_profiles bp ON bp.shop_id=s.shop_id LEFT JOIN (SELECT DISTINCT shop_id FROM plus_subscriptions WHERE status='ACTIVE' AND (ends_at IS NULL OR datetime(ends_at)>CURRENT_TIMESTAMP)) ps ON ps.shop_id=s.shop_id WHERE s.status='ACTIVE' AND i.status='ON' AND i.current_stock>0 AND COALESCE(i.item_type,'')<>'暫不使用' AND (ps.shop_id IS NOT NULL OR i.slot_index<=3) AND (i.pickup_cutoff IS NULL OR datetime(i.pickup_cutoff)>CURRENT_TIMESTAMP) ORDER BY s.shop_id,i.slot_index`).all(),
    env.DB.prepare(`SELECT s.shop_id,COALESCE(k.knock_today,0) knock_today,COALESCE(w.watchers,0) watchers FROM shops s LEFT JOIN (SELECT shop_id,COUNT(*) knock_today FROM knock_requests WHERE knock_date=? GROUP BY shop_id) k ON k.shop_id=s.shop_id LEFT JOIN (SELECT shop_id,COUNT(*) watchers FROM shop_watchlist WHERE status='ACTIVE' GROUP BY shop_id) w ON w.shop_id=s.shop_id WHERE s.status='ACTIVE'`).bind(today).all(),
    env.DB.prepare(`SELECT DISTINCT shop_id,date(COALESCE(redeemed_at,paid_at,created_at),'+8 hours') sale_day FROM orders WHERE status IN ('PAID','REDEEMED')`).all(),
    env.DB.prepare(`SELECT image_url,title,subtitle,kicker,cta_text,link_type,link_target,sort_order FROM banners WHERE placement='HOME' AND status='ACTIVE' AND (starts_at IS NULL OR datetime(starts_at)<=CURRENT_TIMESTAMP) AND (ends_at IS NULL OR datetime(ends_at)>CURRENT_TIMESTAMP) ORDER BY sort_order,datetime(created_at)`).all()
  ]);
  const gmap=new Map((growth.results||[]).map(r=>[String(r.shop_id),{knockToday:num(r.knock_today),watchers:num(r.watchers)}]));
  const days=new Map(); for(const r of orderDays.results||[]){const k=String(r.shop_id);if(!days.has(k))days.set(k,new Set());if(r.sale_day)days.get(k).add(String(r.sale_day));}
  const districtActive=new Map(), seen=new Set(); for(const r of items.results||[]){if(seen.has(r.shop_id))continue;seen.add(r.shop_id);const d=r.district||'全部行政區';districtActive.set(d,(districtActive.get(d)||0)+1);}
  function streak(shopId){let n=0;for(let i=0;i<14;i++){const d=new Date(Date.now()-i*86400000),k=twDateKey(d);if(days.get(String(shopId))?.has(k))n++;else if(i!==0)break;}return n;}
  const intelligence=new Map();
  const stores=(items.results||[]).map(r=>{const sid=String(r.shop_id),district=r.district||'全部行政區',streakN=streak(sid),tags=[];if((districtActive.get(district)||0)===1)tags.push('🐺 本區孤勇者');const lastOnline=r.updated_at||r.opened_at||'';const o={shopId:sid,itemIndex:num(r.slot_index),name:r.shop_name||'未命名店鋪',time:r.pickup_cutoff||'',itemType:r.item_type||'',item:r.item_name||'',note:r.description||'',originalPrice:num(r.original_price),discountPrice:num(r.sale_price),remain:num(r.current_stock),city:r.city||'全部地區',district,address:r.address||'',phone:r.phone||'',lat:num(r.latitude),lng:num(r.longitude),isVip:!!r.is_plus,tags,streak:streakN,lastOnline}; if(!intelligence.has(sid))intelligence.set(sid,{activeItems:0,totalRemain:0,lastOnline:'',tags:[]});const x=intelligence.get(sid);x.activeItems++;x.totalRemain+=o.remain;x.lastOnline=o.lastOnline||x.lastOnline;tags.forEach(t=>{if(!x.tags.includes(t))x.tags.push(t)});return o;});
  const allMerchants=(merchants.results||[]).map(r=>{const sid=String(r.shop_id),isVip=!!r.is_plus,verified=normalizeVerified(r.kyc_status)||String(r.contract_status)==='SIGNED',x=intelligence.get(sid)||{activeItems:0,totalRemain:0,lastOnline:'',tags:[]},g=gmap.get(sid)||{knockToday:0,watchers:0};return {shopId:sid,name:r.name||'未命名店鋪',city:r.city||'全部地區',district:r.district||'全部行政區',lat:num(r.latitude),lng:num(r.longitude),address:r.address||'',phone:r.phone||'',merchantType:r.merchant_type||'公司/行號',isVip,contractStatus:toLegacyContract(r.contract_status),verified,...x,title:isVip?'Plus 獵場':verified?'實名獵場':'新進獵場',knockToday:g.knockToday,watchers:g.watchers};});
  const latestNews=allMerchants.slice().reverse().slice(0,8).map(m=>({type:'NEW_SHOP',text:`${m.city||''} ${m.district||''}｜${m.name||'新獵場'} 加入 SEEFOOD`,shopId:m.shopId}));
  const outB=(banners.results||[]).map(r=>({imgUrl:r.image_url||'',title:r.title||'SEEFOOD 美食獵人',type:({EXTERNAL:'外部',INTERNAL:'內部',PAGE:'頁面'})[String(r.link_type||'').toUpperCase()]||r.link_type||'內部',link:r.link_target||'',subtitle:r.subtitle||'',cta:r.cta_text||'開始探索',kicker:r.kicker||'SEEFOOD 美食獵人',sort:num(r.sort_order,999)}));
  return {status:'success',totalSavedKg:1285.5+num(summary?.food_orders)*0.5,registeredStores:num(summary?.registered_stores),allMerchants,banners:outB,stores,latestNews,_perf:{route:'HOME_FEED_D1',database:DB_NAME,totalMs:Date.now()-started,stores:stores.length,merchants:allMerchants.length}};
}

async function getOwnedShops(env, uid) {
  const r=await env.DB.prepare(`SELECT s.shop_id,s.name shop_name,COALESCE(bp.merchant_type,'🟢 具備統編之公司 / 行號') merchant_type,CASE WHEN ps.shop_id IS NULL THEN 0 ELSE 1 END is_plus,CASE WHEN mc.shop_id IS NULL THEN 'PENDING_REVIEW' ELSE 'SIGNED' END contract_status FROM shop_members sm JOIN shops s ON s.shop_id=sm.shop_id LEFT JOIN shop_business_profiles bp ON bp.shop_id=s.shop_id LEFT JOIN (SELECT DISTINCT shop_id FROM plus_subscriptions WHERE status='ACTIVE' AND (ends_at IS NULL OR datetime(ends_at)>CURRENT_TIMESTAMP)) ps ON ps.shop_id=s.shop_id LEFT JOIN (SELECT DISTINCT shop_id FROM merchant_contracts WHERE status='SIGNED') mc ON mc.shop_id=s.shop_id WHERE sm.user_id=? AND sm.status='ACTIVE' AND sm.role IN ('OWNER','ADMIN') AND s.status='ACTIVE' ORDER BY datetime(s.created_at),s.shop_id`).bind(uid).all();
  return (r.results||[]).map(x=>({shopId:x.shop_id,shopName:x.shop_name,isVip:!!x.is_plus,contractStatus:toLegacyContract(x.contract_status),merchantType:x.merchant_type}));
}
async function userOrders(env, uid, limit=30) {
  const r=await env.DB.prepare(`SELECT o.*,s.name store,s.address,s.phone,oi.item_name_snapshot item_name FROM orders o JOIN shops s ON s.shop_id=o.shop_id LEFT JOIN order_items oi ON oi.order_id=o.order_id WHERE o.user_id=? AND o.status IN ('PAID','REDEEMED','EXPIRED','REFUNDED','DISPUTED','REFUND_PENDING') ORDER BY datetime(o.created_at) DESC LIMIT ?`).bind(uid,limit).all();
  return (r.results||[]).map((o,i)=>({id:i+1,orderId:o.order_id,shopId:o.shop_id,store:o.store,item:o.item_name||'',price:num(o.subtotal),time:o.pickup_deadline||o.pickup_at||'今日限時',date:o.created_at||'',verifyTime:o.redeemed_at||'',status:legacyStatus(o.status),used:o.status==='REDEEMED',expired:o.status==='EXPIRED',address:o.address||'',phone:o.phone||''}));
}
async function growthStats(env, uid) {
  const r=await env.DB.prepare(`SELECT COUNT(*) recommendations,SUM(CASE WHEN c.joined_shop_id IS NOT NULL THEN 1 ELSE 0 END) joined FROM store_recommendations sr JOIN store_candidates c ON c.candidate_id=sr.candidate_id WHERE sr.user_id=?`).bind(uid).first();
  return {recommendations:num(r?.recommendations),joinedRecommendations:num(r?.joined)};
}
async function syncCore(env,p) {
  const uid=String(p.uid||p.lineUid||''); if(!uid||uid==='LINE_GUEST')return {status:'error',msg:'LOGIN_REQUIRED'}; await ensureUser(env,uid,'LINE');
  const [shops,orders,acc,unread,tickets,growth]=await Promise.all([
    getOwnedShops(env,uid),userOrders(env,uid,30),
    env.DB.prepare(`SELECT ma.* FROM merchant_accounts ma WHERE ma.owner_user_id=? AND ma.status='ACTIVE' ORDER BY datetime(ma.created_at) LIMIT 1`).bind(uid).first(),
    env.DB.prepare(`SELECT COUNT(*) n FROM notifications WHERE user_id=? AND audience_type='HUNTER' AND status='UNREAD'`).bind(uid).first(),
    env.DB.prepare(`SELECT COUNT(*) n FROM tickets WHERE user_id=? AND status='ACTIVE' AND datetime(pickup_deadline)>CURRENT_TIMESTAMP`).bind(uid).first(),
    growthStats(env,uid)
  ]);
  return {status:'success',myShops:shops,orders,activeTicketCount:num(tickets?.n),merchantAccount:acc?{accountId:acc.account_id,kycStatus:normalizeVerified(acc.kyc_status)?'VERIFIED_BASIC':acc.kyc_status,payoutStatus:normalizeVerified(acc.payout_status)?'VERIFIED_BASIC':acc.payout_status,signerName:acc.signer_name||'',bankOwner:''}:null,growthStats:growth,hunterNoticeCount:num(unread?.n),hunterSignalCount:num(unread?.n),schemaVersion:'3.1.2'};
}

async function financeForPeriod(env,shopId,period) {
  const b=periodBounds(period); if(!b)return {sales:0,reviewHold:0,gatewayFee:0,plusFee:0,netIncome:0};
  const refundCutoff=addMs(isoNow(),-REFUND_WINDOW_DAYS*86400000);
  const [o,ps]=await Promise.all([
    env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN datetime(o.paid_at)<=datetime(?) AND NOT EXISTS(SELECT 1 FROM order_disputes d WHERE d.order_id=o.order_id AND d.status NOT IN ('RESOLVED_NO_REFUND','RESOLVED_REFUND','REJECTED','CANCELLED')) THEN o.subtotal ELSE 0 END),0) sales,COALESCE(SUM(CASE WHEN NOT(datetime(o.paid_at)<=datetime(?) AND NOT EXISTS(SELECT 1 FROM order_disputes d WHERE d.order_id=o.order_id AND d.status NOT IN ('RESOLVED_NO_REFUND','RESOLVED_REFUND','REJECTED','CANCELLED'))) THEN o.subtotal ELSE 0 END),0) review_hold,COALESCE(SUM(CASE WHEN datetime(o.paid_at)<=datetime(?) AND NOT EXISTS(SELECT 1 FROM order_disputes d WHERE d.order_id=o.order_id AND d.status NOT IN ('RESOLVED_NO_REFUND','RESOLVED_REFUND','REJECTED','CANCELLED')) AND o.subtotal>0 THEN MAX(?,ROUND(o.subtotal*?)) ELSE 0 END),0) gateway FROM orders o WHERE o.shop_id=? AND o.status IN ('REDEEMED','EXPIRED') AND datetime(COALESCE(o.redeemed_at,o.paid_at,o.created_at))>=datetime(?) AND datetime(COALESCE(o.redeemed_at,o.paid_at,o.created_at))<datetime(?)`).bind(refundCutoff,refundCutoff,refundCutoff,GATEWAY_MIN,GATEWAY_RATE,shopId,b.start,b.end).first(),
    env.DB.prepare(`SELECT COUNT(*) n FROM plus_subscriptions WHERE shop_id=? AND datetime(starts_at)>=datetime(?) AND datetime(starts_at)<datetime(?) AND status IN ('ACTIVE','EXPIRED','CANCELLED')`).bind(shopId,b.start,b.end).first()
  ]);
  const sales=num(o?.sales),reviewHold=num(o?.review_hold),gf=num(o?.gateway),pf=num(ps?.n)*PLUS_PRICE; return {sales,reviewHold,gatewayFee:gf,plusFee:pf,netIncome:Math.max(0,sales-gf-pf)};
}
async function merchantLive(env,uid,shopId) {
  if(!await ownedShop(env,uid,shopId))return {status:'error',msg:'無權限管理此店'};
  const today=twDateKey();
  const [orders,k,w,notices]=await Promise.all([
    env.DB.prepare(`SELECT o.order_id,oi.item_name_snapshot item,o.subtotal price,o.pickup_deadline time FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.order_id WHERE o.shop_id=? AND o.status='PAID' ORDER BY datetime(o.paid_at) DESC LIMIT 30`).bind(shopId).all(),
    env.DB.prepare(`SELECT COUNT(*) n FROM knock_requests WHERE shop_id=? AND knock_date=?`).bind(shopId,today).first(),
    env.DB.prepare(`SELECT COUNT(*) n FROM shop_watchlist WHERE shop_id=? AND status='ACTIVE'`).bind(shopId).first(),
    env.DB.prepare(`SELECT notification_id id,notification_type type,title,body,status,created_at createdAt,deep_link deepLink FROM notifications WHERE shop_id=? AND audience_type='MERCHANT' ORDER BY datetime(created_at) DESC LIMIT 8`).bind(shopId).all()
  ]);
  const ns=notices.results||[];return {status:'success',shopId,activeOrders:(orders.results||[]).map(o=>({orderId:o.order_id,item:o.item||'',price:num(o.price),time:o.time||'今日打烊前'})),knockToday:num(k?.n),watchers:num(w?.n),merchantNotices:ns,merchantUnread:ns.filter(n=>n.status==='UNREAD').length,_perf:{route:'MERCHANT_LIVE_D1'}};
}
async function shopDashboard(env,p) {
  const uid=String(p.uid||''),shopId=clean(p.shopId,100); if(!await ownedShop(env,uid,shopId))return {status:'error',msg:'找不到您可管理的店鋪'};
  const curr=twPeriod(),hist=previousPeriod(curr);
  const [shop,slots,live,fc,fh,payout]=await Promise.all([
    env.DB.prepare(`SELECT s.*,ma.account_id,ma.kyc_status,ma.payout_status,ma.signer_name,ma.signer_id_last4,COALESCE(bp.merchant_type,'🟢 具備統編之公司 / 行號') merchant_type,COALESCE(bp.responsible_mode,'SAME') responsible_mode,bp.responsible_name,bp.responsible_phone,COALESCE(bp.kyc_inherited,0) kyc_inherited,CASE WHEN ps.shop_id IS NULL THEN 0 ELSE 1 END is_plus,CASE WHEN mc.shop_id IS NULL THEN 'PENDING_REVIEW' ELSE 'SIGNED' END contract_status FROM shops s JOIN merchant_accounts ma ON ma.account_id=s.merchant_account_id LEFT JOIN shop_business_profiles bp ON bp.shop_id=s.shop_id LEFT JOIN (SELECT DISTINCT shop_id FROM plus_subscriptions WHERE status='ACTIVE' AND (ends_at IS NULL OR datetime(ends_at)>CURRENT_TIMESTAMP)) ps ON ps.shop_id=s.shop_id LEFT JOIN (SELECT DISTINCT shop_id FROM merchant_contracts WHERE status='SIGNED') mc ON mc.shop_id=s.shop_id WHERE s.shop_id=?`).bind(shopId).first(),
    env.DB.prepare(`SELECT * FROM shop_items WHERE shop_id=? ORDER BY slot_index`).bind(shopId).all(),merchantLive(env,uid,shopId),financeForPeriod(env,shopId,curr),financeForPeriod(env,shopId,hist),
    env.DB.prepare(`SELECT mpp.* FROM shops s JOIN merchant_payout_profiles mpp ON mpp.merchant_account_id=s.merchant_account_id WHERE s.shop_id=?`).bind(shopId).first()
  ]);
  if(!shop)return {status:'error',msg:'找不到您可管理的店鋪'};
  const slotRows=(slots.results||[]).filter(s=>!!shop.is_plus||num(s.slot_index)<=BASIC_SLOT_LIMIT), liveSlots=slotRows.map(s=>({index:num(s.slot_index),type:s.item_type||'暫不使用',name:s.name||'',desc:s.description||'',orig:num(s.original_price),rate:num(s.original_price)>0?num(s.sale_price)/num(s.original_price):0,rem:num(s.current_stock),status:s.status,time:s.pickup_cutoff||''}));
  const storeStatus=slotRows.some(s=>s.status==='ON'&&num(s.current_stock)>0)?'ON':'OFF',storeTime=slotRows.find(s=>s.pickup_cutoff)?.pickup_cutoff||'今日打烊前';
  const last5=payout?.bank_account_last5||'';
  const myShop={shopId,shopName:shop.name,isVip:!!shop.is_plus,bCode:payout?.bank_code||'',bBranch:payout?.branch_code||'',bAcc:last5?`••••${last5}`:'',bOwner:payout?.account_holder||'',contractStatus:toLegacyContract(shop.contract_status),merchantType:shop.merchant_type,signerName:shop.signer_name||'',signerId:shop.signer_id_last4?`******${shop.signer_id_last4}`:'',merchantAccount:{accountId:shop.account_id,kycStatus:normalizeVerified(shop.kyc_status)?'VERIFIED_BASIC':shop.kyc_status,payoutStatus:normalizeVerified(shop.payout_status)?'VERIFIED_BASIC':shop.payout_status},shopProfile:{shopId,accountId:shop.account_id,responsibleMode:shop.responsible_mode,responsibleName:shop.responsible_name||'',responsiblePhone:shop.responsible_phone||'',kycInherited:!!shop.kyc_inherited,shopStatus:shop.status,riskStatus:shop.risk_status},finance:{currentPeriod:curr,sales:fc.sales,reviewHold:fc.reviewHold,gatewayFee:fc.gatewayFee,vipFee:fc.plusFee,debtIn:0,netIncome:fc.netIncome,currentStatus:'ACCUMULATING',historyPeriod:hist,historySales:fh.sales,historyReviewHold:fh.reviewHold,historyFee:fh.gatewayFee,historyVipFee:fh.plusFee,historyDebtIn:0,historyNetIncome:fh.netIncome,historyStatus:'AUDITING'},liveSlots,storeStatus,storeTime,activeOrders:live.activeOrders,knockToday:live.knockToday,watchers:live.watchers,merchantUnread:live.merchantUnread,merchantNotices:live.merchantNotices};
  return {status:'success',myShop,_perf:{route:'SHOP_DASHBOARD_D1'}};
}

async function reactivatePartner(env,uid) {
  if(!uid||uid==='LINE_GUEST')return {status:'error',msg:'請先登入 LINE'};
  const profile=await env.DB.prepare(`SELECT partner_status FROM partner_profiles WHERE user_id=?`).bind(uid).first();
  if(!profile)return {status:'error',msg:'尚未建立夥伴身分'};
  if(profile.partner_status==='TERMINATED')return {status:'error',msg:'此夥伴關係已終止，請聯繫 SEEFOOD'};
  if(profile.partner_status==='SUSPENDED')return {status:'error',msg:'此夥伴身分目前暫停，請聯繫 SEEFOOD'};
  const now=isoNow();
  await env.DB.batch([
    env.DB.prepare(`UPDATE partner_profiles SET partner_status='ACTIVE',reactivated_at=?,dormant_at=NULL,updated_at=? WHERE user_id=? AND partner_status='DORMANT'`).bind(now,now,uid),
    env.DB.prepare(`UPDATE referral_relations SET status='ACTIVE',reactivated_at=?,dormant_at=NULL,updated_at=? WHERE referrer_user_id=? AND status='DORMANT'`).bind(now,now,uid)
  ]);
  return {status:'success',reactivated:true};
}

async function createReferral(env,refUid,shopId,ownerUid) {
  if(!refUid||refUid==='LINE_GUEST')return;
  if(refUid===ownerUid){await env.DB.prepare(`INSERT INTO risk_alerts(alert_id,alert_type,severity,user_id,shop_id,status,summary,details,created_at) VALUES(?,?,?,?,?,'OPEN',?,?,?)`).bind(id('RISK'),'SELF_REFERRAL','LOW',ownerUid,shopId,'推薦人與店家 Owner 為同一 LINE UID','註冊時直接阻擋，未建立推薦關係',isoNow()).run();return;}
  await ensureUser(env,refUid,'REFERRAL_LINK');
  const [ownerId,refId,rule]=await Promise.all([
    env.DB.prepare(`SELECT legal_id_hash FROM identities WHERE user_id=?`).bind(ownerUid).first(),env.DB.prepare(`SELECT legal_id_hash FROM identities WHERE user_id=?`).bind(refUid).first(),ensureCurrentPartnerRule(env)
  ]);
  if(ownerId?.legal_id_hash&&refId?.legal_id_hash&&ownerId.legal_id_hash===refId.legal_id_hash){await env.DB.prepare(`INSERT INTO risk_alerts(alert_id,alert_type,severity,user_id,shop_id,status,summary,details,created_at) VALUES(?,?,?,?,?,'OPEN',?,?,?)`).bind(id('RISK'),'SELF_REFERRAL_IDENTITY','MEDIUM',refUid,shopId,'推薦人與店家實名身分相同','註冊時比對實名 hash 後阻擋',isoNow()).run();return;}
  const now=isoNow();
  await env.DB.prepare(`INSERT OR IGNORE INTO referral_relations(relation_id,referrer_user_id,shop_id,owner_user_id,status,binding_source,rule_version,bound_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(id('REF'),refUid,shopId,ownerUid,ownerId?.legal_id_hash&&refId?.legal_id_hash?'ACTIVE':'PENDING_IDENTITY_CHECK','SIGNUP_LINK',rule.rule_version,now,now,now).run();
  await env.DB.prepare(`INSERT INTO partner_profiles(user_id,partner_status,created_at,updated_at) VALUES(?,'ACTIVE',?,?) ON CONFLICT(user_id) DO UPDATE SET partner_status=CASE WHEN partner_status='DORMANT' THEN 'ACTIVE' ELSE partner_status END,reactivated_at=CASE WHEN partner_status='DORMANT' THEN excluded.updated_at ELSE reactivated_at END,dormant_at=CASE WHEN partner_status='DORMANT' THEN NULL ELSE dormant_at END,updated_at=excluded.updated_at`).bind(refUid,now,now).run();await env.DB.prepare(`UPDATE referral_relations SET status='ACTIVE',reactivated_at=?,dormant_at=NULL,updated_at=? WHERE referrer_user_id=? AND status='DORMANT'`).bind(now,now,refUid).run();
}
async function register(env,p) {
  const uid=String(p.lineUid||p.uid||''); if(!uid||uid==='LINE_GUEST')return {status:'error',msg:'請先登入 LINE'}; await ensureUser(env,uid,'LINE');
  const name=clean(p.merchantName,120),address=clean(p.merchantAddress,300),phone=clean(p.merchantPhone,30),email=clean(p.merchantEmail,200),merchantType=clean(p.merchantType,100)||'無營登個人個體戶',responsibleMode=String(p.responsibleMode||'SAME')==='OTHER'?'OTHER':'SAME';
  if(!name||!address)return {status:'error',msg:'店名與地址不可空白'};
  const dup=await env.DB.prepare(`SELECT s.shop_id,s.name FROM shops s JOIN shop_members sm ON sm.shop_id=s.shop_id WHERE sm.user_id=? AND sm.status='ACTIVE' AND lower(trim(s.name))=lower(trim(?)) AND lower(trim(s.address))=lower(trim(?)) LIMIT 1`).bind(uid,name,address).first();
  if(dup)return {status:'error',msg:'這間店已經建立過了！',shopId:dup.shop_id,shopName:dup.name,duplicateShop:true};
  let acc=await env.DB.prepare(`SELECT * FROM merchant_accounts WHERE owner_user_id=? AND status='ACTIVE' ORDER BY datetime(created_at) LIMIT 1`).bind(uid).first(); const now=isoNow();
  if(!acc){const accountId=id('MAC');await env.DB.prepare(`INSERT INTO merchant_accounts(account_id,owner_user_id,status,kyc_status,payout_status,created_at,updated_at) VALUES(?,?,'ACTIVE','NOT_STARTED','NOT_STARTED',?,?)`).bind(accountId,uid,now,now).run();acc={account_id:accountId,kyc_status:'NOT_STARTED'};}
  const canInherit=normalizeVerified(acc.kyc_status)&&responsibleMode==='SAME';
  const shopId=`SFB-${new Date(Date.now()+TZ_OFFSET_MS).toISOString().slice(5,19).replace(/[-T:]/g,'')}${Math.floor(10+Math.random()*90)}`;
  let lat=null,lng=null,city=null,district=null;
  if(env.GOOGLE_PLACES_API_KEY){try{const g=await googlePlaceSearch(env,address,'',0,0,true);const f=g.places?.[0];if(f){lat=f.lat;lng=f.lng;city=f.city||null;district=f.district||null;}}catch(_e){}}
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO shops(shop_id,merchant_account_id,name,address,phone,email,latitude,longitude,status,risk_status,city,district,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?, 'ACTIVE','CLEAR',?,?,?,?)`).bind(shopId,acc.account_id,name,address,phone,email,lat,lng,city,district,now,now),
    env.DB.prepare(`INSERT INTO shop_members(relation_id,shop_id,user_id,role,status,created_at,updated_at) VALUES(?,?,?,'OWNER','ACTIVE',?,?)`).bind(id('REL'),shopId,uid,now,now),
    env.DB.prepare(`INSERT INTO shop_business_profiles(shop_id,merchant_type,responsible_mode,responsible_name,responsible_phone,kyc_inherited,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`).bind(shopId,merchantType,responsibleMode,clean(p.ownerName,100),clean(p.ownerPhone,30),canInherit?1:0,now,now),
    env.DB.prepare(`INSERT INTO merchant_contracts(contract_id,merchant_account_id,shop_id,contract_version,status,signer_name,signed_at,signing_source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(id('MCON'),acc.account_id,shopId,MERCHANT_CONTRACT_VERSION,canInherit?'SIGNED':'PENDING_REVIEW',canInherit?acc.signer_name:null,canInherit?now:null,canInherit?'INHERITED_ACCOUNT_KYC':'WEB',now,now)
  ]);
  await createReferral(env,clean(p.referrerUid,100),shopId,uid);
  await audit(env,{actorType:'USER',actorId:uid,action:'SHOP_REGISTER',entityType:'SHOP',entityId:shopId,after:{name,address,responsibleMode}});
  return {status:'success',shopId,shopName:name,contractStatus:canInherit?'已完成':'PENDING_REVIEW',kycInherited:canInherit,multiShopEnabled:true};
}

async function itemOpenSession(env,itemId,shopId,stock,pickup,opened=isoNow(),reason='FIRST_OPEN') {
  const auto=minIso(addMs(opened,ITEM_TTL_MS),pickup)||addMs(opened,ITEM_TTL_MS),sid=id('SALEITEM');
  await env.DB.prepare(`INSERT INTO item_sale_sessions(session_id,item_id,shop_id,opened_at,pickup_cutoff,auto_close_at,status,opening_stock,latest_stock,created_at,updated_at) VALUES(?,?,?,?,?,?,'OPEN',?,?,?,?)`).bind(sid,itemId,shopId,opened,pickup,auto,stock,stock,opened,opened).run();
  return {sessionId:sid,autoClose:auto,reason};
}
async function notifyWatchersOnline(env,shopId) {
  const shop=await env.DB.prepare(`SELECT name FROM shops WHERE shop_id=?`).bind(shopId).first(); const w=await env.DB.prepare(`SELECT user_id FROM shop_watchlist WHERE shop_id=? AND status='ACTIVE'`).bind(shopId).all(); const now=isoNow(),statements=[];
  for(const row of w.results||[]){const nid=id('NOTIF');statements.push(env.DB.prepare(`INSERT INTO notifications(notification_id,audience_type,user_id,shop_id,notification_type,title,body,deep_link,status,created_at) VALUES(?,'HUNTER',?,?,'SHOP_ONLINE',?,?,?,'UNREAD',?)`).bind(nid,row.user_id,shopId,`${shop?.name||'獵場'} 開賣了！`,'你敲碗的獵場現在有惜食品上架，趁還有份數去看看。',`index.html?targetShopId=${encodeURIComponent(shopId)}#home`,now));statements.push(env.DB.prepare(`INSERT INTO notification_queue(queue_id,notification_id,channel,recipient,status,attempts,next_attempt_at,created_at,updated_at) VALUES(?,?, 'LINE',?,'PENDING',0,?,?,?)`).bind(id('Q'),nid,row.user_id,now,now,now));statements.push(env.DB.prepare(`UPDATE shop_watchlist SET last_notified_at=?,updated_at=? WHERE user_id=? AND shop_id=?`).bind(now,now,row.user_id,shopId));}
  if(statements.length)await env.DB.batch(statements);
}
async function updateStatus(env,p) {
  const uid=String(p.uid||''),shopId=clean(p.shopId,100),global=String(p.status||'OFF').toUpperCase()==='ON'?'ON':'OFF'; if(!await ownedShop(env,uid,shopId))return {status:'error',msg:'無權限管理此店'};
  const isPlus=await activePlus(env,shopId),maxSlots=isPlus?PLUS_SLOT_LIMIT:BASIC_SLOT_LIMIT,now=isoNow(),pickup=parseLocalPickup(p.time);
  if(global==='ON'&&(!pickup||new Date(pickup)<=new Date()))return {status:'error',msg:'取餐截止時間必須晚於現在'};
  const todayStart=new Date(new Date(`${twDateKey()}T00:00:00+08:00`).getTime()).toISOString(); const sales=await env.DB.prepare(`SELECT COALESCE(SUM(subtotal),0) s FROM orders WHERE shop_id=? AND status IN ('PAID','REDEEMED') AND datetime(created_at)>=datetime(?)`).bind(shopId,todayStart).first(); if(num(sales?.s)>=10000&&global==='ON')return {status:'error',msg:'🚨【系統風控提示】\n您今日的營業額已達平台單日交易安全上限（$10,000）。雷達已自動關閉打烊，明天將自動重置開放！'};
  const oldRows=(await env.DB.prepare(`SELECT * FROM shop_items WHERE shop_id=? ORDER BY slot_index`).bind(shopId).all()).results||[],oldMap=new Map(oldRows.map(x=>[num(x.slot_index),x])),wasOnline=oldRows.some(x=>x.status==='ON'&&num(x.current_stock)>0);
  const sessions=(await env.DB.prepare(`SELECT * FROM item_sale_sessions WHERE shop_id=? AND status='OPEN'`).bind(shopId).all()).results||[],sessMap=new Map(sessions.map(x=>[x.item_id,x])); const statements=[],afterItems=[];
  if(global==='ON'&&!isPlus){
    for(const old of oldRows.filter(x=>num(x.slot_index)>BASIC_SLOT_LIMIT)){
      const sess=sessMap.get(old.item_id);
      if(sess){statements.push(env.DB.prepare(`UPDATE item_sale_sessions SET status='CLOSED',closed_at=?,close_reason='PLUS_SLOT_LIMIT',updated_at=? WHERE session_id=? AND status='OPEN'`).bind(now,now,sess.session_id));statements.push(env.DB.prepare(`INSERT INTO inventory_events(event_id,item_id,shop_id,event_type,quantity_delta,quantity_after,reason,source,actor_user_id,created_at) VALUES(?,?,?,'MANUAL_CLOSE',0,?,'PLUS_SLOT_LIMIT','SYSTEM',?,?)`).bind(id('INV'),old.item_id,shopId,num(old.current_stock),uid,now));}
      statements.push(env.DB.prepare(`UPDATE shop_items SET status='OFF',updated_at=? WHERE item_id=?`).bind(now,old.item_id));
    }
  }
  if(global==='OFF'){
    for(const old of oldRows){const s=sessMap.get(old.item_id);if(s){statements.push(env.DB.prepare(`UPDATE item_sale_sessions SET status='CLOSED',closed_at=?,close_reason='MANUAL_OFF',updated_at=? WHERE session_id=? AND status='OPEN'`).bind(now,now,s.session_id));statements.push(env.DB.prepare(`INSERT INTO inventory_events(event_id,item_id,shop_id,event_type,quantity_delta,quantity_after,reason,source,actor_user_id,created_at) VALUES(?,?,?,'MANUAL_CLOSE',0,?,'MANUAL_OFF','MERCHANT',?,?)`).bind(id('INV'),old.item_id,shopId,num(old.current_stock),uid,now));}statements.push(env.DB.prepare(`UPDATE shop_items SET status='OFF',pickup_cutoff=?,updated_at=? WHERE item_id=?`).bind(pickup,now,old.item_id));}
  } else {
    for(let i=1;i<=maxSlots;i++){
      const type=clean(p[`itemType${i}`],50)||'暫不使用',name=clean(p[`itemName${i}`],120)||'【未啟用】',desc=clean(p[`itemDesc${i}`],500),orig=Math.max(0,Math.round(num(p[`orig${i}`]))),sale=Math.max(0,Math.round(num(p[`disc${i}`]))),rem=Math.max(0,int(p[`rem${i}`])),old=oldMap.get(i),itemId=old?.item_id||`ITEM-${shopId}-${i}`; let st=(type==='暫不使用'||rem<=0)?'OFF':(sale>1000?'PENDING_REVIEW':'ON');
      if(!old)statements.push(env.DB.prepare(`INSERT INTO shop_items(item_id,shop_id,slot_index,item_type,name,description,original_price,sale_price,current_stock,status,pickup_cutoff,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(itemId,shopId,i,type,name,desc,orig,sale,rem,st,pickup,now,now)); else statements.push(env.DB.prepare(`UPDATE shop_items SET item_type=?,name=?,description=?,original_price=?,sale_price=?,current_stock=?,status=?,pickup_cutoff=?,updated_at=? WHERE item_id=?`).bind(type,name,desc,orig,sale,rem,st,pickup,now,itemId));
      const oldRem=num(old?.current_stock),oldStatus=old?.status||'OFF',s=sessMap.get(itemId);
      if(st!=='ON'||rem<=0){if(s){statements.push(env.DB.prepare(`UPDATE item_sale_sessions SET status='CLOSED',closed_at=?,close_reason=?,latest_stock=?,updated_at=? WHERE session_id=? AND status='OPEN'`).bind(now,rem<=0?'STOCK_ZERO':'ITEM_OFF',rem,now,s.session_id));statements.push(env.DB.prepare(`INSERT INTO inventory_events(event_id,item_id,shop_id,event_type,quantity_delta,quantity_after,reason,source,actor_user_id,created_at) VALUES(?,?,?,'MANUAL_CLOSE',0,?,?, 'MERCHANT',?,?)`).bind(id('INV'),itemId,shopId,rem,rem<=0?'STOCK_ZERO':'ITEM_OFF',uid,now));}}
      else if(!s){const auto=minIso(addMs(now,ITEM_TTL_MS),pickup)||addMs(now,ITEM_TTL_MS);statements.push(env.DB.prepare(`INSERT INTO item_sale_sessions(session_id,item_id,shop_id,opened_at,pickup_cutoff,auto_close_at,status,opening_stock,latest_stock,created_at,updated_at) VALUES(?,?,?,?,?,?,'OPEN',?,?,?,?)`).bind(id('SALEITEM'),itemId,shopId,now,pickup,auto,rem,rem,now,now));statements.push(env.DB.prepare(`INSERT INTO inventory_events(event_id,item_id,shop_id,event_type,quantity_delta,quantity_after,reason,source,actor_user_id,created_at) VALUES(?,?,?,'OPEN',?,?, '開啟/重新開啟供給','MERCHANT',?,?)`).bind(id('INV'),itemId,shopId,rem,rem,uid,now));}
      else if(rem>oldRem){statements.push(env.DB.prepare(`UPDATE item_sale_sessions SET status='CLOSED',closed_at=?,close_reason='RESTOCK_TTL_RESET',latest_stock=?,updated_at=? WHERE session_id=? AND status='OPEN'`).bind(now,oldRem,now,s.session_id));const auto=minIso(addMs(now,ITEM_TTL_MS),pickup)||addMs(now,ITEM_TTL_MS);statements.push(env.DB.prepare(`INSERT INTO item_sale_sessions(session_id,item_id,shop_id,opened_at,pickup_cutoff,auto_close_at,status,opening_stock,latest_stock,created_at,updated_at) VALUES(?,?,?,?,?,?,'OPEN',?,?,?,?)`).bind(id('SALEITEM'),itemId,shopId,now,pickup,auto,rem,rem,now,now));statements.push(env.DB.prepare(`INSERT INTO inventory_events(event_id,item_id,shop_id,event_type,quantity_delta,quantity_after,reason,source,actor_user_id,created_at) VALUES(?,?,?,'RESTOCK',?,?, '店家增加可售份數；重置該品項 8 小時 TTL','MERCHANT',?,?)`).bind(id('INV'),itemId,shopId,rem-oldRem,rem,uid,now));}
      else {const auto=minIso(addMs(s.opened_at,ITEM_TTL_MS),pickup)||addMs(s.opened_at,ITEM_TTL_MS);statements.push(env.DB.prepare(`UPDATE item_sale_sessions SET pickup_cutoff=?,auto_close_at=?,latest_stock=?,updated_at=? WHERE session_id=? AND status='OPEN'`).bind(pickup,auto,rem,now,s.session_id));if(rem<oldRem)statements.push(env.DB.prepare(`INSERT INTO inventory_events(event_id,item_id,shop_id,event_type,quantity_delta,quantity_after,reason,source,actor_user_id,created_at) VALUES(?,?,?,'WITHDRAW',?,?, '店家主動調減；TTL 不重置','MERCHANT',?,?)`).bind(id('INV'),itemId,shopId,rem-oldRem,rem,uid,now));}
      afterItems.push({status:st,rem});
    }
  }
  if(statements.length)await env.DB.batch(statements); const willOnline=global==='ON'&&afterItems.some(x=>x.status==='ON'&&x.rem>0); if(!wasOnline&&willOnline)await notifyWatchersOnline(env,shopId); await audit(env,{actorType:'USER',actorId:uid,action:'INVENTORY_UPDATE',entityType:'SHOP',entityId:shopId,after:{status:global,maxSlots,pickup}}); return {status:'success',msg:'狀態已更新',_perf:{route:'UPDATE_STATUS_D1'}};
}

function ecpayEncode(str){return encodeURIComponent(str).replace(/%20/g,'+').replace(/~/g,'%7E').replace(/'/g,'%27');}
async function ecpayMac(params,key,iv){const keys=Object.keys(params).sort(),parts=keys.map(k=>`&${k}=${params[k]}`),raw=`HashKey=${key}${parts.join('')}&HashIV=${iv}`,encoded=ecpayEncode(raw).toLowerCase();return (await sha256Hex(encoded)).toUpperCase();}
async function ecpayConfig(env){if(!env.ECPAY_MERCHANT_ID||!env.ECPAY_HASH_KEY||!env.ECPAY_HASH_IV||!env.ECPAY_URL)return null;return {MerchantID:String(env.ECPAY_MERCHANT_ID),HashKey:String(env.ECPAY_HASH_KEY),HashIV:String(env.ECPAY_HASH_IV),URL:String(env.ECPAY_URL)};}
async function buyItem(env,p,request) {
  const cfg=await ecpayConfig(env); if(!cfg)return {status:'config_required',msg:'ECPay 尚未設定'};
  const shopId=clean(p.shopId,100),slot=int(p.itemIndex),uid=String(p.buyerUid||p.uid||'');if(!uid||uid==='LINE_GUEST')return {status:'error',msg:'請先登入 LINE'};await ensureUser(env,uid,'LINE');await releaseExpiredReservations(env,50);
  const [rate,item]=await Promise.all([
    env.DB.prepare(`SELECT SUM(CASE WHEN datetime(created_at)>=datetime(?) THEN 1 ELSE 0 END) minute_count,COALESCE(SUM(CASE WHEN datetime(created_at)>=datetime(?) AND status IN ('PAYMENT_PENDING','PAID','REDEEMED') THEN total_amount ELSE 0 END),0) day_sum FROM orders WHERE user_id=?`).bind(new Date(Date.now()-60000).toISOString(),new Date(Date.now()-86400000).toISOString(),uid).first(),
    env.DB.prepare(`SELECT i.*,s.name shop_name,s.address,s.phone,ses.session_id,ses.auto_close_at FROM shop_items i JOIN shops s ON s.shop_id=i.shop_id JOIN item_sale_sessions ses ON ses.item_id=i.item_id AND ses.status='OPEN' WHERE i.shop_id=? AND i.slot_index=? AND i.status='ON' AND i.current_stock>0 AND (i.slot_index<=3 OR EXISTS(SELECT 1 FROM plus_subscriptions ps WHERE ps.shop_id=i.shop_id AND ps.status='ACTIVE' AND (ps.ends_at IS NULL OR datetime(ps.ends_at)>CURRENT_TIMESTAMP))) AND datetime(ses.auto_close_at)>CURRENT_TIMESTAMP AND (i.pickup_cutoff IS NULL OR datetime(i.pickup_cutoff)>CURRENT_TIMESTAMP) LIMIT 1`).bind(shopId,slot).first()
  ]);
  if(num(rate?.minute_count)>=3)return {status:'error',msg:'動作太快了！獵人請稍等一分鐘再出擊。'};if(!item)return {status:'error',msg:'商品已被搶光或已下架！'};
  const subtotal=num(item.sale_price),fee=serviceFee(subtotal),total=subtotal+fee;if(num(rate?.day_sum)+total>3000)return {status:'error',msg:'🛡️【安全風控拒絕】\n單一帳戶每日獵場搶購額度上限為 $3,000 元。您已達今日上限，請明天再出擊！'};
  const dec=await env.DB.prepare(`UPDATE shop_items SET current_stock=current_stock-1,updated_at=? WHERE item_id=? AND status='ON' AND current_stock>0 RETURNING current_stock`).bind(isoNow(),item.item_id).first(); if(dec?.current_stock===undefined)return {status:'error',msg:'這份商品目前正由其他獵人付款中，請稍後再試。'};
  const now=isoNow(),orderId=`SF${new Date(Date.now()+TZ_OFFSET_MS).toISOString().slice(5,16).replace(/[-T:]/g,'')}${crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase()}`,paymentId=id('PAY'),reservationId=id('RSV'),pickup=item.pickup_cutoff||parseLocalPickup(p.time),holdExp=addMs(now,HOLD_SECONDS*1000),gf=gatewayFee(subtotal);
  const params={MerchantID:cfg.MerchantID,MerchantTradeNo:orderId,MerchantTradeDate:twDateTimeForEcpay(),PaymentType:'aio',TotalAmount:String(Math.round(total)),TradeDesc:'SEEFOOD_Order',ItemName:String(item.name||'SEEFOOD').slice(0,20),ReturnURL:`${new URL(request.url).origin}/api/ecpay/return`,ClientBackURL:`${new URL(request.url).origin}/#orders`,ChoosePayment:String(p.payMethod)==='LINEPay'?'LINEPAY':'Credit',EncryptType:'1'};params.CheckMacValue=await ecpayMac(params,cfg.HashKey,cfg.HashIV);
  try{await env.DB.batch([
    env.DB.prepare(`INSERT INTO orders(order_id,user_id,shop_id,status,subtotal,service_fee,total_amount,currency,pickup_at,pickup_deadline,payment_hold_expires_at,created_at,updated_at) VALUES(?,?,?,'PAYMENT_PENDING',?,?,?,'TWD',?,?,?, ?,?)`).bind(orderId,uid,shopId,subtotal,fee,total,pickup,pickup,holdExp,now,now),
    env.DB.prepare(`INSERT INTO order_items(order_item_id,order_id,item_id,item_name_snapshot,quantity,original_unit_price,sale_unit_price,line_total,created_at) VALUES(?,?,?,?,1,?,?,?,?)`).bind(id('OIT'),orderId,item.item_id,item.name,num(item.original_price),subtotal,subtotal,now),
    env.DB.prepare(`INSERT INTO payments(payment_id,order_id,provider,merchant_trade_no,amount,currency,status,created_at,updated_at) VALUES(?,?, 'ECPAY',?,?,'TWD','PENDING',?,?)`).bind(paymentId,orderId,orderId,total,now,now),
    env.DB.prepare(`INSERT INTO inventory_reservations(reservation_id,order_id,item_id,quantity,status,expires_at,created_at,updated_at) VALUES(?,?,?,1,'HELD',?,?,?)`).bind(reservationId,orderId,item.item_id,holdExp,now,now),
    env.DB.prepare(`INSERT INTO inventory_events(event_id,item_id,shop_id,order_id,reservation_id,event_type,quantity_delta,quantity_after,reason,source,actor_user_id,created_at) VALUES(?,?,?,?,?,'RESERVE',-1,?,'CHECKOUT_HOLD','ORDER',?,?)`).bind(id('INV'),item.item_id,shopId,orderId,reservationId,num(dec.current_stock),uid,now),
    env.DB.prepare(`UPDATE item_sale_sessions SET latest_stock=?,updated_at=? WHERE session_id=? AND status='OPEN'`).bind(num(dec.current_stock),now,item.session_id),
    env.DB.prepare(`INSERT INTO order_status_events(event_id,order_id,from_status,to_status,reason,actor_type,actor_id,created_at) VALUES(?,?,NULL,'PAYMENT_PENDING','CHECKOUT_CREATED','USER',?,?)`).bind(id('OSE'),orderId,uid,now)
  ]);}catch(e){await env.DB.prepare(`UPDATE shop_items SET current_stock=current_stock+1,updated_at=? WHERE item_id=?`).bind(isoNow(),item.item_id).run();throw e;}
  await audit(env,{actorType:'USER',actorId:uid,action:'CHECKOUT_CREATED',entityType:'ORDER',entityId:orderId,after:{shopId,itemId:item.item_id,total},request});
  return {status:'success',orderId,ecpayUrl:cfg.URL,ecpayParams:params};
}

async function releaseReservation(env,r,reason='HOLD_EXPIRED') {
  const now=isoNow(),reservationStatus=['HOLD_EXPIRED','LATE_PAYMENT_CALLBACK'].includes(String(reason))?'EXPIRED':'RELEASED'; const ch=await env.DB.prepare(`UPDATE inventory_reservations SET status=?,released_at=?,release_reason=?,updated_at=? WHERE reservation_id=? AND status='HELD' RETURNING quantity,item_id,order_id`).bind(reservationStatus,now,reason,now,r.reservation_id).first(); if(!ch)return false;
  const stock=await env.DB.prepare(`UPDATE shop_items SET current_stock=current_stock+?,updated_at=? WHERE item_id=? RETURNING current_stock,shop_id`).bind(num(ch.quantity),now,ch.item_id).first();
  await env.DB.batch([
    env.DB.prepare(`UPDATE orders SET status=CASE WHEN status='PAYMENT_PENDING' THEN 'PAYMENT_FAILED' ELSE status END,updated_at=? WHERE order_id=?`).bind(now,ch.order_id),
    env.DB.prepare(`UPDATE payments SET status=CASE WHEN status='PENDING' THEN 'FAILED' ELSE status END,failed_at=CASE WHEN status='PENDING' THEN ? ELSE failed_at END,updated_at=? WHERE order_id=?`).bind(now,now,ch.order_id),
    env.DB.prepare(`UPDATE item_sale_sessions SET latest_stock=?,updated_at=? WHERE item_id=? AND status='OPEN'`).bind(num(stock?.current_stock),now,ch.item_id),
    env.DB.prepare(`INSERT INTO inventory_events(event_id,item_id,shop_id,order_id,reservation_id,event_type,quantity_delta,quantity_after,reason,source,created_at) VALUES(?,?,?,?,?,'RESERVATION_RELEASE',?,?,?,'SYSTEM',?)`).bind(id('INV'),ch.item_id,stock?.shop_id||'',ch.order_id,r.reservation_id,num(ch.quantity),num(stock?.current_stock),reason,now),
    env.DB.prepare(`INSERT INTO order_status_events(event_id,order_id,from_status,to_status,reason,actor_type,actor_id,created_at) VALUES(?,?,'PAYMENT_PENDING','PAYMENT_FAILED',?,'SYSTEM','CRON',?)`).bind(id('OSE'),ch.order_id,reason,now)
  ]); return true;
}
async function releaseExpiredReservations(env,limit=2) {const rows=(await env.DB.prepare(`SELECT reservation_id FROM inventory_reservations WHERE status='HELD' AND datetime(expires_at)<=CURRENT_TIMESTAMP ORDER BY datetime(expires_at) LIMIT ?`).bind(limit).all()).results||[];let n=0;for(const r of rows)if(await releaseReservation(env,r,'HOLD_EXPIRED'))n++;return n;}
async function createCommission(env,order) {
  const rel=await env.DB.prepare(`SELECT rr.*,pr.partner_status FROM referral_relations rr LEFT JOIN partner_profiles pr ON pr.user_id=rr.referrer_user_id WHERE rr.shop_id=? AND rr.status IN ('ACTIVE','PENDING_IDENTITY_CHECK') LIMIT 1`).bind(order.shop_id).first(); if(!rel||['DORMANT','SUSPENDED','TERMINATED'].includes(String(rel.partner_status)))return;
  const rule=await env.DB.prepare(`SELECT * FROM partner_rule_versions WHERE rule_version=?`).bind(rel.rule_version).first()||await latestRule(env),now=isoNow(),review=addMs(now,num(rule.review_days,14)*86400000),x10000=Math.round(num(order.service_fee)*num(rule.service_fee_rate_bps,5000));
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO partner_commission_ledger(entry_id,relation_id,referrer_user_id,shop_id,order_id,commission_source,service_fee_amount,commission_rate_bps,commission_amount_x10000,rule_version,status,review_until,created_at,updated_at) VALUES(?,?,?,?,?,'SERVICE_FEE',?,?,?,?, 'PENDING_REVIEW',?,?,?)`).bind(id('COM'),rel.relation_id,rel.referrer_user_id,order.shop_id,order.order_id,num(order.service_fee),num(rule.service_fee_rate_bps,5000),x10000,rule.rule_version,review,now,now),
    env.DB.prepare(`UPDATE partner_profiles SET last_qualifying_activity_at=?,updated_at=? WHERE user_id=?`).bind(now,now,rel.referrer_user_id),
    env.DB.prepare(`UPDATE referral_relations SET last_qualifying_activity_at=?,updated_at=? WHERE relation_id=?`).bind(now,now,rel.relation_id)
  ]);
}
async function ecpayReturn(env,p,request) {
  const cfg=await ecpayConfig(env);if(!cfg)return text('0|CONFIG'); const incoming=String(p.CheckMacValue||'').toUpperCase(),copy={};for(const [k,v] of Object.entries(p))if(k!=='CheckMacValue')copy[k]=String(v);const expected=await ecpayMac(copy,cfg.HashKey,cfg.HashIV);if(!incoming||incoming!==expected){await audit(env,{actorType:'SYSTEM',actorId:'ECPAY',action:'CALLBACK_MAC_INVALID',entityType:'PAYMENT',entityId:String(p.MerchantTradeNo||''),request});return text('0|MAC INVALID');}
  const trade=String(p.MerchantTradeNo||''),pay=await env.DB.prepare(`SELECT p.*,o.shop_id,o.user_id,o.service_fee,o.status order_status FROM payments p JOIN orders o ON o.order_id=p.order_id WHERE p.merchant_trade_no=?`).bind(trade).first(); if(!pay)return text('1|OK');
  if(['PAID','REFUNDED'].includes(pay.status)||['PAID','REDEEMED'].includes(pay.order_status))return text('1|OK'); const now=isoNow(),finger=await sha256Hex(JSON.stringify(copy));
  if(String(p.RtnCode)==='1'){
    const r=await env.DB.prepare(`SELECT * FROM inventory_reservations WHERE order_id=? LIMIT 1`).bind(pay.order_id).first(); if(!r||r.status!=='HELD'||new Date(r.expires_at)<=new Date()){
      if(r?.status==='HELD')await releaseReservation(env,r,'LATE_PAYMENT_CALLBACK'); await env.DB.batch([env.DB.prepare(`UPDATE payments SET status='ABNORMAL_REVIEW',callback_fingerprint=?,provider_trade_no=?,updated_at=? WHERE payment_id=?`).bind(finger,clean(p.TradeNo,100),now,pay.payment_id),env.DB.prepare(`UPDATE orders SET status='ABNORMAL_REVIEW',updated_at=? WHERE order_id=?`).bind(now,pay.order_id),env.DB.prepare(`INSERT INTO risk_alerts(alert_id,alert_type,severity,user_id,shop_id,order_id,payment_id,status,summary,details,created_at) VALUES(?,?,?,?,?,?,?,'OPEN',?,?,?)`).bind(id('RISK'),'PAYMENT_LATE_SUCCESS','HIGH',pay.user_id,pay.shop_id,pay.order_id,pay.payment_id,'付款成功回傳晚於保留期限','禁止自動出票，交總部人工審核/退款',now)]);return text('1|OK');
    }
    const item=await env.DB.prepare(`SELECT i.*,ir.reservation_id FROM inventory_reservations ir JOIN shop_items i ON i.item_id=ir.item_id WHERE ir.order_id=?`).bind(pay.order_id).first();
    await env.DB.batch([
      env.DB.prepare(`UPDATE inventory_reservations SET status='CONFIRMED',confirmed_at=?,updated_at=? WHERE order_id=? AND status='HELD'`).bind(now,now,pay.order_id),
      env.DB.prepare(`UPDATE payments SET status='PAID',provider_trade_no=?,callback_fingerprint=?,paid_at=?,updated_at=? WHERE payment_id=?`).bind(clean(p.TradeNo,100),finger,now,now,pay.payment_id),
      env.DB.prepare(`UPDATE orders SET status='PAID',paid_at=?,updated_at=? WHERE order_id=?`).bind(now,now,pay.order_id),
      env.DB.prepare(`INSERT OR IGNORE INTO tickets(ticket_id,order_id,user_id,shop_id,status,pickup_at,pickup_deadline,created_at,updated_at) SELECT ?,order_id,user_id,shop_id,'ACTIVE',pickup_at,COALESCE(pickup_deadline,?),?,? FROM orders WHERE order_id=?`).bind(id('TKT'),addMs(now,2*3600000),now,now,pay.order_id),
      env.DB.prepare(`INSERT INTO inventory_events(event_id,item_id,shop_id,order_id,reservation_id,event_type,quantity_delta,quantity_after,reason,source,created_at) VALUES(?,?,?,?,?,'SALE_CONFIRMED',0,?,'PAYMENT_CAPTURED','ECPAY',?)`).bind(id('INV'),item.item_id,pay.shop_id,pay.order_id,item.reservation_id,num(item.current_stock),now),
      env.DB.prepare(`INSERT INTO order_status_events(event_id,order_id,from_status,to_status,reason,actor_type,actor_id,created_at) VALUES(?,?,'PAYMENT_PENDING','PAID','ECPAY_CAPTURED','SYSTEM','ECPAY',?)`).bind(id('OSE'),pay.order_id,now)
    ]);
    const otherHold=await env.DB.prepare(`SELECT COUNT(*) n FROM inventory_reservations WHERE item_id=? AND status='HELD' AND datetime(expires_at)>CURRENT_TIMESTAMP`).bind(item.item_id).first(); if(num(item.current_stock)===0&&num(otherHold?.n)===0)await env.DB.prepare(`UPDATE item_sale_sessions SET status='CLOSED',closed_at=?,close_reason='SOLD_OUT',latest_stock=0,updated_at=? WHERE item_id=? AND status='OPEN'`).bind(now,now,item.item_id).run();
    await audit(env,{actorType:'SYSTEM',actorId:'ECPAY',action:'PAYMENT_CAPTURED',entityType:'ORDER',entityId:pay.order_id,request});
  } else {
    const r=await env.DB.prepare(`SELECT * FROM inventory_reservations WHERE order_id=? LIMIT 1`).bind(pay.order_id).first(); if(r?.status==='HELD')await releaseReservation(env,r,'PAYMENT_FAILED'); await env.DB.prepare(`UPDATE payments SET status='FAILED',callback_fingerprint=?,provider_trade_no=?,failed_at=?,updated_at=? WHERE payment_id=?`).bind(finger,clean(p.TradeNo,100),now,now,pay.payment_id).run();
  }
  return text('1|OK');
}

async function verifyOrder(env,p) {
  const orderId=clean(p.orderId,100),uid=String(p.uid||'');
  if(!uid||uid==='LINE_GUEST')return {status:'error',msg:'請先登入 LINE'};
  const o=await env.DB.prepare(`SELECT o.*,t.ticket_id,t.status ticket_status,t.pickup_deadline ticket_deadline FROM orders o LEFT JOIN tickets t ON t.order_id=o.order_id WHERE o.order_id=? AND o.user_id=?`).bind(orderId,uid).first();
  if(!o)return {status:'error',msg:'找不到可核銷的訂單'};
  if(o.status==='REDEEMED'){
    await createCommission(env,{order_id:o.order_id,shop_id:o.shop_id,service_fee:o.service_fee});
    return {status:'success',alreadyRedeemed:true,verifyTime:o.redeemed_at||''};
  }
  const deadline=o.ticket_deadline||o.pickup_deadline;
  if(o.status==='EXPIRED'||(deadline&&new Date(deadline)<=new Date())){
    const expiredAt=isoNow();
    await env.DB.batch([
      env.DB.prepare(`UPDATE orders SET status='EXPIRED',updated_at=? WHERE order_id=? AND status='PAID'`).bind(expiredAt,orderId),
      env.DB.prepare(`UPDATE tickets SET status='EXPIRED',updated_at=? WHERE order_id=? AND status='ACTIVE'`).bind(expiredAt,orderId)
    ]);
    return {status:'error',code:'EXPIRED',msg:'此票券已超過取餐截止時間，正常核銷已鎖定。'};
  }
  if(o.status!=='PAID')return {status:'error',msg:'此訂單目前不可核銷'};
  const redeemedAt=isoNow();
  await env.DB.batch([
    env.DB.prepare(`UPDATE orders SET status='REDEEMED',redeemed_at=?,updated_at=? WHERE order_id=? AND status='PAID'`).bind(redeemedAt,redeemedAt,orderId),
    env.DB.prepare(`UPDATE tickets SET status='REDEEMED',redeemed_at=?,updated_at=? WHERE order_id=? AND status='ACTIVE'`).bind(redeemedAt,redeemedAt,orderId),
    env.DB.prepare(`INSERT INTO order_status_events(event_id,order_id,from_status,to_status,reason,actor_type,actor_id,created_at) VALUES(?,?,'PAID','REDEEMED','PICKUP_REDEEMED','USER',?,?)`).bind(id('OSE'),orderId,uid,redeemedAt)
  ]);
  await createCommission(env,{order_id:o.order_id,shop_id:o.shop_id,service_fee:o.service_fee});
  return {status:'success',verifyTime:redeemedAt};
}
async function recordConsent(env,p) {const uid=String(p.uid||'');if(!uid||uid==='LINE_GUEST')return {status:'success'};await ensureUser(env,uid);const now=isoNow();await env.DB.prepare(`INSERT INTO consents(consent_id,user_id,document_type,document_version,status,agreed_at,source,created_at) VALUES(?,?,?,?, 'AGREED',?,?,?) ON CONFLICT(user_id,document_type,document_version) DO UPDATE SET status='AGREED',agreed_at=excluded.agreed_at,source=excluded.source`).bind(id('CONS'),uid,clean(p.documentType||'TOS',80),clean(p.version||'3.1',40),now,clean(p.source||'WEB',40),now).run();return {status:'success'};}
async function merchantOrders(env,p) {
  const uid=String(p.uid||''),shopId=clean(p.shopId,100);if(!await ownedShop(env,uid,shopId))return {status:'error',msg:'無權限'};
  const lim=Math.min(100,Math.max(1,int(p.limit,30))),cutoff=Date.now()-REFUND_WINDOW_DAYS*86400000;
  const r=await env.DB.prepare(`SELECT o.*,oi.item_name_snapshot item,CASE WHEN EXISTS(SELECT 1 FROM order_disputes d WHERE d.order_id=o.order_id AND d.status NOT IN ('RESOLVED_NO_REFUND','RESOLVED_REFUND','REJECTED','CANCELLED')) THEN 1 ELSE 0 END has_open_dispute FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.order_id WHERE o.shop_id=? ORDER BY datetime(o.created_at) DESC LIMIT ?`).bind(shopId,lim).all();
  return {status:'success',orders:(r.results||[]).map(o=>{
    const st=legacyStatus(o.status),gf=gatewayFee(o.subtotal),matured=!!o.paid_at&&!Number.isNaN(new Date(o.paid_at).getTime())&&new Date(o.paid_at).getTime()<=cutoff,settlementEligible=['REDEEMED','EXPIRED'].includes(String(o.status))&&matured&&!bool(o.has_open_dispute),period=twPeriod(new Date(o.redeemed_at||o.paid_at||o.created_at));
    const statusLabel=st==='Redeemed'?'已核銷':st==='Paid'?'待取餐':st==='Expired'?'逾期未取':st==='RefundPending'?'退款處理中':st==='Refunded'?'已退款':st==='Cancelled'?'已取消':st==='Pending'?'付款確認中':st==='PaymentFailed'?'付款未完成':st;
    const settlementLabel=settlementEligible?`可計入 ${period} 撥款`:bool(o.has_open_dispute)?'客服申訴審核中，暫不入帳':['REFUND_PENDING','REFUNDED','CANCELLED'].includes(String(o.status))?'已取消／退款，不列入商家收入':['REDEEMED','EXPIRED'].includes(String(o.status))?`付款後 ${REFUND_WINDOW_DAYS} 天審核期，暫不入帳`:'尚未計入撥款';
    return {orderId:o.order_id,item:o.item||'',status:st,statusLabel,itemPrice:num(o.subtotal),platformFee:num(o.service_fee),gatewayFee:settlementEligible?gf:0,netIncome:settlementEligible?Math.max(0,num(o.subtotal)-gf):0,reviewHold:!settlementEligible&&['REDEEMED','EXPIRED'].includes(String(o.status))?num(o.subtotal):0,period,settlementLabel};
  })};
}
async function createDispute(env,p) {
  const uid=String(p.uid||''),orderId=clean(p.orderId,100),o=await env.DB.prepare(`SELECT status FROM orders WHERE order_id=? AND user_id=?`).bind(orderId,uid).first();
  if(!o)return {status:'error',msg:'找不到此訂單'};
  return {status:'support_required',code:'CUSTOMER_SERVICE_ONLY',msg:'已付款訂單不開放買家自行申請退款或爭議。若有餐點品質、品項重大不符或店家無法供餐，請聯絡 SEEFOOD 官方 LINE，由客服建立案件並人工審核。買家延遲或逾期未取不受理退款。',supportUrl:SUPPORT_LINE_URL,orderId,orderStatus:o.status};
}

async function adminOrderComplaint(env,p,request) {
  const operation=String(p.operation||'').toUpperCase(),orderId=clean(p.orderId,100),actor=clean(p.adminId||'ADMIN',80),now=isoNow();
  if(!orderId)return {status:'error',code:'ORDER_ID_REQUIRED',msg:'缺少訂單編號',_httpStatus:400};
  const o=await env.DB.prepare(`SELECT o.*,p.payment_id,p.status payment_status,p.amount payment_amount FROM orders o LEFT JOIN payments p ON p.order_id=o.order_id WHERE o.order_id=? LIMIT 1`).bind(orderId).first();
  if(!o)return {status:'error',code:'ORDER_NOT_FOUND',msg:'找不到訂單',_httpStatus:404};
  const paidMs=o.paid_at?new Date(o.paid_at).getTime():NaN,deadlineMs=Number.isNaN(paidMs)?NaN:paidMs+REFUND_WINDOW_DAYS*86400000,withinWindow=!Number.isNaN(deadlineMs)&&Date.now()<=deadlineMs,refundDeadline=Number.isNaN(deadlineMs)?null:new Date(deadlineMs).toISOString();
  const unresolved=()=>env.DB.prepare(`SELECT * FROM order_disputes WHERE order_id=? AND status NOT IN ('RESOLVED_NO_REFUND','RESOLVED_REFUND','REJECTED','CANCELLED') ORDER BY datetime(opened_at) DESC LIMIT 1`).bind(orderId).first();

  if(operation==='OPEN'){
    if(!['PAID','REDEEMED','EXPIRED'].includes(String(o.status)))return {status:'error',code:'ORDER_NOT_ELIGIBLE_FOR_COMPLAINT',msg:'只有已付款、已核銷或逾期未取的訂單可由客服建立申訴案件',_httpStatus:409};
    if(!withinWindow)return {status:'error',code:'REFUND_WINDOW_EXPIRED',msg:`已超過付款後 ${REFUND_WINDOW_DAYS} 天的人工退款判斷期限`,refundDeadline,_httpStatus:409};
    const type=String(p.disputeType||'').toUpperCase(),allowed=new Set(['QUALITY_ISSUE','ITEM_MISMATCH','MERCHANT_UNAVAILABLE','ORDER_NOT_FOUND','FOOD_SAFETY','OTHER_QUALITY_OR_FULFILLMENT']);
    if(!allowed.has(type))return {status:'error',code:'COMPLAINT_TYPE_NOT_ALLOWED',msg:'客服案件只接受品質、品項重大不符、店家無法供餐、店家查無訂單或食安等問題；買家延遲／逾期未取不受理退款爭議',_httpStatus:400};
    const existing=await unresolved();if(existing)return {status:'success',alreadyOpen:true,caseId:existing.dispute_id,caseStatus:existing.status,refundDeadline};
    const caseId=id('DSP'),description=clean(p.description,1000);if(!description)return {status:'error',code:'DESCRIPTION_REQUIRED',msg:'請記錄客服收到的具體問題',_httpStatus:400};
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO order_disputes(dispute_id,order_id,opened_by_user_id,dispute_type,description,status,opened_at,updated_at) VALUES(?,?,NULL,?,?,'UNDER_REVIEW',?,?)`).bind(caseId,orderId,type,description,now,now),
      env.DB.prepare(`UPDATE partner_commission_ledger SET status='PENDING_REVIEW',available_at=NULL,updated_at=? WHERE order_id=? AND status='AVAILABLE'`).bind(now,orderId)
    ]);
    await audit(env,{actorType:'ADMIN',actorId:actor,action:'CUSTOMER_SERVICE_COMPLAINT_OPENED',entityType:'ORDER',entityId:orderId,after:{caseId,type,refundDeadline},request});
    return {status:'success',caseId,caseStatus:'UNDER_REVIEW',refundDeadline};
  }

  const complaint=await unresolved();
  if(!complaint)return {status:'error',code:'NO_OPEN_COMPLAINT',msg:'此訂單沒有待處理的客服申訴案件',_httpStatus:409};

  if(operation==='CLOSE_NO_REFUND'){
    const note=clean(p.resolutionNote,1000);if(!note)return {status:'error',code:'RESOLUTION_NOTE_REQUIRED',msg:'請填寫不退款的人工判斷依據',_httpStatus:400};
    await env.DB.prepare(`UPDATE order_disputes SET status='RESOLVED_NO_REFUND',resolution_note=?,resolved_by_user_id=NULL,resolved_at=?,updated_at=? WHERE dispute_id=?`).bind(note,now,now,complaint.dispute_id).run();
    await audit(env,{actorType:'ADMIN',actorId:actor,action:'CUSTOMER_SERVICE_COMPLAINT_CLOSED_NO_REFUND',entityType:'ORDER',entityId:orderId,after:{caseId:complaint.dispute_id,note},request});
    return {status:'success',caseId:complaint.dispute_id,caseStatus:'RESOLVED_NO_REFUND',orderStatus:o.status};
  }

  if(operation==='APPROVE_REFUND'){
    if(!withinWindow)return {status:'error',code:'REFUND_WINDOW_EXPIRED',msg:`已超過付款後 ${REFUND_WINDOW_DAYS} 天，不可由此流程核准退款`,refundDeadline,_httpStatus:409};
    if(!['PAID','REDEEMED','EXPIRED'].includes(String(o.status)))return {status:'error',code:'ORDER_NOT_REFUNDABLE',msg:'訂單目前狀態不可核准退款',_httpStatus:409};
    const note=clean(p.resolutionNote,1000);if(!note)return {status:'error',code:'RESOLUTION_NOTE_REQUIRED',msg:'請填寫核准退款的人工判斷依據',_httpStatus:400};
    if(!o.payment_id||String(o.payment_status)!=='PAID'||num(o.payment_amount)<=0)return {status:'error',code:'PAID_PAYMENT_NOT_FOUND',msg:'找不到可退款的已付款金流紀錄',_httpStatus:409};
    const locked=await env.DB.prepare(`SELECT COUNT(*) n FROM partner_commission_ledger WHERE order_id=? AND status IN ('REQUESTED','PAID')`).bind(orderId).first();
    if(num(locked?.n)>0)return {status:'error',code:'PARTNER_PAYOUT_ALREADY_LOCKED',msg:'此訂單已有已請款／已付款分潤，禁止自動退款調整，請交總部財務人工追回與稽核',_httpStatus:409};
    const priorRefund=await env.DB.prepare(`SELECT refund_id,status FROM refunds WHERE order_id=? AND status IN ('PENDING','PROCESSING','COMPLETED') ORDER BY datetime(requested_at) DESC LIMIT 1`).bind(orderId).first();
    if(priorRefund)return {status:'error',code:'REFUND_ALREADY_EXISTS',msg:'此訂單已有退款台帳紀錄，請勿重複建立',refundId:priorRefund.refund_id,refundStatus:priorRefund.status,_httpStatus:409};
    const refundId=id('RFD');
    await env.DB.batch([
      env.DB.prepare(`UPDATE orders SET status='REFUND_PENDING',updated_at=? WHERE order_id=? AND status IN ('PAID','REDEEMED','EXPIRED')`).bind(now,orderId),
      env.DB.prepare(`UPDATE payments SET status='REFUND_PENDING',updated_at=? WHERE order_id=? AND status='PAID'`).bind(now,orderId),
      env.DB.prepare(`UPDATE tickets SET status='CANCELLED',updated_at=? WHERE order_id=? AND status='ACTIVE'`).bind(now,orderId),
      env.DB.prepare(`UPDATE order_disputes SET resolution_note=?,updated_at=? WHERE dispute_id=? AND status='UNDER_REVIEW'`).bind(note,now,complaint.dispute_id),
      env.DB.prepare(`INSERT INTO refunds(refund_id,order_id,payment_id,dispute_id,amount,reason,status,requested_at,updated_at) VALUES(?,?,?,?,?,?,'PENDING',?,?)`).bind(refundId,orderId,o.payment_id,complaint.dispute_id,num(o.payment_amount),note,now,now),
      env.DB.prepare(`UPDATE partner_commission_ledger SET status='VOID',voided_at=?,void_reason='CUSTOMER_SERVICE_REFUND_APPROVED',updated_at=? WHERE order_id=? AND status IN ('PENDING_REVIEW','AVAILABLE')`).bind(now,now,orderId),
      env.DB.prepare(`INSERT INTO order_status_events(event_id,order_id,from_status,to_status,reason,actor_type,actor_id,created_at) VALUES(?,?,?,'REFUND_PENDING','CUSTOMER_SERVICE_REFUND_APPROVED','ADMIN',?,?)`).bind(id('OSE'),orderId,o.status,actor,now)
    ]);
    await audit(env,{actorType:'ADMIN',actorId:actor,action:'ORDER_REFUND_APPROVED',entityType:'ORDER',entityId:orderId,before:{status:o.status},after:{status:'REFUND_PENDING',caseId:complaint.dispute_id,refundId,note,refundDeadline},request});
    return {status:'success',caseId:complaint.dispute_id,refundId,refundStatus:'PENDING',orderStatus:'REFUND_PENDING',requiresGatewayRefund:true,refundDeadline};
  }

  if(operation==='MARK_REFUNDED'){
    if(String(o.status)!=='REFUND_PENDING')return {status:'error',code:'REFUND_NOT_APPROVED',msg:'必須先完成客服人工核准，才能標記退款完成',_httpStatus:409};
    const gatewayReference=clean(p.gatewayReference,160);if(!gatewayReference)return {status:'error',code:'GATEWAY_REFERENCE_REQUIRED',msg:'確認實際返還消費者後，必須填入金流退款編號',_httpStatus:400};
    const refund=await env.DB.prepare(`SELECT * FROM refunds WHERE order_id=? AND dispute_id=? AND status IN ('PENDING','PROCESSING') ORDER BY datetime(requested_at) DESC LIMIT 1`).bind(orderId,complaint.dispute_id).first();
    if(!refund)return {status:'error',code:'REFUND_LEDGER_NOT_FOUND',msg:'找不到待完成的退款台帳紀錄',_httpStatus:409};
    await env.DB.batch([
      env.DB.prepare(`UPDATE orders SET status='REFUNDED',updated_at=? WHERE order_id=? AND status='REFUND_PENDING'`).bind(now,orderId),
      env.DB.prepare(`UPDATE payments SET status='REFUNDED',refunded_at=?,updated_at=? WHERE order_id=? AND status='REFUND_PENDING'`).bind(now,now,orderId),
      env.DB.prepare(`UPDATE order_disputes SET status='RESOLVED_REFUND',resolved_by_user_id=NULL,resolved_at=?,updated_at=? WHERE dispute_id=?`).bind(now,now,complaint.dispute_id),
      env.DB.prepare(`UPDATE refunds SET status='COMPLETED',provider_refund_no=?,completed_at=?,updated_at=? WHERE refund_id=? AND status IN ('PENDING','PROCESSING')`).bind(gatewayReference,now,now,refund.refund_id),
      env.DB.prepare(`INSERT INTO order_status_events(event_id,order_id,from_status,to_status,reason,actor_type,actor_id,created_at) VALUES(?,?,'REFUND_PENDING','REFUNDED',?,'ADMIN',?,?)`).bind(id('OSE'),orderId,`GATEWAY_REFUND:${gatewayReference}`,actor,now)
    ]);
    await audit(env,{actorType:'ADMIN',actorId:actor,action:'ORDER_REFUND_CONFIRMED',entityType:'ORDER',entityId:orderId,before:{status:'REFUND_PENDING'},after:{status:'REFUNDED',caseId:complaint.dispute_id,refundId:refund.refund_id,gatewayReference},request});
    return {status:'success',caseId:complaint.dispute_id,refundId:refund.refund_id,refundStatus:'COMPLETED',orderStatus:'REFUNDED',gatewayReference};
  }

  return {status:'error',code:'UNKNOWN_COMPLAINT_OPERATION',msg:'operation 必須為 OPEN、CLOSE_NO_REFUND、APPROVE_REFUND 或 MARK_REFUNDED',_httpStatus:400};
}

function pct(c,p){c=num(c);p=num(p);return p<=0?(c>0?100:0):((c-p)/p)*100;}
async function analytics(env,uid,shopId,days=7) {if(!await ownedShop(env,uid,shopId))return null;days=Math.max(7,Math.min(365,int(days,7)));const now=new Date(),start=new Date(now.getTime()-days*86400000),prevStart=new Date(now.getTime()-days*2*86400000);const r=await env.DB.prepare(`SELECT o.user_id,o.status,o.subtotal,o.created_at,o.redeemed_at,oi.item_name_snapshot item FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.order_id WHERE o.shop_id=? AND datetime(COALESCE(o.redeemed_at,o.created_at))>=datetime(?) ORDER BY datetime(o.created_at)`).bind(shopId,prevStart.toISOString()).all();const daily={},prevDaily={};for(let i=0;i<days;i++){const d=new Date(start.getTime()+i*86400000),pd=new Date(prevStart.getTime()+i*86400000);const k=twDateKey(d),pk=twDateKey(pd);daily[k]={date:k,label:days<=7?['日','一','二','三','四','五','六'][new Date(d.getTime()+TZ_OFFSET_MS).getUTCDay()]:k.slice(5),revenue:0,orders:0};prevDaily[pk]={date:pk,label:days<=7?['日','一','二','三','四','五','六'][new Date(pd.getTime()+TZ_OFFSET_MS).getUTCDay()]:pk.slice(5),revenue:0,orders:0};}const summary={revenue:0,redeemed:0,pending:0,uniqueHunters:0,aov:0},prev={revenue:0,redeemed:0,hunters:new Set()},hunters=new Set(),hours=[0,0,0,0],items={};for(const o of r.results||[]){const dt=new Date(o.redeemed_at||o.created_at),status=o.status,item=o.item||'未命名獵物';if(dt>=start&&dt<=now){if(status==='REDEEMED'){summary.revenue+=num(o.subtotal);summary.redeemed++;hunters.add(o.user_id);const k=twDateKey(dt);if(daily[k]){daily[k].revenue+=num(o.subtotal);daily[k].orders++;}const hour=new Date(dt.getTime()+TZ_OFFSET_MS).getUTCHours(),hb=hour<14?0:hour<17?1:hour<20?2:3;hours[hb]++;if(!items[item])items[item]={name:item,count:0,revenue:0};items[item].count++;items[item].revenue+=num(o.subtotal);}else if(status==='PAID')summary.pending++;}else if(dt>=prevStart&&dt<start&&status==='REDEEMED'){prev.revenue+=num(o.subtotal);prev.redeemed++;prev.hunters.add(o.user_id);const k=twDateKey(dt);if(prevDaily[k]){prevDaily[k].revenue+=num(o.subtotal);prevDaily[k].orders++;}}}summary.uniqueHunters=hunters.size;summary.aov=summary.redeemed?summary.revenue/summary.redeemed:0;const labels=['11:00–14:00','14:00–17:00','17:00–20:00','20:00–23:00'],maxH=Math.max(...hours),best=maxH>0?hours.indexOf(maxH):-1,hourBuckets=labels.map((label,i)=>({label,count:hours[i],best:i===best})),topItems=Object.values(items).sort((a,b)=>b.count-a.count).slice(0,8),insights=[];if(best>=0)insights.push(`高峰時段是 ${labels[best]}，可嘗試提前約 30 分鐘完成上架。`);if(topItems.length)insights.push(`「${topItems[0].name}」是本期救援份數最高的獵物，共 ${topItems[0].count} 份。`);const bestDay=Object.values(daily).sort((a,b)=>b.revenue-a.revenue)[0];if(bestDay?.revenue>0)insights.push(`${bestDay.label} 是本期營收表現最好的一天，惜食營收 ${Math.round(bestDay.revenue).toLocaleString('zh-TW')} 元。`);const inv=await env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN event_type IN ('OPEN','RESTOCK') AND quantity_delta>0 THEN quantity_delta ELSE 0 END),0) available,COALESCE(SUM(CASE WHEN event_type='SALE_CONFIRMED' THEN 1 ELSE 0 END),0) sold,COALESCE(SUM(CASE WHEN event_type='WITHDRAW' THEN ABS(quantity_delta) ELSE 0 END),0) withdrawn FROM inventory_events WHERE shop_id=? AND datetime(created_at)>=datetime(?)`).bind(shopId,start.toISOString()).first();const sellThrough={available:num(inv?.available),sold:num(inv?.sold),withdrawn:num(inv?.withdrawn),rate:num(inv?.available)>0?num(inv?.sold)/num(inv?.available):0};return {rangeDays:days,summary,compare:{revenuePct:pct(summary.revenue,prev.revenue),ordersPct:pct(summary.redeemed,prev.redeemed),huntersPct:pct(summary.uniqueHunters,prev.hunters.size)},daily:Object.values(daily),previousDaily:Object.values(prevDaily),sellThrough,hourBuckets,bestHour:best>=0?hourBuckets[best]:null,topItems,insights,generatedAt:isoNow()};}
async function analyticsBundle(env,p) {const uid=String(p.uid||''),shopId=clean(p.shopId,100),out={};for(const d of [7,30,90]){const a=await analytics(env,uid,shopId,d);if(!a)return {status:'error',msg:'無權限或找不到店鋪'};out[String(d)]=a;}return {status:'success',analyticsByRange:out};}

async function setResponsible(env,p) {const uid=String(p.uid||''),shopId=clean(p.shopId,100),mode=String(p.responsibleMode||'SAME')==='OTHER'?'OTHER':'SAME';const shop=await ownedShop(env,uid,shopId);if(!shop)return {status:'error',msg:'無權限管理此店'};const acc=await env.DB.prepare(`SELECT ma.kyc_status FROM shops s JOIN merchant_accounts ma ON ma.account_id=s.merchant_account_id WHERE s.shop_id=?`).bind(shopId).first(),inherit=mode==='SAME'&&normalizeVerified(acc?.kyc_status),now=isoNow();await env.DB.prepare(`INSERT INTO shop_business_profiles(shop_id,responsible_mode,responsible_name,responsible_phone,kyc_inherited,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(shop_id) DO UPDATE SET responsible_mode=excluded.responsible_mode,responsible_name=excluded.responsible_name,responsible_phone=excluded.responsible_phone,kyc_inherited=excluded.kyc_inherited,updated_at=excluded.updated_at`).bind(shopId,mode,clean(p.responsibleName,100),clean(p.responsiblePhone,30),inherit?1:0,now,now).run();return {status:'success',kycInherited:inherit,responsibleMode:mode};}
async function setWatch(env,p) {const uid=String(p.uid||''),shopId=clean(p.shopId,100),active=String(p.active??'1')==='1';if(!uid||uid==='LINE_GUEST')return {status:'error',msg:'請先登入 LINE'};await ensureUser(env,uid);if(!await env.DB.prepare(`SELECT 1 x FROM shops WHERE shop_id=? AND status='ACTIVE'`).bind(shopId).first())return {status:'error',msg:'找不到獵場'};const now=isoNow();if(active)await env.DB.prepare(`INSERT INTO shop_watchlist(watch_id,user_id,shop_id,status,created_at,updated_at) VALUES(?,?,?,'ACTIVE',?,?) ON CONFLICT(user_id,shop_id) DO UPDATE SET status='ACTIVE',updated_at=excluded.updated_at`).bind(id('W'),uid,shopId,now,now).run();else await env.DB.prepare(`UPDATE shop_watchlist SET status='CANCELLED',updated_at=? WHERE user_id=? AND shop_id=?`).bind(now,uid,shopId).run();const c=await env.DB.prepare(`SELECT COUNT(*) n FROM shop_watchlist WHERE shop_id=? AND status='ACTIVE'`).bind(shopId).first();return {status:'success',watching:active,watchers:num(c?.n)};}
async function knockShop(env,p) {const uid=String(p.uid||''),shopId=clean(p.shopId,100);if(!uid||uid==='LINE_GUEST')return {status:'error',msg:'請先登入 LINE 才能敲碗'};await ensureUser(env,uid);const shop=await env.DB.prepare(`SELECT s.name,s.email,ma.owner_user_id FROM shops s JOIN merchant_accounts ma ON ma.account_id=s.merchant_account_id WHERE s.shop_id=? AND s.status='ACTIVE'`).bind(shopId).first();if(!shop)return {status:'error',msg:'找不到這間已註冊獵場'};const today=twDateKey(),now=isoNow(),existing=await env.DB.prepare(`SELECT knock_id FROM knock_requests WHERE user_id=? AND shop_id=? AND knock_date=?`).bind(uid,shopId,today).first();if(!existing)await env.DB.prepare(`INSERT INTO knock_requests(knock_id,user_id,shop_id,knock_date,source,created_at) VALUES(?,?,?,?,?,?)`).bind(id('KNK'),uid,shopId,today,'RADAR',now).run();if(bool(p.subscribe))await setWatch(env,{uid,shopId,active:'1'});const count=await env.DB.prepare(`SELECT COUNT(*) n FROM knock_requests WHERE shop_id=? AND knock_date=?`).bind(shopId,today).first();if(!existing){const nid=id('NOTIF'),body=`今天已有 ${num(count?.n)} 位獵人在等「${shop.name}」開賣惜食品。`;await env.DB.batch([env.DB.prepare(`INSERT INTO notifications(notification_id,audience_type,user_id,shop_id,notification_type,title,body,deep_link,status,created_at) VALUES(?,'MERCHANT',?,?,'KNOCK','有獵人在敲碗',?,'index.html#merchant','UNREAD',?)`).bind(nid,shop.owner_user_id,shopId,body,now)]);if(shop.email&&[1,3,10].includes(num(count?.n)))await env.DB.prepare(`INSERT INTO notification_queue(queue_id,notification_id,channel,recipient,status,attempts,next_attempt_at,created_at,updated_at) VALUES(?,?, 'EMAIL',?,'PENDING',0,?,?,?)`).bind(id('Q'),nid,shop.email,now,now,now).run();}
  const watching=!!(await env.DB.prepare(`SELECT 1 x FROM shop_watchlist WHERE user_id=? AND shop_id=? AND status='ACTIVE'`).bind(uid,shopId).first());return {status:'success',alreadyKnocked:!!existing,knockToday:num(count?.n),watching,hunt:{shopId,name:shop.name,address:'',knockToday:num(count?.n),watching}};
}
async function myHunts(env,p) {const uid=String(p.uid||'');if(!uid||uid==='LINE_GUEST')return {status:'error',msg:'請先登入 LINE'};const today=twDateKey();const [h,n,g]=await Promise.all([env.DB.prepare(`SELECT s.shop_id,s.name,s.address,sw.status,COALESCE(k.n,0) knockToday,CASE WHEN EXISTS(SELECT 1 FROM shop_items i JOIN item_sale_sessions ses ON ses.item_id=i.item_id AND ses.status='OPEN' AND datetime(ses.auto_close_at)>CURRENT_TIMESTAMP WHERE i.shop_id=s.shop_id AND i.status='ON' AND i.current_stock>0) THEN 1 ELSE 0 END online FROM shop_watchlist sw JOIN shops s ON s.shop_id=sw.shop_id LEFT JOIN (SELECT shop_id,COUNT(*) n FROM knock_requests WHERE knock_date=? GROUP BY shop_id) k ON k.shop_id=s.shop_id WHERE sw.user_id=? AND sw.status='ACTIVE' ORDER BY datetime(sw.updated_at) DESC`).bind(today,uid).all(),env.DB.prepare(`SELECT notification_id id,notification_type type,shop_id shopId,title,body,status,created_at createdAt,read_at readAt,deep_link deepLink FROM notifications WHERE user_id=? AND audience_type='HUNTER' AND status<>'ARCHIVED' ORDER BY datetime(created_at) DESC LIMIT 30`).bind(uid).all(),growthStats(env,uid)]);return {status:'success',hunts:(h.results||[]).map(x=>({shopId:x.shop_id,name:x.name,address:x.address||'',knockToday:num(x.knockToday),watching:true,online:!!x.online})),notifications:n.results||[],growthStats:g};}
async function markNotification(env,p,all=false) {const uid=String(p.uid||''),now=isoNow();if(all){const r=await env.DB.prepare(`UPDATE notifications SET status='READ',read_at=? WHERE user_id=? AND audience_type='HUNTER' AND status='UNREAD'`).bind(now,uid).run();return {status:'success',marked:num(r.meta?.changes)};}const r=await env.DB.prepare(`UPDATE notifications SET status='READ',read_at=? WHERE notification_id=? AND user_id=? AND audience_type='HUNTER'`).bind(now,clean(p.notificationId,100),uid).run();return {status:'success',marked:num(r.meta?.changes)};}

async function googlePlaceSearch(env,query,uid,lat,lng,internal=false) {
  const key=env.GOOGLE_PLACES_API_KEY;if(!key)return {status:'config_required',msg:'SEARCH_UNAVAILABLE',places:[]};query=String(query||'').trim().slice(0,80);if(query.length<2)return {status:'success',places:[]};
  if(!internal){if(!uid||uid==='LINE_GUEST')return {status:'limited',code:'LOGIN_REQUIRED',msg:'請先登入 LINE 才能搜尋 Google 店家'};await ensureUser(env,uid);const now=isoNow(),m1=new Date(Date.now()-60000).toISOString(),m10=new Date(Date.now()-600000).toISOString(),day=twDateKey();const [a,b,c,d]=await Promise.all([env.DB.prepare(`SELECT COUNT(*) n FROM api_usage_logs WHERE user_id=? AND api_name='PLACES_TEXT_SEARCH' AND datetime(created_at)>=datetime(?)`).bind(uid,m1).first(),env.DB.prepare(`SELECT COUNT(*) n FROM api_usage_logs WHERE user_id=? AND api_name='PLACES_TEXT_SEARCH' AND datetime(created_at)>=datetime(?)`).bind(uid,m10).first(),env.DB.prepare(`SELECT COUNT(*) n FROM api_usage_logs WHERE user_id=? AND api_name='PLACES_TEXT_SEARCH' AND usage_date=? AND status='OK'`).bind(uid,day).first(),env.DB.prepare(`SELECT COUNT(*) n FROM api_usage_logs WHERE api_name='PLACES_TEXT_SEARCH' AND usage_date=? AND status='OK'`).bind(day).first()]);if(num(a?.n)>=5)return {status:'limited',code:'RATE_MINUTE',msg:'搜尋太頻繁，請稍後再試'};if(num(b?.n)>=15)return {status:'limited',code:'RATE_10MIN',msg:'短時間搜尋次數較多，休息一下再繼續'};if(num(c?.n)>=30)return {status:'limited',code:'USER_DAILY_LIMIT',msg:'今天搜尋店家的次數已達上限，明天再繼續探索'};if(num(d?.n)>=150)return {status:'limited',code:'PLATFORM_DAILY_LIMIT',msg:'今天的新獵場搜尋額度已用完，既有 SEEFOOD 獵場仍可正常使用'};}
  const qh=await sha256Hex(`${query.toLowerCase()}|${Math.round(num(lat))}|${Math.round(num(lng))}`),cacheKey=new Request(`https://seefood.internal/places/${qh}`);try{const hit=await caches.default.match(cacheKey);if(hit)return {status:'success',places:await hit.json(),cached:true};}catch(_e){}
  const body={textQuery:query,languageCode:'zh-TW',regionCode:'TW',maxResultCount:8};if(num(lat)&&num(lng))body.locationBias={circle:{center:{latitude:num(lat),longitude:num(lng)},radius:30000}};let response,raw;try{response=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents'},body:JSON.stringify(body)});raw=await response.text();}catch(e){return {status:'error',msg:'SEARCH_TEMPORARY_UNAVAILABLE',reason:'NETWORK'};}if(!response.ok){if(!internal)await env.DB.prepare(`INSERT INTO api_usage_logs(usage_id,usage_date,user_id,api_name,query_hash,result_count,status,created_at) VALUES(?,?,?,?,?,0,?,?)`).bind(id('API'),twDateKey(),uid,'PLACES_TEXT_SEARCH',qh,'ERROR',isoNow()).run();return {status:'error',msg:'SEARCH_TEMPORARY_UNAVAILABLE',reason:'GOOGLE_PLACES_ERROR',code:response.status};}
  const j=JSON.parse(raw||'{}'),places=(j.places||[]).map(x=>{let city='',district='';for(const c of x.addressComponents||[]){const t=c.types||[];if(t.includes('administrative_area_level_1'))city=c.longText||city;if(t.includes('administrative_area_level_3')||t.includes('sublocality_level_1'))district=c.longText||district;}return {googlePlaceId:x.id||'',name:x.displayName?.text||'',address:x.formattedAddress||'',lat:x.location?.latitude||0,lng:x.location?.longitude||0,city,district};});try{await caches.default.put(cacheKey,new Response(JSON.stringify(places),{headers:{'Content-Type':'application/json','Cache-Control':'max-age=600'}}));}catch(_e){}if(!internal)await env.DB.prepare(`INSERT INTO api_usage_logs(usage_id,usage_date,user_id,api_name,query_hash,result_count,status,created_at) VALUES(?,?,?,?,?,?, 'OK',?)`).bind(id('API'),twDateKey(),uid,'PLACES_TEXT_SEARCH',qh,places.length,isoNow()).run();return {status:'success',places};
}
async function recommendPlace(env,p) {const uid=String(p.uid||'');if(!uid||uid==='LINE_GUEST')return {status:'error',msg:'請先登入 LINE 才能推薦獵場'};await ensureUser(env,uid);const place=clean(p.googlePlaceId,200),name=clean(p.name,150),address=clean(p.address,400);if(!place||!name||!address)return {status:'error',msg:'推薦資料不完整'};let c=await env.DB.prepare(`SELECT * FROM store_candidates WHERE google_place_id=?`).bind(place).first(),now=isoNow();if(!c){const cid=id('CAND');await env.DB.prepare(`INSERT INTO store_candidates(candidate_id,google_place_id,name,formatted_address,latitude,longitude,city,district,status,recommend_count,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'CANDIDATE',0,?,?)`).bind(cid,place,name,address,num(p.lat),num(p.lng),clean(p.city,80),clean(p.district,80),now,now).run();c={candidate_id:cid,recommend_count:0};}const ex=await env.DB.prepare(`SELECT recommendation_id FROM store_recommendations WHERE user_id=? AND candidate_id=?`).bind(uid,c.candidate_id).first();if(!ex){await env.DB.batch([env.DB.prepare(`INSERT INTO store_recommendations(recommendation_id,user_id,candidate_id,source,created_at) VALUES(?,?,?,'RADAR_GOOGLE_PLACES',?)`).bind(id('REC'),uid,c.candidate_id,now),env.DB.prepare(`UPDATE store_candidates SET recommend_count=recommend_count+1,updated_at=? WHERE candidate_id=?`).bind(now,c.candidate_id)]);}const fresh=await env.DB.prepare(`SELECT recommend_count FROM store_candidates WHERE candidate_id=?`).bind(c.candidate_id).first();return {status:'success',alreadyRecommended:!!ex,recommendCount:num(fresh?.recommend_count),candidateId:c.candidate_id,stats:await growthStats(env,uid)};}

async function partnerOnboarding(env,uid) {let identity=await env.DB.prepare(`SELECT * FROM identities WHERE user_id=?`).bind(uid).first(),contract=await env.DB.prepare(`SELECT * FROM partner_contracts WHERE user_id=? AND contract_version=? AND status='SIGNED' ORDER BY datetime(signed_at) DESC LIMIT 1`).bind(uid,PARTNER_CONTRACT_VERSION).first(),pay=await env.DB.prepare(`SELECT * FROM partner_payout_profiles WHERE user_id=?`).bind(uid).first();const kyc=normalizeVerified(identity?.kyc_status)?'VERIFIED_BASIC':(identity?.kyc_status||'NOT_STARTED'),cs=contract?'SIGNED':'NOT_SIGNED',ps=pay?.status==='VERIFIED'?'VERIFIED_BASIC':(pay?.status||'NOT_STARTED');let state=kyc!=='VERIFIED_BASIC'?(kyc==='REVIEWING'?'KYC_REVIEWING':'KYC_PENDING'):cs!=='SIGNED'?'CONTRACT_PENDING':ps!=='VERIFIED_BASIC'?'PAYOUT_PENDING':'PAYOUT_READY';return {state,kycStatus:kyc,contractStatus:cs,contractVersion:contract?.contract_version||'',requiredContractVersion:PARTNER_CONTRACT_VERSION,payoutStatus:ps,legalName:identity?.legal_name||'',bankMasked:pay?.bank_account_last5?`•••• ${pay.bank_account_last5}`:'',bankOwner:pay?.account_holder||'',payoutReady:state==='PAYOUT_READY'};}
async function storePrivateDoc(env,{ownerType,ownerId,documentType,data,mime}) {if(!env.DOCS)throw new Error('R2_DOCS_NOT_CONFIGURED');const key=`${ownerType.toLowerCase()}/${ownerId}/${documentType}/${crypto.randomUUID()}`;const bytes=base64Bytes(data),hash=await sha256Hex(String(data).slice(-100000));await env.DOCS.put(key,bytes,{httpMetadata:{contentType:mime}});const now=isoNow();await env.DB.prepare(`INSERT INTO document_records(document_id,owner_type,owner_id,document_type,status,storage_provider,storage_key,mime_type,sha256,created_at,updated_at) VALUES(?,?,?,?, 'ACTIVE','R2',?,?,?,?,?)`).bind(id('DOC'),ownerType,ownerId,documentType,key,mime,hash,now,now).run();return key;}
async function submitPartnerIdentity(env,p) {const uid=String(p.uid||'');if(!uid||uid==='LINE_GUEST')return {status:'error',msg:'請先登入 LINE'};await ensureUser(env,uid);const existing=await env.DB.prepare(`SELECT * FROM identities WHERE user_id=?`).bind(uid).first();if(normalizeVerified(existing?.kyc_status))return {status:'success',onboarding:await partnerOnboarding(env,uid),reused:true};const name=clean(p.legalName,100),legal=clean(p.legalId,30).toUpperCase(),img=String(p.idCardImage||'');if(!name||!isValidTwId(legal)||img.length<5000)return {status:'error',msg:'請填寫真實姓名、有效身分證字號並上傳清晰證件照片'};if(!env.DOCS)return {status:'config_required',msg:'新後端證件儲存尚未綁定 R2'};await storePrivateDoc(env,{ownerType:'PARTNER',ownerId:uid,documentType:'IDENTITY_CARD',data:img,mime:'image/jpeg'});const h=await sha256Hex(legal),now=isoNow();await env.DB.prepare(`INSERT INTO identities(identity_id,user_id,kyc_status,legal_name,legal_id_hash,legal_id_last4,source,created_at,updated_at) VALUES(?,?,'REVIEWING',?,?,?,'PARTNER_KYC',?,?) ON CONFLICT(user_id) DO UPDATE SET kyc_status='REVIEWING',legal_name=excluded.legal_name,legal_id_hash=excluded.legal_id_hash,legal_id_last4=excluded.legal_id_last4,source='PARTNER_KYC',updated_at=excluded.updated_at`).bind(id('IDN'),uid,name,h,legal.slice(-4),now,now).run();await audit(env,{actorType:'USER',actorId:uid,action:'PARTNER_KYC_SUBMITTED',entityType:'IDENTITY',entityId:uid});return {status:'success',reviewing:true,onboarding:await partnerOnboarding(env,uid),msg:'資料已送出審核。審核完成前分潤仍會累積，但暫不可撥款。'};}
async function signReferralContract(env,p,request) {const uid=String(p.uid||''),signed=clean(p.signedName,100),identity=await env.DB.prepare(`SELECT * FROM identities WHERE user_id=?`).bind(uid).first();if(!normalizeVerified(identity?.kyc_status))return {status:'error',msg:'需先完成身分認證'};if(!signed||signed!==identity.legal_name)return {status:'error',msg:'簽署姓名需與實名姓名一致'};const now=isoNow(),ip=request?.headers.get('CF-Connecting-IP'),iph=ip?await sha256Hex(ip):null,ua=(request?.headers.get('User-Agent')||'').slice(0,500);await env.DB.batch([env.DB.prepare(`INSERT INTO partner_contracts(contract_id,user_id,contract_version,status,signed_name,signed_at,signing_source,ip_hash,user_agent,created_at,updated_at) VALUES(?,?,?,'SIGNED',?,?, 'WEB',?,?,?,?) ON CONFLICT(user_id,contract_version) DO UPDATE SET status='SIGNED',signed_name=excluded.signed_name,signed_at=excluded.signed_at,signing_source='WEB',ip_hash=excluded.ip_hash,user_agent=excluded.user_agent,updated_at=excluded.updated_at`).bind(id('RFC'),uid,PARTNER_CONTRACT_VERSION,signed,now,iph,ua,now,now),env.DB.prepare(`INSERT INTO consents(consent_id,user_id,document_type,document_version,status,agreed_at,source,created_at) VALUES(?,?, 'REFERRAL_REVENUE_SHARE',?,'AGREED',?,'WEB',?) ON CONFLICT(user_id,document_type,document_version) DO UPDATE SET status='AGREED',agreed_at=excluded.agreed_at`).bind(id('CONS'),uid,PARTNER_CONSENT_VERSION,now,now)]);return {status:'success',onboarding:await partnerOnboarding(env,uid)};}
async function savePartnerPayout(env,p) {const uid=String(p.uid||''),o=await partnerOnboarding(env,uid);if(o.kycStatus!=='VERIFIED_BASIC'||o.contractStatus!=='SIGNED')return {status:'error',field:'eligibility',msg:'請先完成身分認證與分潤合作約定'};const bank=String(p.bankCode||'').replace(/\D/g,''),branch=clean(p.bankBranch,100),acct=String(p.bankAccount||'').replace(/\D/g,''),owner=clean(p.bankOwner,100);if(!/^\d{3}$/.test(bank))return {status:'error',field:'bankCode',msg:'銀行代碼格式不正確，請輸入 3 碼銀行代碼，例如 004、808。'};if(!/^[0-9]{6,18}$/.test(acct))return {status:'error',field:'bankAccount',msg:'銀行帳號格式不正確，請確認帳號為 6～18 碼數字。'};if(!owner||owner.length<2)return {status:'error',field:'bankOwner',msg:'請填寫正確戶名，需與實際收款帳戶一致。'};let cipher;try{cipher=await encryptSensitive(env,acct);}catch(_e){return {status:'config_required',msg:'新後端加密金鑰尚未設定'};}const now=isoNow();await env.DB.prepare(`INSERT INTO partner_payout_profiles(user_id,status,bank_code,branch_code,account_holder,bank_account_last5,bank_account_ciphertext,verified_at,created_at,updated_at) VALUES(?,'VERIFIED',?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET status='VERIFIED',bank_code=excluded.bank_code,branch_code=excluded.branch_code,account_holder=excluded.account_holder,bank_account_last5=excluded.bank_account_last5,bank_account_ciphertext=excluded.bank_account_ciphertext,verified_at=excluded.verified_at,updated_at=excluded.updated_at`).bind(uid,bank,branch,owner,acct.slice(-5),cipher,now,now,now).run();return {status:'success',onboarding:await partnerOnboarding(env,uid)};}
async function partnerHub(env,p) {
  const uid=String(p.uid||'');
  const [r,count,balances]=await Promise.all([
    env.DB.prepare(`SELECT pcl.shop_id,s.name shop_name,SUM(CASE WHEN pcl.status<>'VOID' THEN 1 ELSE 0 END) transactions,COALESCE(SUM(CASE WHEN pcl.status<>'VOID' THEN pcl.commission_amount_x10000 ELSE 0 END),0) commission_x10000 FROM partner_commission_ledger pcl JOIN shops s ON s.shop_id=pcl.shop_id WHERE pcl.referrer_user_id=? GROUP BY pcl.shop_id,s.name ORDER BY commission_x10000 DESC`).bind(uid).all(),
    env.DB.prepare(`SELECT COUNT(*) n FROM referral_relations WHERE referrer_user_id=? AND status IN ('ACTIVE','PENDING_IDENTITY_CHECK','DORMANT')`).bind(uid).first(),
    env.DB.prepare(`SELECT status,COALESCE(SUM(commission_amount_x10000),0) amount_x10000 FROM partner_commission_ledger WHERE referrer_user_id=? AND status<>'VOID' GROUP BY status`).bind(uid).all()
  ]);
  const shops=(r.results||[]).map(x=>{const c=num(x.commission_x10000)/10000;return {shopId:x.shop_id,shopName:x.shop_name,transactions:num(x.transactions),orderCommission:c,vipCommission:0,totalCommission:c};});
  const by={};for(const x of balances.results||[])by[x.status]=num(x.amount_x10000)/10000;
  return {status:'success',affiliate:{shopCount:num(count?.n),commission:shops.reduce((a,b)=>a+b.orderCommission,0),pendingCommission:by.PENDING_REVIEW||0,availableCommission:by.AVAILABLE||0,requestedCommission:by.REQUESTED||0,paidCommission:by.PAID||0,shops,onboarding:await partnerOnboarding(env,uid)}};
}
async function requestPartnerPayout(env,p) {
  const uid=String(p.uid||'');
  const onboard=await partnerOnboarding(env,uid);
  if(!onboard.payoutReady)return {status:'error',msg:'請先完成身分認證、分潤合作約定與收款資料'};
  await releaseCommissions(env);
  const rows=(await env.DB.prepare(`SELECT pcl.entry_id,pcl.commission_amount_x10000 FROM partner_commission_ledger pcl JOIN orders o ON o.order_id=pcl.order_id WHERE pcl.referrer_user_id=? AND pcl.status='AVAILABLE' AND o.status='REDEEMED' AND NOT EXISTS(SELECT 1 FROM order_disputes d WHERE d.order_id=o.order_id AND d.status NOT IN ('RESOLVED_NO_REFUND','RESOLVED_REFUND','REJECTED','CANCELLED')) ORDER BY datetime(pcl.available_at),datetime(pcl.created_at) LIMIT 500`).bind(uid).all()).results||[];
  if(!rows.length)return {status:'error',msg:'目前沒有可申請撥款的分潤'};
  // Payout requests are integer TWD. Keep any unmatched fractional commission AVAILABLE for a future request.
  const whole=[],fractional=[];for(const r of rows){(num(r.commission_amount_x10000)%10000===0?whole:fractional).push(r);}
  const selected=[...whole];let fractionalSum=0,pair=[];
  for(const r of fractional){pair.push(r);fractionalSum+=num(r.commission_amount_x10000);if(fractionalSum%10000===0){selected.push(...pair);pair=[];fractionalSum=0;}}
  const totalX=selected.reduce((a,r)=>a+num(r.commission_amount_x10000),0);
  if(totalX<10000||totalX%10000!==0)return {status:'error',msg:'目前可撥分潤尚未累積到可匯款的整數金額，餘額會保留繼續累積'};
  const amount=totalX/10000,now=isoNow(),requestId=id('PAYOUT'),stm=[env.DB.prepare(`INSERT INTO partner_payout_requests(payout_request_id,user_id,requested_amount,processing_fee,net_amount,status,requested_at,created_at,updated_at) VALUES(?,?,?,0,?,'REQUESTED',?,?,?)`).bind(requestId,uid,amount,amount,now,now,now)];
  for(const r of selected){stm.push(env.DB.prepare(`INSERT INTO partner_payout_items(payout_request_id,commission_entry_id,amount_x10000,created_at) VALUES(?,?,?,?)`).bind(requestId,r.entry_id,num(r.commission_amount_x10000),now));stm.push(env.DB.prepare(`UPDATE partner_commission_ledger SET status='REQUESTED',updated_at=? WHERE entry_id=? AND status='AVAILABLE'`).bind(now,r.entry_id));}
  await env.DB.batch(stm);
  return {status:'success',payoutRequestId:requestId,requestedAmount:amount,processingFee:0,netAmount:amount,heldFractionalCommission:(rows.reduce((a,r)=>a+num(r.commission_amount_x10000),0)-totalX)/10000};
}

async function resolveReferralIdentity(env,shopId,ownerUid,ownerHash) {const rel=await env.DB.prepare(`SELECT rr.*,i.legal_id_hash ref_hash FROM referral_relations rr LEFT JOIN identities i ON i.user_id=rr.referrer_user_id WHERE rr.shop_id=? LIMIT 1`).bind(shopId).first();if(!rel)return;const now=isoNow();if(rel.referrer_user_id===ownerUid||(ownerHash&&rel.ref_hash&&ownerHash===rel.ref_hash)){await env.DB.batch([env.DB.prepare(`UPDATE referral_relations SET status='SELF_REFERRAL_BLOCKED',terminated_at=?,termination_reason='SAME_ACTUAL_IDENTITY',updated_at=? WHERE relation_id=?`).bind(now,now,rel.relation_id),env.DB.prepare(`UPDATE partner_commission_ledger SET status='VOID',voided_at=?,void_reason='SELF_REFERRAL_BLOCKED',updated_at=? WHERE relation_id=? AND status IN ('PENDING_REVIEW','AVAILABLE')`).bind(now,now,rel.relation_id)]);}else await env.DB.prepare(`UPDATE referral_relations SET status='ACTIVE',updated_at=? WHERE relation_id=? AND status='PENDING_IDENTITY_CHECK'`).bind(now,rel.relation_id).run();}
async function signContract(env,p,request) {const uid=String(p.uid||''),shopId=clean(p.shopId,100),shop=await ownedShop(env,uid,shopId);if(!shop)return {status:'error',msg:'找不到此帳號可管理的店鋪'};if(!env.DOCS)return {status:'config_required',msg:'新後端證件儲存尚未綁定 R2'};const signer=clean(p.signerName,100),legal=clean(p.signerId,30).toUpperCase(),bank=String(p.bankCode||'').replace(/\D/g,''),branch=clean(p.bankBranch,100),acct=String(p.bankAccount||'').replace(/\D/g,''),owner=clean(p.bankOwner,100),risk=kycRisk(p),now=isoNow();const acc=await env.DB.prepare(`SELECT ma.* FROM shops s JOIN merchant_accounts ma ON ma.account_id=s.merchant_account_id WHERE s.shop_id=?`).bind(shopId).first();await storePrivateDoc(env,{ownerType:'MERCHANT_ACCOUNT',ownerId:acc.account_id,documentType:'IDENTITY_OR_REGISTRATION',data:String(p.idCardImage||''),mime:'image/jpeg'});await storePrivateDoc(env,{ownerType:'MERCHANT_ACCOUNT',ownerId:acc.account_id,documentType:'SIGNATURE',data:String(p.signImage||''),mime:'image/png'});await env.DB.prepare(`INSERT INTO kyc_verifications(verification_id,merchant_account_id,shop_id,user_id,status,risk_score,image_quality_score,signature_score,id_format_score,submitted_at,verified_at,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id('KYC'),acc.account_id,shopId,uid,risk.status,risk.riskScore,risk.imageScore,risk.signatureScore,risk.idFormatScore,now,risk.status==='VERIFIED'?now:null,risk.status==='VERIFIED'?'OCR 證號吻合 + 基礎風控通過；不等同政府證件真偽驗證':'品質或 OCR 一致性需補件/人工審核',now).run();if(risk.status==='RESUBMIT_REQUIRED')return {status:'resubmit',kycStatus:risk.status,riskScore:risk.riskScore,msg:'證件照片或簽名品質不足，請重新拍攝清晰完整證件並重新簽名。'};if(risk.status==='MANUAL_REVIEW')return {status:'review',kycStatus:risk.status,riskScore:risk.riskScore,msg:'資料已收件，但系統偵測到品質或一致性風險；請重新補件可加速通過。'};if(!/^\d{3}$/.test(bank)||!/^[0-9]{6,18}$/.test(acct)||!owner)return {status:'error',msg:'銀行資料格式不正確'};let cipher;try{cipher=await encryptSensitive(env,acct);}catch(_e){return {status:'config_required',msg:'新後端加密金鑰尚未設定'};}const h=await sha256Hex(legal),ip=request?.headers.get('CF-Connecting-IP'),iph=ip?await sha256Hex(ip):null,ua=(request?.headers.get('User-Agent')||'').slice(0,500);
  await env.DB.batch([
    env.DB.prepare(`UPDATE merchant_accounts SET kyc_status='VERIFIED',payout_status='VERIFIED',signer_name=?,signer_id_last4=?,verified_at=?,updated_at=? WHERE account_id=?`).bind(signer,legal.slice(-4),now,now,acc.account_id),
    env.DB.prepare(`INSERT INTO merchant_payout_profiles(merchant_account_id,status,bank_code,branch_code,account_holder,bank_account_last5,bank_account_ciphertext,verified_at,created_at,updated_at) VALUES(?,'VERIFIED',?,?,?,?,?,?,?,?) ON CONFLICT(merchant_account_id) DO UPDATE SET status='VERIFIED',bank_code=excluded.bank_code,branch_code=excluded.branch_code,account_holder=excluded.account_holder,bank_account_last5=excluded.bank_account_last5,bank_account_ciphertext=excluded.bank_account_ciphertext,verified_at=excluded.verified_at,updated_at=excluded.updated_at`).bind(acc.account_id,bank,branch,owner,acct.slice(-5),cipher,now,now,now),
    env.DB.prepare(`INSERT INTO identities(identity_id,user_id,kyc_status,legal_name,legal_id_hash,legal_id_last4,verified_at,source,created_at,updated_at) VALUES(?,?,'VERIFIED',?,?,?,?, 'MERCHANT_KYC',?,?) ON CONFLICT(user_id) DO UPDATE SET kyc_status='VERIFIED',legal_name=excluded.legal_name,legal_id_hash=excluded.legal_id_hash,legal_id_last4=excluded.legal_id_last4,verified_at=excluded.verified_at,source='MERCHANT_KYC',updated_at=excluded.updated_at`).bind(id('IDN'),uid,signer,h,legal.slice(-4),now,now,now),
    env.DB.prepare(`INSERT INTO merchant_contracts(contract_id,merchant_account_id,shop_id,contract_version,status,signer_name,signed_at,signing_source,ip_hash,user_agent,created_at,updated_at) VALUES(?,?,?,?,'SIGNED',?,?, 'WEB',?,?,?,?) ON CONFLICT(shop_id,contract_version) DO UPDATE SET status='SIGNED',signer_name=excluded.signer_name,signed_at=excluded.signed_at,signing_source='WEB',ip_hash=excluded.ip_hash,user_agent=excluded.user_agent,updated_at=excluded.updated_at`).bind(id('MCON'),acc.account_id,shopId,MERCHANT_CONTRACT_VERSION,signer,now,iph,ua,now,now)
  ]);
  const inherited=(await env.DB.prepare(`SELECT s.shop_id FROM shops s LEFT JOIN shop_business_profiles bp ON bp.shop_id=s.shop_id WHERE s.merchant_account_id=? AND COALESCE(bp.responsible_mode,'SAME')='SAME'`).bind(acc.account_id).all()).results||[];for(const x of inherited){await env.DB.batch([env.DB.prepare(`UPDATE shop_business_profiles SET kyc_inherited=1,updated_at=? WHERE shop_id=?`).bind(now,x.shop_id),env.DB.prepare(`INSERT INTO merchant_contracts(contract_id,merchant_account_id,shop_id,contract_version,status,signer_name,signed_at,signing_source,created_at,updated_at) VALUES(?,?,?,?,'SIGNED',?,?,'INHERITED_ACCOUNT_KYC',?,?) ON CONFLICT(shop_id,contract_version) DO UPDATE SET status='SIGNED',signer_name=excluded.signer_name,signed_at=excluded.signed_at,signing_source='INHERITED_ACCOUNT_KYC',updated_at=excluded.updated_at`).bind(id('MCON'),acc.account_id,x.shop_id,MERCHANT_CONTRACT_VERSION,signer,now,now,now)]);await resolveReferralIdentity(env,x.shop_id,uid,h);}return {status:'success',kycStatus:'VERIFIED_BASIC',riskScore:risk.riskScore,msg:'商家主帳號基礎實名驗證完成；同主體店鋪可沿用。'};
}
async function upgradePlus(env,p) {const uid=String(p.uid||''),shopId=clean(p.shopId,100);if(!await ownedShop(env,uid,shopId))return {status:'error',msg:'無權限升級此店'};await env.DB.prepare(`UPDATE plus_subscriptions SET status='EXPIRED',updated_at=? WHERE shop_id=? AND status='ACTIVE' AND ends_at IS NOT NULL AND datetime(ends_at)<=CURRENT_TIMESTAMP`).bind(isoNow(),shopId).run();if(await activePlus(env,shopId))return {status:'success',alreadyVip:true,isVip:true};const now=isoNow(),ends=addMs(now,30*86400000);await env.DB.prepare(`INSERT INTO plus_subscriptions(subscription_id,shop_id,plan_code,price_amount,currency,status,starts_at,ends_at,source_order_id,created_at,updated_at) VALUES(?,?,'PLUS',?,'TWD','ACTIVE',?,?,'MERCHANT_SETTLEMENT',?,?)`).bind(id('PLUS'),shopId,PLUS_PRICE,now,ends,now,now).run();await audit(env,{actorType:'USER',actorId:uid,action:'PLUS_ACTIVATED',entityType:'SHOP',entityId:shopId,after:{price:PLUS_PRICE,ends}});return {status:'success',shopId,isVip:true};}

async function settlementPreview(env,period) {
  const selectedPeriod=period||previousPeriod(twPeriod()),b=periodBounds(selectedPeriod);
  if(!b)return {status:'error',msg:'期間格式需為 YYYY-MM-A/B'};
  const refundCutoff=addMs(isoNow(),-REFUND_WINDOW_DAYS*86400000);
  const r=await env.DB.prepare(`
    SELECT
      s.shop_id,s.name,ma.account_id,
      mpp.status payout_status,mpp.bank_code,mpp.branch_code,mpp.account_holder,mpp.bank_account_last5,
      CASE WHEN EXISTS(SELECT 1 FROM merchant_contracts mc WHERE mc.shop_id=s.shop_id AND mc.status='SIGNED') THEN 1 ELSE 0 END signed,
      COALESCE((SELECT SUM(o.subtotal) FROM orders o WHERE o.shop_id=s.shop_id AND o.status IN ('REDEEMED','EXPIRED') AND datetime(COALESCE(o.redeemed_at,o.paid_at,o.created_at))>=datetime(?) AND datetime(COALESCE(o.redeemed_at,o.paid_at,o.created_at))<datetime(?) AND datetime(o.paid_at)<=datetime(?) AND NOT EXISTS(SELECT 1 FROM order_disputes d WHERE d.order_id=o.order_id AND d.status NOT IN ('RESOLVED_NO_REFUND','RESOLVED_REFUND','REJECTED','CANCELLED'))),0) gross,
      COALESCE((SELECT SUM(CASE WHEN o.subtotal>0 THEN MAX(?,ROUND(o.subtotal*?)) ELSE 0 END) FROM orders o WHERE o.shop_id=s.shop_id AND o.status IN ('REDEEMED','EXPIRED') AND datetime(COALESCE(o.redeemed_at,o.paid_at,o.created_at))>=datetime(?) AND datetime(COALESCE(o.redeemed_at,o.paid_at,o.created_at))<datetime(?) AND datetime(o.paid_at)<=datetime(?) AND NOT EXISTS(SELECT 1 FROM order_disputes d WHERE d.order_id=o.order_id AND d.status NOT IN ('RESOLVED_NO_REFUND','RESOLVED_REFUND','REJECTED','CANCELLED'))),0) gateway,
      COALESCE((SELECT SUM(o.subtotal) FROM orders o WHERE o.shop_id=s.shop_id AND o.status IN ('REDEEMED','EXPIRED') AND datetime(COALESCE(o.redeemed_at,o.paid_at,o.created_at))>=datetime(?) AND datetime(COALESCE(o.redeemed_at,o.paid_at,o.created_at))<datetime(?) AND NOT(datetime(o.paid_at)<=datetime(?) AND NOT EXISTS(SELECT 1 FROM order_disputes d WHERE d.order_id=o.order_id AND d.status NOT IN ('RESOLVED_NO_REFUND','RESOLVED_REFUND','REJECTED','CANCELLED')))),0) review_hold,
      COALESCE((SELECT COUNT(*) FROM plus_subscriptions ps WHERE ps.shop_id=s.shop_id AND ps.status<>'REFUNDED' AND datetime(ps.starts_at)>=datetime(?) AND datetime(ps.starts_at)<datetime(?)),0) plus_count
    FROM shops s
    JOIN merchant_accounts ma ON ma.account_id=s.merchant_account_id
    LEFT JOIN merchant_payout_profiles mpp ON mpp.merchant_account_id=ma.account_id
    WHERE s.status='ACTIVE'
    ORDER BY s.shop_id
  `).bind(b.start,b.end,refundCutoff,GATEWAY_MIN,GATEWAY_RATE,b.start,b.end,refundCutoff,b.start,b.end,refundCutoff,b.start,b.end).all();
  const rows=(r.results||[]).map(x=>{
    const gf=num(x.gateway),plus=num(x.plus_count)*PLUS_PRICE,net=Math.max(0,num(x.gross)-gf-plus),approved=!!x.signed&&x.payout_status==='VERIFIED';
    return {shopId:x.shop_id,shopName:x.name,gross:num(x.gross),refundReviewHold:num(x.review_hold),gatewayFee:gf,plusFee:plus,netPayout:net,bankCode:x.bank_code||'',branchCode:x.branch_code||'',bankAccountMasked:x.bank_account_last5?`••••${x.bank_account_last5}`:'',accountHolder:x.account_holder||'',status:approved?'APPROVED':'ON_HOLD',holdReason:!x.signed?'未完簽':x.payout_status!=='VERIFIED'?'收款帳戶未驗證':''};
  });
  return {status:'success',period:selectedPeriod,rows,totalApproved:rows.filter(x=>x.status==='APPROVED').reduce((a,b)=>a+b.netPayout,0)};
}

async function expirePlus(env) {
  const now=isoNow();
  const expired=(await env.DB.prepare(`UPDATE plus_subscriptions SET status='EXPIRED',updated_at=? WHERE subscription_id IN (SELECT subscription_id FROM plus_subscriptions WHERE status='ACTIVE' AND ends_at IS NOT NULL AND datetime(ends_at)<=CURRENT_TIMESTAMP ORDER BY datetime(ends_at) LIMIT 5) RETURNING shop_id`).bind(now).all()).results||[];
  const shops=[...new Set(expired.map(x=>String(x.shop_id)))];
  for(const shopId of shops){
    if(await activePlus(env,shopId))continue;
    const rows=(await env.DB.prepare(`SELECT i.item_id,i.current_stock,ses.session_id FROM shop_items i LEFT JOIN item_sale_sessions ses ON ses.item_id=i.item_id AND ses.status='OPEN' WHERE i.shop_id=? AND i.slot_index>?`).bind(shopId,BASIC_SLOT_LIMIT).all()).results||[];
    const stm=[];
    for(const r of rows){
      if(r.session_id){stm.push(env.DB.prepare(`UPDATE item_sale_sessions SET status='CLOSED',closed_at=?,close_reason='PLUS_EXPIRED_SLOT_LIMIT',updated_at=? WHERE session_id=? AND status='OPEN'`).bind(now,now,r.session_id));stm.push(env.DB.prepare(`INSERT INTO inventory_events(event_id,item_id,shop_id,event_type,quantity_delta,quantity_after,reason,source,created_at) VALUES(?,?,?,'MANUAL_CLOSE',0,?,'PLUS_EXPIRED_SLOT_LIMIT','SYSTEM',?)`).bind(id('INV'),r.item_id,shopId,num(r.current_stock),now));}
      stm.push(env.DB.prepare(`UPDATE shop_items SET status='OFF',updated_at=? WHERE item_id=?`).bind(now,r.item_id));
    }
    if(stm.length)await env.DB.batch(stm);
  }
  return shops.length;
}
async function expireTickets(env) {const now=isoNow();const rows=(await env.DB.prepare(`SELECT ticket_id,order_id FROM tickets WHERE status='ACTIVE' AND datetime(pickup_deadline)<=CURRENT_TIMESTAMP LIMIT 10`).all()).results||[];if(!rows.length)return 0;const stm=[];for(const r of rows){stm.push(env.DB.prepare(`UPDATE tickets SET status='EXPIRED',updated_at=? WHERE ticket_id=? AND status='ACTIVE'`).bind(now,r.ticket_id));stm.push(env.DB.prepare(`UPDATE orders SET status='EXPIRED',updated_at=? WHERE order_id=? AND status='PAID'`).bind(now,r.order_id));stm.push(env.DB.prepare(`INSERT INTO order_status_events(event_id,order_id,from_status,to_status,reason,actor_type,actor_id,created_at) VALUES(?,?,'PAID','EXPIRED','PICKUP_DEADLINE','SYSTEM','CRON',?)`).bind(id('OSE'),r.order_id,now));}await env.DB.batch(stm);return rows.length;}
async function expireItemSessions(env) {
  const now=isoNow(),rows=(await env.DB.prepare(`SELECT ses.session_id,ses.item_id,ses.shop_id,i.current_stock FROM item_sale_sessions ses JOIN shop_items i ON i.item_id=ses.item_id WHERE ses.status='OPEN' AND datetime(ses.auto_close_at)<=CURRENT_TIMESTAMP LIMIT 10`).all()).results||[];
  if(!rows.length)return 0;
  const stm=[];
  for(const r of rows){stm.push(env.DB.prepare(`UPDATE item_sale_sessions SET status='CLOSED',closed_at=?,close_reason='AUTO_TTL_OR_PICKUP_CUTOFF',updated_at=? WHERE session_id=? AND status='OPEN'`).bind(now,now,r.session_id));stm.push(env.DB.prepare(`UPDATE shop_items SET status='OFF',updated_at=? WHERE item_id=? AND status='ON'`).bind(now,r.item_id));stm.push(env.DB.prepare(`INSERT INTO inventory_events(event_id,item_id,shop_id,event_type,quantity_delta,quantity_after,reason,source,created_at) VALUES(?,?,?,'AUTO_CLOSE',0,?,'AUTO_TTL_OR_PICKUP_CUTOFF','CRON',?)`).bind(id('INV'),r.item_id,r.shop_id,num(r.current_stock),now));}
  await env.DB.batch(stm);return rows.length;
}
async function releaseCommissions(env) {const now=isoNow(),r=await env.DB.prepare(`UPDATE partner_commission_ledger SET status='AVAILABLE',available_at=?,updated_at=? WHERE status='PENDING_REVIEW' AND datetime(review_until)<=CURRENT_TIMESTAMP AND order_id IN (SELECT o.order_id FROM orders o WHERE o.status='REDEEMED' AND NOT EXISTS(SELECT 1 FROM order_disputes d WHERE d.order_id=o.order_id AND d.status NOT IN ('RESOLVED_NO_REFUND','RESOLVED_REFUND','REJECTED','CANCELLED'))) AND relation_id IN (SELECT rr.relation_id FROM referral_relations rr JOIN partner_profiles pp ON pp.user_id=rr.referrer_user_id WHERE rr.status='ACTIVE' AND pp.partner_status='ACTIVE')`).bind(now,now).run();return num(r.meta?.changes);}
async function applyDormancy(env) {
  const rule=await latestRule(env),cut=new Date(Date.now()-num(rule.inactivity_days,365)*86400000).toISOString(),now=isoNow();
  const rows=(await env.DB.prepare(`SELECT user_id FROM partner_profiles WHERE partner_status='ACTIVE' AND datetime(COALESCE(last_qualifying_activity_at,created_at))<datetime(?) LIMIT 10`).bind(cut).all()).results||[];
  if(!rows.length)return 0;const stm=[];
  for(const x of rows){stm.push(env.DB.prepare(`UPDATE partner_profiles SET partner_status='DORMANT',dormant_at=?,updated_at=? WHERE user_id=?`).bind(now,now,x.user_id));stm.push(env.DB.prepare(`UPDATE referral_relations SET status='DORMANT',dormant_at=?,updated_at=? WHERE referrer_user_id=? AND status='ACTIVE'`).bind(now,now,x.user_id));}
  await env.DB.batch(stm);return rows.length;
}
async function sendLine(env,to,textBody){if(!env.LINE_CHANNEL_ACCESS_TOKEN)return false;const r=await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`},body:JSON.stringify({to,messages:[{type:'text',text:textBody.slice(0,4900)}]})});return r.ok;}
async function sendEmail(env,to,subject,body,link){if(!env.EMAIL_WEBHOOK_URL)return false;const r=await fetch(env.EMAIL_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json',...(env.EMAIL_WEBHOOK_TOKEN?{'Authorization':`Bearer ${env.EMAIL_WEBHOOK_TOKEN}`}:{})},body:JSON.stringify({to,subject,html:`<h3>${subject}</h3><p>${body}</p>${link?`<p><a href="${link}">立即查看</a></p>`:''}`})});return r.ok;}
async function queueInactiveShopReminders(env) {
  const candidates=(await env.DB.prepare(`SELECT s.shop_id,s.name,s.email,ma.owner_user_id,COALESCE(MAX(i.updated_at),s.created_at) last_activity FROM shops s JOIN merchant_accounts ma ON ma.account_id=s.merchant_account_id LEFT JOIN shop_items i ON i.shop_id=s.shop_id WHERE s.status='ACTIVE' AND COALESCE(s.email,'')<>'' GROUP BY s.shop_id,s.name,s.email,ma.owner_user_id,s.created_at HAVING datetime(COALESCE(MAX(i.updated_at),s.created_at))<=datetime('now','-7 day') LIMIT 5`).all()).results||[];
  let queued=0;const now=isoNow();
  for(const x of candidates){
    const live=await env.DB.prepare(`SELECT 1 x FROM shop_items i JOIN item_sale_sessions ses ON ses.item_id=i.item_id AND ses.status='OPEN' AND datetime(ses.auto_close_at)>CURRENT_TIMESTAMP WHERE i.shop_id=? AND i.status='ON' AND i.current_stock>0 LIMIT 1`).bind(x.shop_id).first();if(live)continue;
    const sent=await env.DB.prepare(`SELECT 1 x FROM notifications WHERE shop_id=? AND audience_type='MERCHANT' AND notification_type='INACTIVE_7D' AND datetime(created_at)>=datetime(?) LIMIT 1`).bind(x.shop_id,x.last_activity).first();if(sent)continue;
    const nid=id('NOTIF'),title='獵人正在您的區域尋找美食！',body=`${x.name} 已有一週未上架惜福品，有剩餘庫存時可以回到商家後台快速開賣。`;
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO notifications(notification_id,audience_type,user_id,shop_id,notification_type,title,body,deep_link,status,created_at) VALUES(?,'MERCHANT',?,?,'INACTIVE_7D',?,?,?,'UNREAD',?)`).bind(nid,x.owner_user_id,x.shop_id,title,body,'index.html#merchant',now),
      env.DB.prepare(`INSERT INTO notification_queue(queue_id,notification_id,channel,recipient,status,attempts,next_attempt_at,created_at,updated_at) VALUES(?,?,'EMAIL',?,'PENDING',0,?,?,?)`).bind(id('Q'),nid,x.email,now,now,now)
    ]);queued++;
  }
  return queued;
}

async function processNotifications(env) {
  const rows=(await env.DB.prepare(`SELECT q.*,n.title,n.body,n.deep_link FROM notification_queue q LEFT JOIN notifications n ON n.notification_id=q.notification_id WHERE q.status IN ('PENDING','RETRY') AND (q.next_attempt_at IS NULL OR datetime(q.next_attempt_at)<=CURRENT_TIMESTAMP) ORDER BY datetime(q.created_at) LIMIT 5`).all()).results||[];
  let sent=0,skipped=0;
  for(const r of rows){
    if((r.channel==='LINE'&&!env.LINE_CHANNEL_ACCESS_TOKEN)||(r.channel==='EMAIL'&&!env.EMAIL_WEBHOOK_URL)){skipped++;continue;}
    const now=isoNow();
    const claim=await env.DB.prepare(`UPDATE notification_queue SET status='PROCESSING',updated_at=? WHERE queue_id=? AND status IN ('PENDING','RETRY') RETURNING queue_id`).bind(now,r.queue_id).first();
    if(!claim)continue;
    let ok=false;
    try{
      if(r.channel==='IN_APP')ok=true;
      else if(r.channel==='LINE')ok=await sendLine(env,r.recipient,`${r.title||'SEEFOOD'}
${r.body||''}${r.deep_link?`
${r.deep_link}`:''}`);
      else if(r.channel==='EMAIL')ok=await sendEmail(env,r.recipient,r.title||'SEEFOOD',r.body||'',r.deep_link||'');
    }catch(_e){ok=false;}
    const attempts=num(r.attempts)+1,next=addMs(now,Math.min(60,2**attempts)*60000),status=ok?'SENT':attempts>=5?'FAILED':'RETRY';
    await env.DB.prepare(`UPDATE notification_queue SET status=?,attempts=?,next_attempt_at=?,last_error=?,sent_at=?,updated_at=? WHERE queue_id=?`).bind(status,attempts,ok?null:next,ok?null:'DELIVERY_FAILED',ok?now:null,now,r.queue_id).run();
    if(ok)sent++;
  }
  return {processed:rows.length-skipped,sent,skippedUnconfigured:skipped};
}
async function cronRun(env) {
  const out={reservations:await releaseExpiredReservations(env,2)},slot=Math.floor(Date.now()/60000)%7;
  if(slot===0)out.plusExpired=await expirePlus(env);
  else if(slot===1)out.tickets=await expireTickets(env);
  else if(slot===2)out.sessions=await expireItemSessions(env);
  else if(slot===3)out.commissions=await releaseCommissions(env);
  else if(slot===4)out.dormantPartners=await applyDormancy(env);
  else if(slot===5)out.inactiveReminderQueued=await queueInactiveShopReminders(env);
  else out.notifications=await processNotifications(env);
  return out;
}

async function action(env,p,request) {
  const a=String(p.action||'');
  switch(a){
    case 'syncCore': return syncCore(env,p);
    case 'syncUser': {const core=await syncCore(env,p);if(core.status!=='success')return core;const userId=String(p.uid||p.lineUid||''),shopId=clean(p.shopId,100)||core.myShops?.[0]?.shopId||'';const dash=shopId?await shopDashboard(env,{uid:userId,shopId}):null,hub=await partnerHub(env,{uid:userId});return {...core,myShop:dash?.myShop||null,affiliate:hub.affiliate};}
    case 'getShopDashboard': return shopDashboard(env,p);
    case 'getMerchantLiveState': return merchantLive(env,String(p.uid||''),clean(p.shopId,100));
    case 'register': return register(env,p);
    case 'updateStatus': return updateStatus(env,p);
    case 'buyItem': return buyItem(env,p,request);
    case 'verifyOrder': return verifyOrder(env,p);
    case 'recordConsent': return recordConsent(env,p);
    case 'getMerchantOrders': return merchantOrders(env,p);
    case 'createDispute': return createDispute(env,p);
    case 'getMerchantAnalyticsBundle': return analyticsBundle(env,p);
    case 'getMerchantAnalytics': {const a=await analytics(env,String(p.uid||''),clean(p.shopId,100),p.days||7);return a?{status:'success',analytics:a}:{status:'error',msg:'無權限或找不到店鋪'};}
    case 'setShopResponsibleMode': return setResponsible(env,p);
    case 'knockShop': return knockShop(env,p);
    case 'setShopWatch': return setWatch(env,p);
    case 'getMyHunts': return myHunts(env,p);
    case 'markHunterNotificationsRead': return markNotification(env,p,true);
    case 'markHunterNotificationRead': return markNotification(env,p,false);
    case 'searchPlaceCandidates': return googlePlaceSearch(env,p.q,String(p.uid||''),p.lat,p.lng,false);
    case 'recommendPlace': return recommendPlace(env,p);
    case 'getPartnerOnboarding': return {status:'success',onboarding:await partnerOnboarding(env,String(p.uid||''))};
    case 'submitPartnerIdentity': return submitPartnerIdentity(env,p);
    case 'signReferralContract': return signReferralContract(env,p,request);
    case 'savePartnerPayout': return savePartnerPayout(env,p);
    case 'getPartnerHub': return partnerHub(env,p);
    case 'requestPartnerPayout': return requestPartnerPayout(env,p);
    case 'reactivatePartner': return reactivatePartner(env,String(p.uid||''));
    case 'signContract': return signContract(env,p,request);
    case 'upgradeVip': return upgradePlus(env,p);
    default: return {status:'error',msg:'無效的操作請求',code:'UNKNOWN_ACTION',action:a};
  }
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Admin-Key'}});
    try{
      if(url.pathname==='/api/health')return json(await health(env));
      if(url.pathname==='/api/home')return json(await homeFeed(env));
      if(url.pathname==='/api/auth/line'&&request.method==='POST'){const p=await formParams(request);return (await lineSessionLogin(env,p)).response;}
      if(url.pathname==='/api/ecpay/return'&&request.method==='POST'){const p=await formParams(request);return ecpayReturn(env,p,request);}
      if(url.pathname==='/api/action'){
        if(request.method==='GET'&&!url.searchParams.get('action'))return json(await homeFeed(env));
        if(request.method!=='POST')return json({status:'error',code:'METHOD_NOT_ALLOWED',msg:'後台操作只接受 POST'},{status:405,headers:{Allow:'POST'}});
        const p=await formParams(request),authError=await enforceActionSession(env,request,p);
        if(authError){const status=authError.httpStatus||401;delete authError.httpStatus;return json(authError,{status});}
        return json(await action(env,p,request));
      }
      if(url.pathname==='/api/admin/order-complaints'&&request.method==='POST'){
        if(!env.ADMIN_API_KEY||request.headers.get('X-Admin-Key')!==env.ADMIN_API_KEY)return json({status:'error',msg:'UNAUTHORIZED'},{status:401});
        const result=await adminOrderComplaint(env,await formParams(request),request),status=result._httpStatus||200;delete result._httpStatus;return json(result,{status});
      }
      if(url.pathname==='/api/admin/settlements'&&request.method==='GET'){if(!env.ADMIN_API_KEY||request.headers.get('X-Admin-Key')!==env.ADMIN_API_KEY)return json({status:'error',msg:'UNAUTHORIZED'},{status:401});return json(await settlementPreview(env,url.searchParams.get('period')));}
      if(url.pathname==='/api/admin/cron'&&request.method==='POST'){if(!env.ADMIN_API_KEY||request.headers.get('X-Admin-Key')!==env.ADMIN_API_KEY)return json({status:'error',msg:'UNAUTHORIZED'},{status:401});return json({status:'success',result:await cronRun(env)});}
      if(url.pathname.startsWith('/api/'))return json({status:'error',message:'API route not found'},{status:404});
      return env.ASSETS.fetch(request);
    }catch(error){console.error('SEEFOOD_WORKER_ERROR',error?.stack||String(error));return json({status:'error',message:error instanceof Error?error.message:String(error)},{status:500});}
  },
  async scheduled(_controller,env,ctx){ctx.waitUntil(cronRun(env).catch(e=>console.error('SEEFOOD_CRON_ERROR',e?.stack||String(e))));}
};
