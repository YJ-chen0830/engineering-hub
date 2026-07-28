/*
 * Cloudflare Worker: 統一網域反向代理
 *
 * 目的：讓 juhongstructural.com/tools/<repo>/* 這個路徑，把內容原樣代理自
 * https://yj-chen0830.github.io/<repo>/* ——瀏覽器看到的永遠是
 * juhongstructural.com 這一個 origin，104 個工具 repo 本身完全不用修改,
 * 繼續照舊部署在 GitHub Pages。
 *
 * 部署方式：Cloudflare Dashboard → Workers & Pages → Create Worker，把這個
 * 檔案的內容整個貼進編輯器存檔，再依 infra/CLOUDFLARE_SETUP.md 的步驟設定
 * DNS 代理／SSL 模式／Worker Route。
 *
 * 設計原則：純 fetch-passthrough，不修改回應內容本身（不做 HTML 重寫、不
 * 插入任何腳本）——104 個 repo 的內容原封不動，這個 Worker 只負責「把請
 * 求轉去正確的地方」。
 */

const UPSTREAM_ORIGIN = 'https://yj-chen0830.github.io';
// 5 分鐘快取——太短會讓 Cloudflare 邊緣快取形同虛設、每次都真的打一次
// GitHub Pages；太長會讓 104 個 repo 更新後代理端還吐舊內容給使用者。跟
// jrh-core.js 現有的 10 分鐘瀏覽器快取取一個同量級但更短的值，讓「代理層」
// 不要成為使用者感受到的新瓶頸。
const CACHE_TTL_SECONDS = 300;

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // 這個檢查理論上不會被觸發（Worker Route 本身應該已經只綁定
    // /tools/*），但保留這一層防呆：如果 Route 設定被不小心改寬，這裡確保
    // 非 /tools/* 的請求原樣通過而不是被這支 Worker 誤攔截。
    if (!url.pathname.startsWith('/tools/')) {
      return fetch(request);
    }

    const upstreamPath = url.pathname.slice('/tools'.length) || '/';
    const upstreamUrl = UPSTREAM_ORIGIN + upstreamPath + url.search;

    const upstreamRequest = new Request(upstreamUrl, {
      method: request.method,
      headers: request.headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'follow',
    });
    // 讓 fetch() 依實際目標網址自己決定 Host header，不要把原始請求
    // （juhongstructural.com）的 Host 帶過去給 GitHub Pages。
    upstreamRequest.headers.delete('host');

    const upstreamResponse = await fetch(upstreamRequest, {
      cf: {
        cacheTtl: CACHE_TTL_SECONDS,
        cacheEverything: true,
      },
    });

    // upstreamResponse 的 headers 是不可變的，包一層新的 Response 才能在
    // 需要時調整；404／其他非 200 狀態碼原樣透傳，不會被這裡改寫成假的
    // 200（GitHub Pages 對不存在的路徑本來就會回真的 404，這裡不做任何
    // 特殊處理，讓它自然透傳）。
    return new Response(upstreamResponse.body, upstreamResponse);
  },
};
