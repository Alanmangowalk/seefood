# SEEFOOD D1 Shadow Backend — RC2.10.9.3

這是 SEEFOOD「完整 GAS Runtime 退休」的 Shadow 候選包。它不會取代目前正式站：Worker 名稱固定為 `seefood-d1-shadow`，D1 綁定為 `seefood-staging`，前端也只有在網址帶 `?d1=1` 時才會把營運 API 切到 Worker + D1。

## 本包的基準與範圍

- 功能基準：8/11 23:43 上傳的 `GAS(3).txt`、`index (2).txt`、`guide(3).txt`、`radar(3).txt`、`seefood申請表單 (1)(1).xlsx`。
- 已部署差異參考：RC2.10.9.1 的 GAS 與 Index，只用來保留冷啟動、導覽、捲動及首頁分批提交修正，不取代上述五份基準。
- 本包只包含 `worker.js`、`index.html`、Shadow 設定、前向 D1 修正與測試。
- `guide`、`radar` 尚未審視，刻意不包含也不覆蓋。
- 歷史 D1 Step 2／Step 3 已完成，禁止重跑。

## 已搬入 Worker + D1 的後台範圍

- 首頁 Feed／Banner／獵場資料
- LINE 使用者、同帳號多店與商家 Dashboard
- 商家註冊、KYC metadata、合約與獨立收款資料
- Basic 3 格／Plus 10 格、商品上架與品項級 8 小時 TTL
- 訂單、庫存預留、ECPay callback、票券、核銷、逾期與客服申訴
- 7／30／90 日 Analytics
- 敲碗、Watchlist、站內／LINE／Email 通知佇列
- Partner KYC、v2 合約、推薦關係、分潤台帳與請款
- Settlement、Audit、Risk、Google Places 與排程維護

GAS 的 29 個主要 action 已由 28 個 `/api/action` handler 加上獨立的 `/api/ecpay/return` callback 覆蓋。

## 分潤規則（唯一有效版本）

`PARTNER-2.0-SERVICE-FEE-ONLY`

- 只有訂單成為 `REDEEMED` 後，才建立 Partner commission。
- 金額為實際 `service_fee × 50%`。
- Plus／VIP／月費／廣告／SaaS 與其他加值收入完全排除。
- 未解決爭議不得轉為 `AVAILABLE`，也不得請款。
- 舊 v1 合約不再視為有效，Partner 必須簽 v2。
- 重複核銷／重試透過唯一鍵保持冪等，不會重複分潤。

## 已付款、逾期與人工退款規則

- 已付款訂單不開放買家自行取消、退款或建立爭議。
- 因買家延遲或逾期未取，不受理退款；訂單 `EXPIRED` 在付款滿 14 天且沒有客服案件後，仍可列入商家撥款。
- 餐點品質、品項重大不符、店家無法供餐、店家查無訂單或食安問題，改由官方客服受理。
- 只有帶正確 `X-Admin-Key` 的 `/api/admin/order-complaints` 能建立案件與做人工決策。
- 客服核准退款時先改成 `REFUND_PENDING`，在既有 `refunds` 台帳建立 `PENDING` 紀錄，立即排除商家收入並 void 尚未請款的 Partner commission。
- 實際在金流後台完成返還後，必須提供退款編號，才可把訂單／付款標成 `REFUNDED`、退款台帳標成 `COMPLETED`、客服案件標成 `RESOLVED_REFUND`。
- 人工核准必須在付款後 14 天內；超時由 API 阻擋。
- 若 Partner commission 已是 `REQUESTED`／`PAID`，系統禁止自動調整，必須交財務追回與稽核。
- 已實際請款成功的訂單不直接標成單純 `CANCELLED`，因為該狀態不能證明款項已返還；一律走 `REFUND_PENDING → REFUNDED`。`CANCELLED` 僅保留給未完成付款的取消流程。

## 安全修正

- 所有 `/api/action` 後台操作只接受 `POST`。
- D1 Shadow 未設定 `LINE_LOGIN_CHANNEL_ID` 與 `SESSION_SECRET` 時採 fail-closed，回傳 503；不再相信前端自行傳入的 UID。
- LINE access token 由 Worker 向 LINE 驗證，再建立 HttpOnly／Secure／SameSite=Lax session。
- ECPay callback 必須通過 CheckMacValue。
- ECPay 返回頁、通知深連結與 staging LIFF 重新導向都會保留 `?d1=1`，不會靜默退回舊 GAS。
- 身分／銀行敏感資料需 `DATA_ENCRYPTION_KEY`；證件檔案需私有 R2 `DOCS` binding。
- `.assetsignore` 排除 Worker 原始碼、migration、測試與報告，不會當成靜態資產公開。

## 部署前必要條件

1. 確認目標仍是 staging D1：`seefood-staging`，ID 與 `wrangler.jsonc` 相符。
2. 先匯出遠端 D1 備份。
3. **只執行** `migrations/0001_partner_rule_v2_reconciliation.sql`；不要重跑歷史 Step 2／Step 3。
4. 至少先設定：
   - `LINE_LOGIN_CHANNEL_ID`
   - `SESSION_SECRET`
5. 準備獨立的 staging LIFF ID，並把 Endpoint URL 設為 Shadow 網域。測試網址需使用 `?d1=1&liffId=<staging-liff-id>`；未提供時登入會 fail-closed，避免誤跳正式站。LIFF ID 是公開識別碼，不是 Secret。
6. 測試付款前再設定：
   - `ECPAY_MERCHANT_ID`
   - `ECPAY_HASH_KEY`
   - `ECPAY_HASH_IV`
   - `ECPAY_URL`
7. 測試客服退款前設定 `ADMIN_API_KEY`。
8. 測試 KYC 前設定 `DATA_ENCRYPTION_KEY` 並綁定私有 R2 `DOCS`；可參考 `wrangler.r2.example.jsonc`。
9. 其他依功能設定：`GOOGLE_PLACES_API_KEY`、`LINE_CHANNEL_ACCESS_TOKEN`、`EMAIL_WEBHOOK_URL`、`EMAIL_WEBHOOK_TOKEN`。

所有 Secret 都應用 Cloudflare Secret 設定，不可寫入 repo。

## 建議操作順序

以下命令是操作範例，請在已登入正確 Cloudflare account 的專案目錄執行：

```bash
npx wrangler d1 export seefood-staging --remote --output=seefood-staging-before-partner-v2.sql
npx wrangler d1 execute seefood-staging --remote --file=migrations/0001_partner_rule_v2_reconciliation.sql
npx wrangler deploy
```

部署後先看：

```text
https://<shadow-worker-domain>/api/health
https://<shadow-worker-domain>/?d1=1&liffId=<staging-liff-id>
```

`/api/health` 應顯示：

- `release = 3.0-RC2.10.9.3-D1-SHADOW`
- `d1 = connected`
- `lineSession = ENFORCED`
- `partnerRule = CURRENT`
- `refundPolicy = ADMIN_ONLY_14D`

## Shadow 驗證順序

1. 首頁冷啟動、返回首頁、Guest／LINE 選擇與捲動。
2. 以 staging LIFF ID 登入後建立 server session，確認回跳網址仍有 `d1=1`。
3. 註冊、同帳號多店、切店、Dashboard 與 Live State。
4. Basic／Plus 欄位、上架、下架、補貨與 8 小時 TTL。
5. Checkout → ECPay 成功後確認訂單為 `PAID`，此時不得有分潤。
6. 票券核銷後訂單改為 `REDEEMED`，才建立服務費 50% 分潤。
7. 重複核銷不新增第二筆；客服申訴審核期間不釋放、不請款。
8. 買家端「訂單問題」只導向官方客服，不直接寫 dispute；逾期未取文案明確不退款。
9. 管理端依序測 `OPEN → CLOSE_NO_REFUND`，以及 `OPEN → APPROVE_REFUND → 金流實退 → MARK_REFUNDED`。
10. 確認 14 天內訂單列於客服審核保留、`REFUND_PENDING/REFUNDED` 不入商家收入、滿 14 天的 `REDEEMED/EXPIRED` 才可撥款。
11. v1 Partner 合約顯示待重簽，v2 完成後才可完成 onboarding。
12. Plus $299／店／月正常，但不出現在 Partner commission ledger。
13. Analytics、通知、Settlement／Audit／Risk 最後做整站回歸。

本機可重跑的回歸指令：

```bash
node --check worker.js
node tests/validate.mjs
node tests/schema-contract.mjs
node tests/worker-flow.mjs
node tests/refund-policy.mjs
node tests/migration.mjs
```

`tests/fixtures/frozen_step2a_h_contract.sql` 只是一份測試用 schema contract，明確禁止拿去部署或重建 D1。

未帶 `?d1=1` 的頁面仍走既有 GAS，可作對照與回退。完成整套 Shadow 測試前，不要把正式流量預設切到 D1，也不要停用 GAS。

## 客服後台 API 範例

所有操作都使用 `POST /api/admin/order-complaints` 與 `X-Admin-Key`。這是客服後台／受控操作端點，`ADMIN_API_KEY` 絕對不可放進公開前端。允許的申訴類型為 `QUALITY_ISSUE`、`ITEM_MISMATCH`、`MERCHANT_UNAVAILABLE`、`ORDER_NOT_FOUND`、`FOOD_SAFETY`、`OTHER_QUALITY_OR_FULFILLMENT`；沒有「買家延遲取餐」類型。

本包完成的是客服後台 API 與資料狀態機，沒有新增一個公開的客服管理畫面；現有內部後台需串接此端點，或另做只供授權員工使用的管理介面。

建立客服案件：

```json
{
  "operation": "OPEN",
  "orderId": "ORDER_ID",
  "adminId": "STAFF_ID",
  "disputeType": "QUALITY_ISSUE",
  "description": "客服查核紀錄"
}
```

人工判斷不退款：

```json
{
  "operation": "CLOSE_NO_REFUND",
  "orderId": "ORDER_ID",
  "adminId": "STAFF_ID",
  "resolutionNote": "判斷依據"
}
```

人工核准退款、先停止入帳：

```json
{
  "operation": "APPROVE_REFUND",
  "orderId": "ORDER_ID",
  "adminId": "STAFF_ID",
  "resolutionNote": "退款核准依據"
}
```

實際完成金流返還後才能確認：

```json
{
  "operation": "MARK_REFUNDED",
  "orderId": "ORDER_ID",
  "adminId": "STAFF_ID",
  "gatewayReference": "ECPAY_REFUND_REFERENCE"
}
```

## Migration 注意事項

本次 migration 會：

- 新增／確認 v2 service-fee-only 規則。
- 將任何「尚未 `REDEEMED`，卻已是 `PENDING_REVIEW` 或 `AVAILABLE`」的 Shadow 分潤標為 `VOID`。
- `REQUESTED`／`PAID` 紀錄不自動更動，必須人工稽核。

由於第二項是資料修正，執行前必須備份。它是 forward-only，不應重複套用舊版遷移來回滾。
