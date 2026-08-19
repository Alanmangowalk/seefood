# SEEFOOD RC2.10.9.4 D1 Primary 驗證報告

驗證日期：2026-08-19  
版本：`3.0-RC2.10.9.4-D1-PRIMARY`  
部署目標：既有 Worker `seefood`  
營運資料來源：D1 binding `DB`

## 結論

本地靜態、SQL 契約與流程測試全部通過。正式包不再包含 GAS URL、Shadow query 或測試 LIFF 分流；Index、Radar、Guide 與 Worker 均已收斂為同網域 D1 路徑。

Google 試算表及 GAS 不在此包的讀寫或部署範圍內。本次尚未取得 Cloudflare 帳號授權，因此未遠端執行 D1 遷移、Secret 設定、R2 建立或 Worker 部署；這四項必須依 `README.md` 完成後才算正式上線。

## 基準與保留

- 功能基準：使用者指定的 8/11 23:43 五份檔案；現包已納入更新後的 `index.html`、`guide.html`、`radar.html`。
- 現有 45 張 D1 表：以凍結 Step2A–H schema fixture 驗證，沒有重建或縮減。
- 現有 D1 資源 ID：`7cdcb658-6db9-443a-9b0a-6135bdc7b055`，未更換。
- `database_name` 保持 `seefood-staging` 僅為保護既有資料；程式 health 對外標示 `mode=PRIMARY`、`sourceOfTruth=D1`。

## 自動測試結果

| 驗證項目 | 結果 |
|---|---|
| Worker JavaScript 語法 | PASS |
| 28 個 D1 action + ECPay callback | PASS |
| Index／Guide／Radar inline script 語法（6／1／3） | PASS |
| D1 單一路由、正式 LIFF、Session fail-closed | PASS |
| 45 張表完整 schema 契約 | PASS |
| 231 個 Worker SQL prepare 與凍結 schema 相容 | PASS |
| `commission_amount_x10000`／`amount_x10000` 正式單位 | PASS |
| PAID 不建分潤、REDEEMED 才建 50% 服務費分潤 | PASS |
| 核銷重試 idempotency | PASS |
| Plus／月費／加值收入排除分潤 | PASS |
| 買家自行申訴／退款阻擋 | PASS |
| 延遲／逾期未取退款阻擋 | PASS |
| 客服案件 14 天期限 | PASS |
| 不退款結案 | PASS |
| 人工核准退款 → 暫停入帳 → 金流完成 → 已退款 | PASS |
| 已 REQUESTED／PAID 分潤防止自動改帳 | PASS |
| 分潤 v2 增量遷移與版本標記 | PASS |
| Banner 三入口備援、客服耳機、`?perf=1` 診斷模式 | PASS |
| Guide／Radar 收錄且皆走 D1 | PASS |
| 靜態資產排除 SQL／DB／Secret／Worker 原始碼 | PASS |

實際輸出：

```text
VALIDATION PASS: 28 D1 actions + ECPay callback; inline scripts 6/1/3; primary routing and security gates verified
FULL FROZEN SCHEMA CONTRACT PASS: 45 tables; 231 Worker SQL statements; Step2H x10000 units; forward migration
WORKER FLOW PASS: UID binding; current-contract gate; PAID has no commission; REDEEMED-only 50%; idempotent retry
REFUND POLICY PASS: buyer blocked; late pickup rejected; 14-day gate; no-refund resolution; expired-order payout; admin approval hold; gateway-confirmed refund
D1 FORWARD MIGRATION SQL PASS: v2 rule; pre-redeem reconciliation; requested/paid safety gate; admin-only 14-day refund marker
```

## 政策驗證

### Partner

- 規則版本：`PARTNER-2.0-SERVICE-FEE-ONLY`
- Eligible source：完成核銷、無未結爭議、符合規則的交易服務費
- Rate：50%（5000 bps）
- Plus／VIP／月費／廣告／SaaS／其他加值收入：0%
- 核銷前誤建且仍為 `PENDING_REVIEW`／`AVAILABLE` 的分潤：增量遷移改為 `VOID`
- `REQUESTED`／`PAID`：遷移與退款流程皆不自動修改

### 退款與商家收入

- 買家端 `createDispute` 只回傳客服聯絡指示，不新增案件。
- 客服後台接受品質、重大不符、無法供餐、查無訂單、食安等履約案件。
- 延遲／逾期未取不是合格退款原因。
- 人工核准僅限付款後 14 天內。
- 核准後訂單先變成 `REFUND_PENDING`、付款及商家結算暫停、未鎖定分潤作廢。
- 實際金流返還且填入 gateway reference 後才變成 `REFUNDED`。
- 核銷或逾期未取訂單，須滿 14 天且無未結案件才可納入商家收入。

## 部署前仍須完成的外部項目

1. 匯出遠端 D1 並保存 Time Travel bookmark。
2. 建立 private R2 bucket `seefood-private-docs`。
3. 設定 required secrets：`SESSION_SECRET`、`LINE_LOGIN_CHANNEL_ID`、`ADMIN_API_KEY`、`DATA_ENCRYPTION_KEY`。
4. 在既有 D1 執行唯一增量遷移。
5. 用 `wrangler deploy --strict` 更新既有 `seefood` Worker。
6. 檢查 `/api/health`：Partner 為 `CURRENT`，Line Session／R2／Encryption 為 `CONFIGURED` 或 `ENFORCED`。
7. 若要啟用真實付款、地點搜尋、LINE／Email 通知，再補齊相應外部 Secret 並做實機 smoke test。

未完成上述遠端步驟前，不得把「本地測試全過」解讀為已正式部署。
