# SEEFOOD — D1 Main Runtime Candidate RC2.11

本目錄是 SEEFOOD 主站單一 Runtime 的候選版本。目標是讓 `https://seefood.mangowalkers.workers.dev/` 直接使用 Cloudflare Worker + D1，不再用 `?d1=1`、Shadow LIFF 或 GAS fallback 來切換營運後台。

## 目前已完成的整理

- `index.html` 首頁資料固定走 `/api/home`。
- 所有營運 action 固定走 `/api/action`。
- 正式 LIFF ID 固定使用主站設定；登入後一律建立 Worker server session。
- ECPay 返回頁與通知 deep link 已移除 `?d1=1`。
- `wrangler.jsonc` Worker 名稱改為 `seefood`。
- D1 binding 暫時仍保留現有 `DB -> seefood-staging`，避免未確認資料內容前做高風險資料庫搬遷。資料庫名稱只是目前 infrastructure label，不代表還要維護第二個測試網站。
- Plus 推薦排序加權維持 +10；只在「推薦」排序生效。
- Plus 店家身分標示已與「深折扣金色樣式」拆開第一步：所有有效 Plus 店都會顯示 Plus 身分點。深折扣精選樣式的最終適用範圍仍待商模確認。

## 絕對不可直接部署的條件

此包雖然已經是主站 routing，但在以下必要設定確認前，不應直接覆蓋正式 Worker：

1. `LINE_LOGIN_CHANNEL_ID`
2. `SESSION_SECRET`
3. ECPay 正式/測試環境目前要用哪一套：`ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV`、`ECPAY_URL`
4. `DATA_ENCRYPTION_KEY`
5. 私有 R2 `DOCS` binding（商家/Partner KYC 文件）
6. `ADMIN_API_KEY`（HQ 客服/財務 API）
7. 依功能設定：`GOOGLE_PLACES_API_KEY`、`LINE_CHANNEL_ACCESS_TOKEN`、Email webhook

缺少 LINE session 設定時，登入後的營運 action 會 fail-closed；這是刻意的安全機制，不應為了方便而關掉。

## 已確認的核心商模

詳見 `docs/SEEFOOD_MASTER_RULES.md`。重要原則包括：

- Basic 永久免費，平台不抽商家成交百分比。
- Plus $299 / 店 / 30 天，採「無痛升級」：先啟用、後續從貨款所得抵扣；未扣清前不得再次升級，不外部追繳。
- Partner 只分平台服務費的 50%，Plus 與其他平台收入不分潤。
- Plus 只影響「推薦」排序，不干預獵人手動選擇的距離／折扣／剩餘排序。
- Plus 不保證第一名、不保證固定曝光量、不做付費置頂。
- 商家/Partner/退款/結算等商模變更一律先由產品方確認，程式不得自行猜規則。

## Plus 尚未完成的帳務項目

現行 D1 `plus_subscriptions` 能做到立即啟用、30 天到期與當期 Plus fee 顯示，但還沒有完整保存「未扣清 Plus 欠額」與「欠費清零前禁止再次升級」。

這一塊暫不自行實作，因為還需要確認「下個月扣款」在 SEEFOOD 的結算制度中是指：

- 下一個半月結算期，或
- 下一個曆月的貨款所得。

確認後再新增 forward-only migration 與 ledger/settlement 行為。

## D1 / R2 資料原則

- D1：使用者、商家、商品、庫存、訂單、付款、票券、Plus、Partner、分潤、客服、結算、通知、Audit、Risk 等結構資料。
- 私有 R2：證件照片、簽名、未來可能的客服/退款附件。
- Google Sheet / Drive：舊資料先保留做歷史 Archive；D1/R2 穩定後停止作為新 Runtime。

## 測試

```bash
node --check worker.js
node tests/validate.mjs
node tests/schema-contract.mjs
node tests/worker-flow.mjs
node tests/refund-policy.mjs
node tests/migration.mjs
```

RC2.11 候選包目前上述測試全部 PASS。
