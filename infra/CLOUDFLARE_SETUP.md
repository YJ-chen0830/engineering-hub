# 統一網域架構：Cloudflare 後台設定步驟

這份文件是給業主本人操作的——我（Claude）沒有 Cloudflare 帳號存取權限，這幾步只能麻煩你親自在後台完成。完成後跟我說一聲，我再繼續後續的網址置換與驗證。

## 背景

目前 104 個工具頁與 `jrh-core.js` 部署在 `yj-chen0830.github.io`，`juhongstructural.com`（engineering-hub）是另一個 origin，瀏覽器 localStorage/登入狀態不互通。這次要做的是在 `juhongstructural.com/tools/*` 掛一個 Cloudflare Worker，把請求原樣代理到 `yj-chen0830.github.io/*`——瀏覽器只看到 `juhongstructural.com` 一個網域，104 個工具 repo 完全不用改。

`juhongstructural.com` 的網域註冊商與 DNS 都已經在 Cloudflare，不需要遷移 DNS 供應商，這是純粹的設定調整。

## 執行前提醒

- **第 1-4 步做完、Worker 部署好之前，你的正式站不會有任何變化**——這幾步都是準備工作，沒有風險。
- **第 5 步（先用測試路徑驗證）非常重要，不要跳過**——直接把 Route 設成 `/tools/*` 沒問題的機率很高，但先用一個不重要的測試路徑驗證，可以在完全不影響正式站的情況下抓出設定問題（例如 SSL 模式沒設對會造成重導向迴圈，這在測試路徑就能發現，不會波及 `index.html`/`workflow.html`）。

## 步驟

### 1. 建立 Worker

Cloudflare Dashboard → 左側選單 **Workers & Pages** → **Create** → **Create Worker**。

- 名稱可以取 `tools-proxy`（名稱不影響功能，方便你自己識別即可）。
- 建立後點進編輯器，把整個 `infra/tools-proxy-worker.js` 檔案的內容複製貼上，取代預設範例程式碼。
- 存檔並部署（Deploy）。

此時這個 Worker 已經存在，但因為還沒有掛任何 Route，不會影響任何現有流量。

### 2. 先設定測試路徑（不影響正式站）

Worker 部署頁面 → **Settings** → **Triggers** → **Add Route**。

先只加一條測試用的路由，例如：
```
juhongstructural.com/tools-test/*
```
（注意是 `tools-test`，不是 `tools`——先用一個不會跟現有網站衝突的路徑名稱測試。）

### 3. 確認 DNS 代理與 SSL 模式

Cloudflare Dashboard → 選 `juhongstructural.com` → **DNS** → **Records**。

- 找到 `juhongstructural.com` 這筆記錄（目前指向 GitHub Pages 的 IP），把最右邊的雲朵圖示從灰色（僅 DNS）切成橘色（已代理）。
- 左側選單 → **SSL/TLS** → **Overview**，加密模式選 **Full** 或 **Full (strict)**。**不要選 Flexible**——Flexible 模式會跟 GitHub Pages 自己的 HTTPS 強制轉向產生無限重導向迴圈，網站會整個打不開。

⚠️ 這一步會讓 `juhongstructural.com` 的所有流量開始經過 Cloudflare 代理（不只是 `/tools-test/*`）。正常情況下 GitHub Pages 網站本身不會受影響（Cloudflare 只是在中間轉發，內容不變），但這是這次唯一「會影響現有正式站」的步驟，建議在流量較少的時段操作，操作後立刻打開 `juhongstructural.com` 確認首頁、`workflow.html` 都還能正常開啟。

### 4. 用測試路徑驗證 Worker 正常運作

DNS 代理生效後（可能要等幾分鐘），打開瀏覽器訪問：

```
https://juhongstructural.com/tools-test/scaffold/
```

**預期結果**：應該會看到「施工架施工計畫」這個工具頁面正常顯示（內容跟直接訪問 `https://yj-chen0830.github.io/scaffold/` 一模一樣）。

如果看到的是錯誤頁面、空白頁、或一直轉圈圈重導向，代表設定有問題（最常見是 SSL 模式設錯），跟我說目前看到的狀況，我可以協助排查。

### 5. 確認正常後，跟我說一聲

測試路徑驗證沒問題之後，跟我說「測試路徑可以了」，我會請你把 Route 從 `juhongstructural.com/tools-test/*` 改成正式的 `juhongstructural.com/tools/*`（同一個 Worker，只是改路由路徑，Dashboard 上點兩下就能改），接著我才會開始把 `jrh-core.js`／`workflow.html`／`index.html` 裡的網址從 `yj-chen0830.github.io/...` 換成 `juhongstructural.com/tools/...` 並部署，這時候使用者才會實際感受到「不用登入兩次、不用手動同步」的效果。

### 6.（之後）觀察期

正式切換後，建議觀察幾天，確認：
- 104 個工具頁的內容更新（如果之後你或我改了任何一個工具 repo）能不能在合理時間內反映到 `/tools/<repo>/` 這個代理路徑上（不會被 Cloudflare 快取卡住太久——目前設定是 5 分鐘快取，如果發現更新反映太慢，可以再調整）。
- 舊的 `yj-chen0830.github.io/<repo>/` 網址應該還是正常可用（沒有被強制重導向），這是刻意保留的，不是遺漏。

有任何一步卡住，或想先暫停都沒問題，這幾步彼此獨立，隨時可以停在任何一步。
