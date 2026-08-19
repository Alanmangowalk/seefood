# SEEFOOD D1 Primary — RC2.10.9.4

這是部署到既有 Cloudflare Worker `seefood` 的正式單一路徑版本。首頁、商家後台、戰情室、Guide 與所有營運 action 均使用同網域 Worker + D1；不再使用 `?d1=1`、測試 LIFF、Shadow 分流或 Google Apps Script fallback。

## 不會動到的資料

- 既有 Google 試算表及 GAS 專案保持原樣，只作歷史備份。
- 本包沒有 Google Apps Script Web App URL，也不會讀寫試算表。
- Cloudflare 上現有 D1 的顯示名稱仍是 `seefood-staging`、ID 仍是 `7cdcb658-6db9-443a-9b0a-6135bdc7b055`。這只是舊資源名稱；為避免重建、錯綁或遺失現有 45 張表與資料，本版把它直接視為正式 D1，不另建第二套資料庫。
- 唯一會修改 D1 的檔案是 `migrations/0001_partner_rule_v2_reconciliation.sql`；它只新增正式分潤規則、修正核銷前誤建的未鎖定分潤，及寫入版本標記，不刪除訂單／付款／使用者資料。

## 本版已完成

- `seefood` Worker 成為唯一正式 API；D1 是唯一營運資料來源。
- 28 個主要 action、ECPay callback、Cron、LINE server session、商家帳務、Partner、通知、Analytics、敲碗與 Google Places handler 均在 Worker。
- 分潤規則固定為 `PARTNER-2.0-SERVICE-FEE-ONLY`：只計完成核銷且符合規則的交易服務費 50%；Plus、月費、廣告、SaaS、VIP 與其他加值收入一律 0%。
- 買家不能自行申請退款或爭議。品質／重大不符／無法供餐／食安案件由客服後台建立，付款後 14 天內人工決定；核准後先停止商家入帳，實際返款完成才標記已退款。
- 延遲或逾期未取不受理退款；滿 14 天且無未結申訴的核銷／逾期訂單才可進商家結算。
- Guide 與 Radar 已納入正式包並改接 D1。
- 首頁三張 Banner 有內建文字備援，不再因 API 或圖片失敗整區消失。
- 客服耳機恢復顯示；結帳時才暫時隱藏。
- 效能小視窗預設隱藏，只在網址加 `?perf=1` 時顯示。
- 正式 LIFF ID：`2010392646-KEEBg8gS`。

## 部署前必要條件

1. Cloudflare 帳號已能管理既有 Worker `seefood` 與 D1 `seefood-staging`。
2. 建立私人證件桶 `seefood-private-docs`，不要設為 public；`wrangler.jsonc` 已綁為 `DOCS`。
3. 在 Worker 設定以下必要 Secret：

   - `SESSION_SECRET`：至少 32 bytes 的新隨機值。
   - `LINE_LOGIN_CHANNEL_ID`：必須和正式 LIFF 所屬 LINE Login channel 相同。
   - `ADMIN_API_KEY`：客服／結算管理 API 的長隨機金鑰。
   - `DATA_ENCRYPTION_KEY`：銀行帳戶等敏感資料的長隨機加密金鑰。

4. 正式啟用相應功能前再設定：

   - 金流：`ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV`、`ECPAY_URL`
   - 地點搜尋：`GOOGLE_PLACES_API_KEY`
   - LINE 通知：`LINE_CHANNEL_ACCESS_TOKEN`
   - Email 通知：`EMAIL_WEBHOOK_URL`、`EMAIL_WEBHOOK_TOKEN`

不要把任何 Secret 寫進 HTML、`worker.js`、`wrangler.jsonc`、Git 或聊天內容。

## 安全部署順序

在解壓後的本資料夾執行。不要重新執行過去 Step 2／Step 3 的建表 SQL。

### 1. 登入並確認綁定的是既有 D1

```bash
npx wrangler login
npx wrangler d1 info seefood-staging
npx wrangler d1 time-travel info seefood-staging
```

先把 Time Travel 輸出的目前 bookmark 保存下來。

### 2. 匯出正式 D1 備份

```bash
npx wrangler d1 export seefood-staging --remote --output=../seefood-primary-before-rc2.10.9.4.sql
```

確認匯出檔不是空檔，再繼續。備份放在專案上一層，且 `.assetsignore` 也會排除 SQL／SQLite／DB／Secret 檔，避免被當成靜態資產公開。

### 3. 建立私人 R2 桶（尚未建立才執行）

```bash
npx wrangler r2 bucket create seefood-private-docs
```

### 4. 設定必要 Secret

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put LINE_LOGIN_CHANNEL_ID
npx wrangler secret put ADMIN_API_KEY
npx wrangler secret put DATA_ENCRYPTION_KEY
```

每次等待 Wrangler 顯示輸入提示後再貼值，不要把值直接接在指令後。`wrangler.jsonc` 已宣告這四項為 required，缺少時正式部署會中止。

### 5. 套用唯一增量遷移

```bash
npx wrangler d1 execute seefood-staging --remote --file=./migrations/0001_partner_rule_v2_reconciliation.sql
```

輸出最後三個欄位應符合：

- `partner_v2_rule = 1`
- `refund_policy_marker = 1`
- `reconciled_pre_redeem_entries` 可為 0 或正整數

### 6. 部署到既有正式 Worker

```bash
npx wrangler deploy --strict
```

設定檔名稱固定為 `seefood`，因此會更新既有 `seefood.mangowalkers.workers.dev`，不會建立另一個 Shadow Worker。`keep_vars: true` 會保留 Dashboard 既有一般變數；Cloudflare 部署也不會刪除既有 Secret。

## 部署後驗證

正常正式網址不需任何 query：

- 首頁：`https://seefood.mangowalkers.workers.dev/`
- Guide：`https://seefood.mangowalkers.workers.dev/guide.html`
- Radar：`https://seefood.mangowalkers.workers.dev/radar.html`
- Health：`https://seefood.mangowalkers.workers.dev/api/health`
- 效能診斷：`https://seefood.mangowalkers.workers.dev/?perf=1`

Health 至少應看到：

```text
status = ok
release = 3.0-RC2.10.9.4-D1-PRIMARY
mode = PRIMARY
sourceOfTruth = D1
d1 = connected
readiness.lineSession = ENFORCED
readiness.partnerRule = CURRENT
readiness.refundPolicy = ADMIN_ONLY_14D
readiness.privateDocs = CONFIGURED
readiness.encryption = CONFIGURED
```

若 `ecpay`、`places` 或通知顯示 `NOT_CONFIGURED`，代表相應外部 Secret 尚未設定；D1 本身不會因此被改回 GAS。

## 本機驗證

```bash
node --check worker.js
node tests/validate.mjs
node tests/schema-contract.mjs
node tests/worker-flow.mjs
node tests/refund-policy.mjs
node tests/migration.mjs
```

預期五組測試全部 PASS。完整結果見 `VALIDATION_REPORT.md`。

## 重要回復資訊

- 程式碼回復：Cloudflare Worker 的 Deployments／Versions 可將既有版本重新部署。
- D1 回復：用部署前保存的 Time Travel bookmark 回復；這是覆寫資料庫的破壞性操作，只在確認遷移造成問題時使用。
- Google Sheets／GAS 不在此部署鏈內，不需也不應執行任何回寫、刪除或重新部署。
