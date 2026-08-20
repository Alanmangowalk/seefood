# SEEFOOD RC2.14 Deployment Readiness

## 已完成

- [x] Main `index.html` 不再用 `?d1=1` 切 Runtime。
- [x] Main action 固定 `/api/action`。
- [x] Home Feed 固定 `/api/home`。
- [x] ECPay 回站與通知 deep link 移除 Shadow query。
- [x] 主站固定 production LIFF ID。
- [x] 登入後必須建立 server session。
- [x] Plus +10 只影響推薦排序。
- [x] 最近／折扣／剩餘排序維持純排序，不套 Plus 權重。
- [x] 所有有效 Plus 店顯示低調 Plus 身分標示。
- [x] Plus 專屬框仍只套用 `Plus + <=5折`；Basic 不套用該框。
- [x] Plus 無痛升級：立即完整 30 天，不先付款。
- [x] Plus $299 建立獨立 deferred billing charge。
- [x] 下一次實際可撥貨款開始抵扣。
- [x] 不足額可部分抵扣並 carry-over。
- [x] 不足額不提前終止本次 Plus。
- [x] Plus 到期後未清零禁止再升級；清零後恢復資格。
- [x] Settlement close 時才真正寫入 Plus collection ledger；ON_HOLD 不先扣。
- [x] Plus billing migration 不自動追溯歷史 Plus 欠款。
- [x] 現有自動測試全部 PASS。

## 正式覆蓋主站前阻斷條件

- [ ] 遠端 D1 備份。
- [ ] 確認 migration `0001` 已套用。
- [ ] 對遠端 D1 套用 `0002_plus_deferred_billing.sql`。
- [ ] `/api/health` 確認 `readiness.plusBilling = CURRENT`。
- [x] Cloudflare `LINE_LOGIN_CHANNEL_ID = 2010392646` 已確認；RC2.14 亦固定在 `wrangler.jsonc` 的公開 `vars`。
- [x] Cloudflare `SESSION_SECRET` 已建立為加密 Secret（值不可寫入專案或文件）。
- [ ] 確認 ECPay 正式 / sandbox 目前應使用哪一套並轉成 Worker Secrets。
- [ ] 建立 `DATA_ENCRYPTION_KEY`。
- [ ] 建立 Private R2 bucket + `DOCS` binding。
- [ ] 建立 `ADMIN_API_KEY`；未來改用受控 HQ 身分層，不把 key 放公開前端。
- [ ] 確認 Google Places / LINE Push / Email notification secrets。
- [ ] 遠端 D1 schema / migration 狀態再次核對。
- [ ] 確認現有 D1 真實資料完整，不進行未確認的 DB rename / copy。

## 尚待工程完成

- [ ] HQ Console MVP（目前只有 admin API）。
- [ ] Settlement batch 從 `READY_TO_PAY` 到實際銀行撥款 `PAID` 的 HQ 流程。
- [ ] Partner payout HQ approve/process/pay。
- [ ] KYC manual review HQ workflow。
- [ ] Risk inbox / resolution workflow。
- [ ] Private R2 `DOCS` 實際建立與正式資料搬移策略。
- [ ] Legacy GAS / Sheet / Drive 最終 read-only + archive cutover。

## RC2.14 production UI/auth notes

- The performance audit HUD is **off by default** on the normal production URL; no separate Shadow/test page is required for normal operation.
- The customer-facing header no longer exposes stale internal labels such as `D1-SHADOW`; the detailed runtime release remains available from `/api/health`.
- LINE server session requires two Cloudflare Worker settings before login can work:
  - `LINE_LOGIN_CHANNEL_ID` — normal environment variable; use the LINE Login channel ID that owns the production LIFF app.
  - `SESSION_SECRET` — encrypted secret; use a long random value (32+ random bytes / roughly 43+ URL-safe characters). Never commit it to GitHub or paste it into support/chat.
- The Worker returns machine-readable code `LINE_SESSION_NOT_CONFIGURED` when either setting is missing, while the customer-facing message stays non-technical.
- `wrangler.jsonc` pins `LINE_LOGIN_CHANNEL_ID` as a normal production variable and declares only `SESSION_SECRET` as a required secret.
