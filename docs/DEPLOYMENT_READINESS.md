# SEEFOOD RC2.11 Deployment Readiness

## 已完成

- [x] Main `index.html` 不再用 `?d1=1` 切 Runtime。
- [x] Main action 固定 `/api/action`。
- [x] Home Feed 固定 `/api/home`。
- [x] ECPay 回站與通知 deep link 移除 Shadow query。
- [x] 主站固定 production LIFF ID。
- [x] 登入後必須建立 server session。
- [x] Plus +10 只影響推薦排序。
- [x] 所有有效 Plus 店顯示低調 Plus 身分標示。
- [x] 現有自動測試全部 PASS。

## 正式覆蓋主站前阻斷條件

- [ ] Cloudflare 確認 `LINE_LOGIN_CHANNEL_ID`。
- [ ] Cloudflare 建立 `SESSION_SECRET`。
- [ ] 確認 ECPay 正式 / sandbox 目前應使用哪一套並轉成 Worker Secrets。
- [ ] 建立 `DATA_ENCRYPTION_KEY`。
- [ ] 建立 Private R2 bucket + `DOCS` binding。
- [ ] 建立 `ADMIN_API_KEY`；未來改用受控 HQ 身分層，不把 key 放公開前端。
- [ ] 確認 Google Places / LINE Push / Email notification secrets。
- [ ] 遠端 D1 備份。
- [ ] 遠端 D1 schema / migration 狀態再次核對。
- [ ] 在主站切換前確認現有 D1 真實資料是否完整，不進行未確認的 DB rename / copy。

## 尚待產品決策

- [ ] Plus $299 「下個月從貨款扣」：以半月結算期還是下一曆月為扣款起點？
- [ ] 深折扣/精選金色樣式：所有店的 <=5 折都可成為精選，還是需要其他條件？

## 尚待工程完成

- [ ] Plus 未扣清餘額 ledger / carry-over migration。
- [ ] Plus 欠額清零前的 re-upgrade gate。
- [ ] HQ Console MVP。
- [ ] Merchant settlement 真正關帳/撥款。
- [ ] Partner payout HQ approve/process/pay。
- [ ] KYC manual review HQ workflow。
- [ ] Risk inbox / resolution workflow。
