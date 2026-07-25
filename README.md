# 工程計算中心（Engineering Hub）

儒鴻結構土木技師事務所（Ju Hong Structural）的結構／大地／水利工程計算工具入口網站。正式網域：[juhongstructural.com](https://juhongstructural.com)。

> 這份文件在 2026-07 大幅重寫過。舊版描述的是一份「改用 Next.js/React 重建」的規劃書，那份規劃連同它參考的原型檔 `工程計算中心.dc.html` 都已經放棄——實際上線的是完全不同、簡單得多的架構：純靜態 HTML/JS + 一個共用的 Node/Express 後端。下面內容是目前真正在跑的系統。

## 這是什麼

104 個獨立的計算工具（每個各自是一個 GitHub Pages 網站）+ 2 個本機 Python 工具，全部免費，集中在這個 hub 站做搜尋、分類、收藏、統一登入。工具本身完全不在這個 repo 裡——這裡只有目錄頁跟共用的帳號/點數/儲存後端。

## 架構：三個各自獨立的 repo

這個生態系分散在三個 git repo，各自獨立 commit/push，沒有 monorepo：

| repo | 內容 | 部署方式 |
|---|---|---|
| **engineering-hub**（這裡） | 首頁 `index.html`、專案工作流 `workflow.html`、關於我們/條款/更新紀錄等靜態頁 | GitHub Pages，push 後自動生效 |
| **jrh-core** | `jrh-core.js`，104 個工具頁共用的腳本（登入、PDF封面、免責聲明、雲端同步等），每個工具頁用 `<script src="…jrh-core.js?v=N">` 引入 | GitHub Pages，push 後自動生效（但個別瀏覽器可能快取舊版，見下方「已知雷區」） |
| **cloud-sync-mvp** | Node/Express + Postgres 後端，`cloud-sync-mvp-production.up.railway.app` | Railway，**push 到 GitHub 不會自動部署**，見下方 |

104 個外部工具各自是獨立的 GitHub repo（例如 `shoring`、`RC-Beam-Steel-Design`），這份 README 管不到那些，只涵蓋上面三個。

無建置流程，純手寫 HTML/CSS/JS，沒有 npm build/bundler（cloud-sync-mvp 除外，那是 Node 服務）。

## 部署：兩個容易忘記的雷區

1. **cloud-sync-mvp push GitHub 不會自動部署到 Railway**。改完後端要另外在 `cloud-sync-mvp` 目錄下跑：
   ```
   railway up --detach
   ```
2. **schema.sql 不會自動套用到正式 Postgres**。改完 schema 要手動套用一次：
   ```
   railway variables --service Postgres --kv   # 拿 DATABASE_PUBLIC_URL
   psql "$DATABASE_PUBLIC_URL" -f schema.sql   # 全部是 IF NOT EXISTS，可重複執行
   ```
   `railway` CLI 已經 `railway link` 連好這個專案，在 `cloud-sync-mvp` 目錄下直接可用。

## 功能總覽（都已上線）

**帳號**：Email/密碼、Google、Facebook 登入；忘記密碼；rate limit；登出所有裝置。

**工具目錄**：104+2 個工具，搜尋/分類/收藏；使用者可投稿新工具（`private → pending → approved`），admin 審核（含退回原因）；社群投稿工具有標籤跟官方工具區隔；投稿者能看自己工具的開啟次數統計。

**PRO 點數系統**：送審 +1、審核通過 +4、儲值（人工匯款或 ECPay 信用卡/ATM/超商代碼）、解鎖個人化 PDF 品牌設定 -5（公司名稱/Logo/技師證號/簽章/簽署欄位標題/自訂免責聲明附加文字，一次性費用永久生效）。

**團隊帳號**（免費，一人最多屬於一個團隊）：邀請成員（Email，7天效期連結）、共用點數池、共用雲端專案存檔、共用 PDF 品牌設定、成員離開時可選擇轉移其投稿工具擁有權、點數紀錄可查每筆是哪位成員的動作。

**專案工作流**（`workflow.html` + jrh-core.js）：104 個工具頁共用的「專案資訊」欄位跨工具自動同步（純 localStorage）；修訂履歷（Rev.A/B/C）；多工具合併列印成一份計算書；匯出 Excel/Word；雲端同步（登入後手動觸發，個人備份或團隊共用）。

**公告系統**：`updates.html` 的「已修正的計算錯誤」區塊，admin 可直接發布新公告（不用改 HTML 重新部署）。

## 本機開發

```bash
cd cloud-sync-mvp
export PGDATABASE=jrh_cloud   # 本機 Postgres，跟正式庫完全分開
psql -d jrh_cloud -f schema.sql
./start.sh                     # 讀 .env / .jwt_secret，預設 PORT=4001
```

前端（`engineering-hub`、`jrh-core`）純靜態檔，`python3 -m http.server` 開個本機伺服器就能測；但正式站的 CORS 只允許 `yj-chen0830.github.io`／`juhongstructural.com`／`www.juhongstructural.com` 三個網域，本機網址打正式站 API 會被擋（如果要測真的 API 行為，用本機後端或 curl，不要指望瀏覽器打正式站）。

## 已知雷區

- **jrh-core.js 有版本快取**：104 個工具頁引入時帶 `?v=N`，改完 jrh-core.js 內容如果需要強制所有瀏覽器立即拿到新版，要記得每個工具頁的引入版本號都要跟著升（目前 104 個工具頁各自維護自己的版本號，沒有集中管理）。
- **不要把「已具備」跟「已修正」搞混**：這個專案經歷過好幾輪重新查證，同一個功能可能「查證後發現其實早就做了」——改東西之前先實際讀程式碼確認現況，不要單憑印象或舊文件。
- **team_invites.invited_by 沒有 ON DELETE CASCADE**：如果之後做帳號刪除功能，刪除一個曾經發過邀請的使用者會因為這個外鍵失敗，需要先處理。

## 尚未做、需要另外決策的方向

- 帳號刪除功能——`tools.owner_id` 是 `ON DELETE CASCADE`，真的刪帳號會連帶砍掉使用者已上架的公開工具，牽涉資料保留政策，需要先決定要匿名保留還是真的砍。
- ECPay 正式金鑰（商家帳號審核中，目前用官方沙盒環境）。
- 104 個外部工具各自的內容/公式依據標註、版本號——這些要逐一進到各自的 repo 才能做。
- README 曾經規劃過的「模板支撐計畫／施工架支撐計畫／鋼筋算料最佳化」三個真正付費的 PRO 工具，目前完全沒有動工，只是討論過方向。
