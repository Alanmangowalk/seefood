# SEEFOOD D1 Shadow 驗證報告

版本：`3.0-RC2.10.9.3-D1-SHADOW`  
驗證日期：2026-08-19  
狀態：本機候選包通過；尚未部署、尚未切正式流量

## 基準鎖定

| 角色 | 檔案 | SHA-256 |
|---|---|---|
| 正式功能基準 | `GAS(3).txt` | `b26266df6a2d66a1666067ff30fb6fe4b38e8ca92a9bd56b0b0988d22a1e8e61` |
| 正式功能基準 | `index (2).txt` | `f589f39ef3f985a078df29df3aaa7c4c07bb385670fc83da21d507c5ed3d22e1` |
| 暫不修改 | `guide(3).txt` | `59f648b09854e984ea9e72be7230c3ca8dbbac6a09b3fd917aabd42852d6271d` |
| 暫不修改 | `radar(3).txt` | `5145aa69d5dc962fa059d50d327068901e0517ad0c4585bf61d803a7908c9745` |
| 資料／結構參考 | `seefood申請表單 (1)(1).xlsx` | `4c0574c1085a917c96354569ec090176533ad9b932052ba60fd1000ef3eb40a6` |
| 已部署差異參考 | RC2.10.9.1 GAS | `1231b3c0e7d8bd9a005b8197fd973c9a48182af5372e723a7e0b1443481bd1c0` |
| 已部署差異參考 | RC2.10.9.1 Index | `7a09497c80ebf5fbc16abd0d8b31065ee769b58cbc79ad4155d2f2ad936f6a72` |
| Frozen D1 schema | Step2A Core | `a0de5775f182542ed5b3f0905b376844aac17d30766ec7034a418e172920e81c` |
| Frozen D1 schema | Step2B Inventory | `4d18aa54be56442191db870eee1ff8ef9e7a71756f475c5617baebbeb1b1bf5b` |
| Frozen D1 schema | Step2C Transactions | `0387f87bedf9be4a965dea414ebca728cb5ead63dbd5cce0eb33c38e138ffc76` |
| Frozen D1 schema | Step2D Growth／Notifications | `208742f8ad178d569e7864b2061ebddf7bcdb877a849881f4a1bca9421def2d3` |
| Frozen D1 schema | Step2E Partner | `d66075dce3e8c0cb61360de042f12edde56a9bd0f234d4f5d0df245edba44bc5` |
| Frozen D1 schema | Step2F Operations／HQ | `293208476f7bb2e4dc16b58131aab124cf856d4a0e4aeb270cf6754cd65c135c` |
| Frozen D1 schema | Step2G Migration Completeness | `15bfe2bc5b021ecbe2fb69d40ba829afc3d7858056a8d6df1984bbc32ede7eaa` |
| Final frozen D1 patch | Step2H Final Schema Audit | `8c13bad73f3c71ae21184773fd55a7d705f9bbc81c74c43ad2ba1c26ce86fb10` |

RC2.10.9.1 只作已部署 UI／效能差異參考；沒有覆蓋五份正確上傳檔的功能權威。

Schema 判讀以較後套用且已凍結的 Step2H 為最高優先：它會 DROP／重建 Partner commission tables，因此舊 Step2E 的 `commission_amount` 已由最終 `commission_amount_x10000` 取代；本候選包依 Step2H 使用 `commission_amount_x10000`／`amount_x10000`。

## 已修正的高風險偏差

| 項目 | 舊候選問題 | 本版處理 |
|---|---|---|
| Partner 規則 | 仍使用 v1 常數／合約 | 全面鎖定 `PARTNER-2.0-SERVICE-FEE-ONLY` |
| 分潤時點 | ECPay 成功即可能建立 | 付款只進 `PAID`；只有核銷成 `REDEEMED` 才建立 |
| Plus／其他收入 | 存在舊規則復活風險 | commission source 固定 `SERVICE_FEE`，rule `plus_eligible=0` |
| 合約 | 舊版本仍可能通過 | 只接受精確 v2 合約版本 |
| 買家爭議入口 | 買家可直接建立 dispute，且逾期未取也可能提出 | 自助入口改為官方客服；買家延遲／逾期未取明確不受理退款 |
| 客服退款 | 缺少可稽核的人工決策狀態機 | Admin-only `OPEN / CLOSE_NO_REFUND / APPROVE_REFUND / MARK_REFUNDED`，退款完成需金流編號 |
| D1 約束 | 自訂 dispute 狀態會被既有 CHECK constraint 拒絕 | 依 frozen Step2F 使用 `UNDER_REVIEW / RESOLVED_NO_REFUND / RESOLVED_REFUND`，並寫既有 `refunds` 台帳 |
| Partner 金額欄位 | 舊 Step2E 欄名可能被誤當成最終結構 | 依最後 Step2H 的重建結果使用 `commission_amount_x10000`／`amount_x10000` |
| 14 天入帳 | 已核銷可能立即顯示為商家應收；逾期未取永遠不入帳 | `REDEEMED/EXPIRED` 付款滿 14 天且無未結客服案件才可撥款；退款中／已退款排除 |
| 分潤爭議 | 可用分潤可能繼續釋放／請款 | 未解決客服案件阻擋 release 與 payout；核准退款即 void 未請款分潤 |
| 身分驗證 | Secret 缺失時相信 request UID | fail-closed；缺設定 503、缺 session 401、UID 不符拒絕 |
| HTTP method | GET 可能觸發後台 action | `/api/action` mutation 僅接受 POST |
| 健康檢查 | 可能在 read path 寫 rule | health 改為唯讀；新推薦關係建立時才確保規則存在 |
| 前端基線 | 舊候選未含最後部署的冷啟動／捲動修正 | 以 RC2.10.9.1 已部署 Index 保留差異，再接 D1 Shadow |
| 部署安全 | Worker 名稱可能覆蓋正式服務 | 固定為 `seefood-d1-shadow`，無 routes，仍需 `?d1=1` |
| Shadow 回跳 | ECPay／通知／LIFF 回跳可能遺失 `d1=1` | 保留 Shadow query；未指定 staging LIFF ID 時 fail-closed |

## 本機驗證結果

| 驗證 | 結果 |
|---|---|
| `worker.js` JavaScript syntax | PASS |
| 6 個 Index inline script parse | PASS |
| GAS action 覆蓋：28 個 action + 1 個 ECPay callback | PASS |
| GET mutation 回 405 | PASS |
| LINE 設定缺失回 503 | PASS |
| LINE session 缺失回 401 | PASS |
| v1 Partner 合約不被當成 current | PASS |
| `PAID → REDEEMED` 後才建分潤 | PASS |
| 服務費 10 元、5000 bps → 5 元 commission | PASS |
| 重複核銷只保留一筆 commission | PASS |
| 買家直接 `createDispute` 不寫案件、改導客服 | PASS |
| 延遲／逾期未取類型遭拒絕 | PASS |
| 超過付款 14 天不可核准退款 | PASS |
| 客服開案將可用分潤退回審核中 | PASS |
| 人工核准後訂單／付款改為 `REFUND_PENDING` 並停止商家入帳 | PASS |
| 未填金流退款編號不可標成 `REFUNDED` | PASS |
| 已實退後訂單與付款同步成 `REFUNDED` | PASS |
| `refunds` 台帳由 `PENDING` 轉 `COMPLETED`，保存 provider refund number | PASS |
| 修改過的訂單／付款／申訴／退款 SQL 通過 frozen Step2C／Step2F CHECK 與 foreign-key 測試 | PASS |
| Partner commission／payout 欄位符合 final frozen Step2H 的 x10000 結構 | PASS |
| 完整 frozen Step2A–H：45 張表、全部 Worker 靜態 SQL prepare | PASS（231／231） |
| `EXPIRED` 付款滿 14 天可計商家撥款，未滿 14 天留在審核保留 | PASS |
| Forward migration 可由 SQLite 執行 | PASS |
| `wrangler.jsonc`／R2 example JSONC 結構 | PASS |
| Guide／Radar 回歸 | NOT IN SCOPE（未修改、未部署） |
| 遠端 Cloudflare D1 實際 schema／資料 | NOT VERIFIED（需部署前健康檢查與遠端備份） |
| LINE／ECPay／R2／Places 真實服務串接 | NOT VERIFIED（需正確 Secret 與 Shadow 帳號） |
| Wrangler dry-run | NOT RUN（目前工作環境未安裝 Wrangler） |

執行輸出：

```text
VALIDATION PASS: 28 GAS actions + ECPay callback; 6 Index scripts; security gates verified
FULL FROZEN SCHEMA CONTRACT PASS: 45 tables; 231 Worker SQL statements; Step2H x10000 units; forward migration
WORKER FLOW PASS: UID binding; current-contract gate; PAID has no commission; REDEEMED-only 50%; idempotent retry
REFUND POLICY PASS: buyer blocked; late pickup rejected; 14-day gate; no-refund resolution; expired-order payout; admin approval hold; gateway-confirmed refund
D1 FORWARD MIGRATION SQL PASS: v2 rule; pre-redeem reconciliation; requested/paid safety gate; admin-only 14-day refund marker
```

## 已知邊界與阻斷條件

1. 這不是已上線結果，而是可部署至 Shadow 的候選包。
2. 若 `/api/health` 的 `lineSession` 不是 `ENFORCED`，不得測後台寫入，也不得切流量。
3. Shadow 網域必須有獨立 staging LIFF ID／Endpoint；測試網址需帶 `d1=1&liffId=...`。這是目前唯一需要外部設定才能測登入的已知阻斷條件。
4. 若 `partnerRule` 不是 `CURRENT` 或 `refundPolicy` 不是 `ADMIN_ONLY_14D`，先停止測試並檢查 migration／D1 binding。
5. ECPay 成功 callback 必須先在測試商店確認只產生 `PAID`，核銷後才產生 commission。
6. `APPROVE_REFUND` 只停止入帳，並不代替 ECPay 實際退款；完成金流返還後才可用退款編號執行 `MARK_REFUNDED`。
7. migration 會 void 不正確的 pre-redeem `PENDING_REVIEW`／`AVAILABLE` 資料；必須先備份。
8. `REQUESTED`／`PAID` 的可疑歷史分潤不會自動改動，應人工稽核。
9. Guide 與 Radar 尚未審視，不應拿本包覆蓋或改動它們。
10. 本包已完成客服案件 API／狀態機，但沒有新增客服人員的視覺管理介面；內部後台仍需串接。
11. 完整 Shadow 測試通過前，GAS 必須保留作 fallback。
