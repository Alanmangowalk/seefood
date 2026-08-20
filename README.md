# SEEFOOD — D1 Main Runtime Candidate RC2.14

本目錄是 SEEFOOD 主站單一 Runtime 的候選版本。目標是讓 `https://seefood.mangowalkers.workers.dev/` 直接使用 Cloudflare Worker + D1，不再用 `?d1=1`、Shadow LIFF 或 GAS fallback 來切換營運後台。

## RC2.14 本次完成

- LINE 登入正式設定收斂：`LINE_LOGIN_CHANNEL_ID=2010392646` 改為公開 Worker variable 固定在部署設定；`SESSION_SECRET` 仍只存在 Cloudflare Secret。
- 主站右上角對外版本維持乾淨的 `3.0`，內部精確 release 僅從 `/api/health` 查看。
- PERF 檢測面板在一般主站與 Radar 預設不顯示。
- 戰情室地圖點的 `地圖查看` 改回 `前往獵場`，點擊回 SEEFOOD 主站。
- `targetShopId` 現在會真正把首頁縮到該店惜食品，不再只定位到同一行政區；可一鍵返回全部獵場。
- 主站維持固定走 `/api/home` + `/api/action`，不回退 GAS。
- Plus 「無痛升級」正式落成資料模型與後端邏輯：
  - 不需先付款，立即開通完整 30 天。
  - 每次開通建立 $299 `plus_billing_charges` 應扣款。
  - 從下一次**實際可撥商家貨款**開始抵扣。
  - 可撥款不足時，只扣可扣金額，未扣餘額 carry-over。
  - 貨款不足不會提前終止本次 Plus；Plus 仍完整使用 30 天。
  - 到期後不外部追繳，但未扣清前禁止再次升級。
  - 清零後可重新手動升級 Plus。
- 新增 `plus_billing_collections`，每次從商家 Settlement 抵扣都可追溯到哪個 Plus charge / settlement batch。
- HQ settlement backend 新增 `CLOSE_PERIOD`：真正關帳時才會消耗 Plus 欠額；`ON_HOLD` 不先扣。
- Settlement preview 改為顯示 Plus 待抵扣餘額、該期預計抵扣與抵扣後餘額。
- 商家 Plus 畫面已說明「立即 30 天／下一次可撥貨款抵扣／不足續扣／不外部追繳／未清零禁止再升級」。
- Plus 曝光規則維持：只影響「推薦」排序，權重 +10；距離／折扣／剩餘排序保持純排序。
- Plus 身分與特殊框分開；所有有效 Plus 有低調身分標示，特殊框仍只屬於 `Plus + <= 5 折`，Basic 不套用 Plus 專屬框。

## D1 migration

RC2.14 新增：

```text
migrations/0002_plus_deferred_billing.sql
```

它新增 2 張表：

```text
plus_billing_charges
plus_billing_collections
```

並加入 schema marker：

```text
3.1.3-PLUS-DEFERRED-BILLING
```

**重要：這個 migration 刻意不把舊 Plus subscriptions 自動轉成欠款。**
原因是歷史 Plus 是否已在 GAS / 人工結算中扣款不能由程式猜；避免部署 migration 後突然對既有店家產生歷史債務。

## 部署順序

在主站 Worker 更新到 RC2.14 前，必須先：

1. 備份遠端 D1。
2. 確認 `0001_partner_rule_v2_reconciliation.sql` 的 schema marker 已存在。
3. 對目前 `DB -> seefood-staging` 套用 `0002_plus_deferred_billing.sql`。
4. 呼叫 `/api/health`，確認 `readiness.plusBilling = CURRENT`。
5. 再更新 Worker + ASSETS。

如果 Worker 先更新、migration 尚未套用，涉及 Plus / Settlement 的 API 會因缺少新表而失敗，因此不可反過來部署。

## 正式部署前仍需確認

LINE 登入必要設定已完成：`LINE_LOGIN_CHANNEL_ID=2010392646`，且 Cloudflare 已建立加密 `SESSION_SECRET`。

仍需在正式切換前處理／確認：

1. 遠端 D1 migration `0001` / `0002`。
2. ECPay 目前應使用的正式 / sandbox 設定：`ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV`、`ECPAY_URL`。
3. `DATA_ENCRYPTION_KEY`。
4. 私有 R2 `DOCS` binding（商家/Partner KYC 文件）。
5. `ADMIN_API_KEY`（HQ 客服/財務 API）。
6. 依功能設定：`GOOGLE_PLACES_API_KEY`、`LINE_CHANNEL_ACCESS_TOKEN`、Email webhook。

缺少 LINE session 設定時，登入後的營運 action 會 fail-closed；這是刻意的安全機制。

## D1 / R2 資料原則

- D1：使用者、商家、商品、庫存、訂單、付款、票券、Plus、Plus 應扣款、Partner、分潤、客服、結算、通知、Audit、Risk 等結構資料。
- Private R2：證件照片、簽名、未來可能的客服 / 退款附件。
- Google Sheet / Drive：舊資料先保留做歷史 Archive；D1/R2 穩定後停止作為新 Runtime。

## 測試

```bash
node --check worker.js
node tests/validate.mjs
node tests/schema-contract.mjs
node tests/worker-flow.mjs
node tests/refund-policy.mjs
node tests/migration.mjs
node tests/plus-billing.mjs
```

RC2.14 候選包目前上述測試全部 PASS。
