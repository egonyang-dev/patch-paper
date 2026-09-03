# PATCH PAPER 黏合報

這是一個 0 元電子報網站最小可用版。

前端可以放在 Cloudflare Pages。訂閱資料由 Google Apps Script 寫入 Google Sheet。整個專案不需要資料庫主機，也不需要付費電子報平台。

## 你只需要填的地方

打開 `app.js`，把第一行換成你的 Google Apps Script Web App URL：

```js
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/你的部署ID/exec";
```

其他檔案可以先不用改。

## 檔案內容

`index.html` 是網站首頁，包含首頁、簡介、歷期預留區塊和訂閱表單。

`styles.css` 是網站樣式。

`app.js` 負責把訂閱表單送到 Google Apps Script。

`google-apps-script/Code.gs` 是要貼到 Google Apps Script 的後端程式。它會新增訂閱、避免重複 Email，並替每筆訂閱建立退訂 token。

`assets/patch-paper-wordmark.jpg` 是首頁標準字圖。

`assets/patch-paper-back-cover.jpg` 是封底圖。

## Google Sheet 與 Apps Script 設定

1. 新增一份 Google Sheet。
2. 到「擴充功能」打開 Apps Script。
3. 把 `google-apps-script/Code.gs` 的內容貼進去。
4. 儲存專案。
5. 部署成 Web App。
6. 執行身分選「我」。
7. 存取權限選「任何人」。
8. 複製部署後產生的 Web App URL。
9. 回到 `app.js`，貼到 `APPS_SCRIPT_URL`。

第一次有人訂閱時，Apps Script 會在 Sheet 裡自動建立 `subscribers` 工作表和欄位。

欄位如下：

```text
email
status
token
subscribedAt
updatedAt
source
userAgent
unsubscribedAt
```

## Cloudflare Pages 部署

把 `patch-paper` 這個資料夾放到 GitHub repository。

Cloudflare Pages 設定如下：

```text
Framework preset: None
Build command: 留空
Build output directory: .
```

如果 GitHub repository 不是直接以 `patch-paper` 當根目錄，而是把這個資料夾放在某個大專案裡，Cloudflare Pages 的 Root directory 請填：

```text
patch-paper
```

部署完成後，網站會得到一個 `pages.dev` 網址。之後你在 GitHub 更新檔案，Cloudflare Pages 會自動重新部署。

## 退訂連結

`Code.gs` 裡有 `getActiveSubscribers()`。之後要用 Gmail 寄電子報時，可以從這個函式拿到訂閱者清單。

每個訂閱者會包含：

```js
{
  email: "reader@example.com",
  token: "退訂 token",
  unsubscribeUrl: "https://script.google.com/macros/s/.../exec?action=unsubscribe&token=..."
}
```

把 `unsubscribeUrl` 放進電子報底部，讀者點開後就會退訂。
