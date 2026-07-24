# Handoff：工程計算中心（Structural Engineering Toolkit）

> ⚠ **現況說明（2026-07-24 更新）**：本文件其餘內容是最初的規劃書，**與目前正式站（`index.html`）現況有落差**，交接或協作前請先看這段。
>
> **已經是真的、正式站上線中：**
> - 免費工具目錄（105 個工具卡片：103 個瀏覽器工具 + 2 個本機 Python 工具），全部免費，無分級
> - 真實後端（Railway 代管：`cloud-sync-mvp-production.up.railway.app`），有 JWT 登入、Email／Google／Facebook 登入、忘記密碼皆為真實 API，非 localStorage 模擬
> - 使用者可送出自訂工具，但送出後永遠是 `private`，**沒有公開送審／審核後台介面**（下面「送審→審核流程」與「審核後台」章節目前完全沒有前端，也沒有 approve/reject API）
>
> **以下規劃目前都還沒做，甚至原型檔 `工程計算中心.dc.html` 都已經放棄這部分（PRO 卡片文案改成「完全免費·歡迎贊助」）：**
> - PRO 付費層／點數制（`openPay`、`/api/credits`、`/api/reports` 全部不存在）
> - 送審→審核 UI（後台的「通過／退回」畫面不存在）
>
> 換句話說：下面的「需要實作的後端」章節是**尚未執行的規劃**，不是目前系統的規格書。若要重啟這個規劃，第一步是先決定 PRO 付費層到底要不要做、什麼時候做。

## Overview
一個把「部署在 GitHub 上的結構／水利工程計算工具」集中管理的入口網站。使用者可搜尋、分類、收藏工具，一鍵開啟網頁版工具或取得本機 Python 執行指令。系統分為兩層商業模式：

- **免費層**：一般計算器（梁、矩陣、P-M 圖、水力、逕流量…），開源、免登入、瀏覽器直接開。
- **專業層（PRO）**：計畫書級、須審核、可收費的工具（模板支撐計畫、施工架支撐計畫、鋼筋算料最佳化）。免費試算不限次，**產出可送審的正式計畫書時按份計次收費**。

另含一套「送審 → 審核」流程與「審核後台」：使用者可把自己新增的工具「提交送審」，管理員在後台「通過／退回」。

## About the Design Files
本包內的 `工程計算中心.dc.html` 是**設計參考稿（以 HTML 製作的高保真原型）**，用來呈現最終外觀與互動行為，**不是要直接搬上線的正式程式碼**。任務是：**在目標環境（建議 Next.js / React）中重建此設計**，沿用該專案既有的元件與慣例；若尚無環境，請選最合適的框架（見下方建議技術棧）實作。

目前原型中所有「跨使用者」功能（送審佇列、審核、付費、公開工具庫）都只用瀏覽器 `localStorage` 模擬，**沒有真正後端**。這份 handoff 的核心工作就是把這些換成真實後端 + API。

## Fidelity
**高保真（hifi）**。顏色、字體、間距、互動皆為最終設計，請比照重建。設計語言來自「宏儒營造 Hong Ju / 儒鴻結構」設計系統（深藍 + 金色 + 暖石中性色）。

---

## 需要實作的後端（本次重點）

原型是純前端。要真正上線可收費、可跨裝置審核，需補上：

### 1. 資料模型
```
Tool {
  id            string (pk)
  title         string        // 中文名
  titleEn       string
  category      string
  desc          string
  tags          string[]
  lang          'HTML' | 'Python'
  kind          'web' | 'cli' | 'lib' | 'pro'
  tier          'free' | 'pro'
  repo          string (url)
  url           string|null   // GitHub Pages 等，web/pro 用
  install       string        // 本機工具用
  cmd           string
  note          string
  price         string|null   // pro：'NT$ 300'
  priceNote     string|null
  updated       string        // 'YYYY-MM'
  status        'private' | 'pending' | 'approved'   // 送審狀態
  ownerId       string (fk User)                     // 提交者
  createdAt / updatedAt
}

User {
  id, email, displayName, role: 'user' | 'admin', credits: int
}

Submission (可併入 Tool.status，或獨立表)
  toolId, submittedBy, status, reviewedBy, reviewedAt, rejectReason?

CreditLedger / ReportJob {
  id, userId, toolId, cost, status, resultUrl, createdAt
}
```

### 2. 需要的 API（把前端 localStorage 呼叫換成這些）
- `GET  /api/tools`                    公開清單（status=approved + 內建）
- `POST /api/tools`                    新增（預設 status=private，綁 ownerId）
- `PATCH/DELETE /api/tools/:id`        編輯／刪除（僅 owner）
- `POST /api/tools/:id/submit`         提交送審 → status=pending
- `POST /api/tools/:id/withdraw`       取消送審 → status=private
- `GET  /api/review/queue`            （admin）待審清單 status=pending
- `POST /api/review/:id/approve`      （admin）→ status=approved
- `POST /api/review/:id/reject`       （admin）→ status=private (+reason)
- `POST /api/reports`                  產出計畫書：驗證點數 → 扣點 → 伺服器端跑計算 → 回傳報告
- `GET/POST /api/credits`              點數餘額／購買（串金流 webhook）
- Auth：登入 / 目前使用者 / role

### 3. 付費（PRO 工具）
- 模式：**按份計次**（點數制）。產出一份正式計畫書扣一次點；免費試算不扣點。
- 金流：台灣建議 **綠界 ECPay** 或 **藍新 NewebPay**；國際用 **Stripe**。
- 計算引擎跑在**伺服器端**（保護核心邏輯 IP，同時計量）。原型中 pro 工具的「免費試算」開的是公開 GitHub Pages；正式「產出計畫書」那一步要走 `/api/reports`。
- ⚠ 法律：計畫書仍須專業技師簽證負責，工具僅為輔助。UI 已含此免責聲明，後端產出的文件也應內含同樣聲明。

### 4. 前端要改接 API 的位置（在 `工程計算中心.dc.html` 的 logic class 內）
目前這些方法都寫 `localStorage`，換成打上面 API：
- `componentDidMount()` 讀 `ectr_favs / ectr_recents / ectr_custom_tools` → 改為 `GET /api/tools` + 使用者收藏
- `persist()` / `persistCustom()` → 對應 PATCH
- `submitForReview / withdrawReview / approveTool / rejectTool / setStatus` → 對應 submit/withdraw/approve/reject API
- `submitAdd()` → `POST /api/tools`；`deleteFromEdit / deleteCustom` → `DELETE`
- `openPay()` 開的付費 modal 的「購買點數」目前是 `alert` → 接 `/api/credits` + 金流

### 5. 建議技術棧
- **Next.js (App Router) + React + TypeScript**
- **Supabase**（Postgres + Auth + RLS）或 Firebase 存資料與登入；RLS 確保只有 owner 能改自己的工具、只有 admin 能審核
- **ECPay / NewebPay / Stripe** 金流；point ledger 記帳
- 部署：Vercel（前端 + API routes）
- 免費層可與付費層同站；免費工具目錄也可先純靜態（GitHub Pages）上線打品牌

---

## Screens / Views（設計細節見原型檔）

### 首頁 / 目錄
- **Header**（sticky, `rgba(255,255,255,0.86)` + blur10）：左 logo lockup（JU HONG STRUCTURAL 金色 eyebrow + 工程計算中心 深藍 serif）；右「審核後台」（含待審數量金色徽章）+「GitHub」兩顆按鈕。
- **Hero**：深藍底 `#0A1A33` + 藍圖網格紋 + 右上金色 radial glow，底邊 2px 金線。eyebrow「STRUCTURAL ENGINEERING TOOLKIT」；H1「統一管理與調用您的計算程式」；副文；**slogan「願能讓複雜的工程，多一絲簡單的可能」**（Noto Sans TC, 700, 金色 `#D9B96E`, 前綴一道 28×2px 金線）；搜尋框；三個統計數字（計算工具數 / 分類數 / 最近更新）。
- **工具區**：最近使用橫捲 chips → 分類 pills + 我的最愛/排序切換 → 三個分組：
  1. **專業計畫書 PRO**（金色 3px seal，卡片有「專業版 PRO」金色徽章、標價、「產出計畫書」按鈕）
  2. **瀏覽器工具**（web，「開啟工具」）
  3. **本機工具 · Python**（cli/lib，「調用程式」開指令 modal）+ 尾端「新增工具」虛線卡

### Modals
- **調用本機 Python**：安裝指令 + 執行指令（可複製）+ 說明 + 開啟原始碼
- **產出計畫書（付費）**：PRO 徽章、標價、按份計費說明、剩餘點數、「免費試算 / 購買點數」、技師簽證免責聲明
- **新增／編輯工具**：完整表單（名稱、英文名、分類、執行方式、GitHub 連結、網址、安裝／執行指令、說明、標籤）；編輯時多「公開工具庫狀態」區塊（提交送審／取消送審）+ footer 刪除鍵（受 `allowDelete` 權限控制）
- **審核後台**：待審清單，每筆可「通過 / 退回」，點 repo 連結開 GitHub

## Design Tokens
- 深藍 navy：`#0A1A33`（hero/深底）、`#0E2546`/`#143257`（按鈕）
- 金色 gold：`#C9A24A`（accent/seal/focus）、`#D9B96E`（暗底金字）、`#9A7B2A`/`#7E641F`（金字於淺底）
- 暖石中性：底 `#F8F6F0`、文字 `#211F19`/`#4B473C`/`#6B6557`/`#8C8576`、邊框 `#E2DDD1`/`#EFEBE2`/`#CBC5B6`、卡片白 `#FFFFFF`
- 語意：綠（通過/web）`#2E6B45`、紅褐（刪除/退回）`#9A5A4B`、藍點（React/程式碼）`#295892`
- 字體：Display＝Noto Serif TC；內文/UI＝Noto Sans TC；eyebrow/數字＝Archivo（大寫 tracking 0.1–0.18em）
- 圓角：2/4/6px（rectilinear）；pills 用於標籤/篩選
- 陰影：navy-tinted `rgba(10,26,51,…)`；卡片 hover 上移 3px
- Focus ring：`0 0 0 3px rgba(201,162,74,0.45)` 金色
- Motion：120–320ms，`cubic-bezier(0.2,0,0.1,1)` / `(0.16,1,0.3,1)`，無彈跳

## Assets
- Logo：`assets/logo-j-mark-light.png`（儒鴻結構 J，反白，用於深藍 tile）
- 藍圖網格：hero 背景用 CSS `linear-gradient` 疊出，無需外部圖
- 圖示：Lucide 風格 inline SVG（2px stroke）

## Interactions & State
- 狀態：`query, category, favOnly, sort, favs[], recents[], customTools[], modalId, payId, addOpen, editId, reviewOpen, form{}`
- 收藏/最近使用/自訂工具目前存 localStorage（`ectr_*`）——上線改後端
- 工具 props（tweak）：`accent`(gold/navy)、`density`(comfortable/compact)、`showRecent`(bool)、`allowDelete`(bool，共用時可禁止刪除)

## Files
- `工程計算中心.dc.html` — 完整高保真原型（Design Component；template + logic class）。所有畫面、資料、互動都在此檔，是重建的唯一參考來源。
