# PATCH PAPER 黏合報

這是一個 0 元電子報網站最小可用版。

前端可以放在 Cloudflare Pages。訂閱資料由 Google Apps Script 寫入 Google Sheet。整個專案不需要資料庫主機，也不需要付費電子報平台。

## 你只需要填的地方

`app.js` 第一行要放 Google Apps Script Web App URL：

```js
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/你的部署ID/exec";
```

如果 Apps Script 是從 Google Sheet 的「擴充功能」打開，其他檔案可以先不用改。

如果 Apps Script 是另外從 `script.google.com` 開的，打開 `google-apps-script/Code.gs`，把第一行換成你的 Google Sheet ID：

```js
const SPREADSHEET_ID = "你的 Google Sheet ID";
```

右下角鉛筆編輯文章需要一組管理密碼。打開 `google-apps-script/Code.gs`，把第二行換成你自己的密碼：

```js
const ADMIN_PASSWORD = "你的管理密碼";
```

## 檔案內容

`index.html` 是網站首頁，包含首頁、簡介、歷期預留區塊和訂閱表單。

`styles.css` 是網站樣式。

`app.js` 負責把訂閱表單送到 Google Apps Script。

`google-apps-script/Code.gs` 是要貼到 Google Apps Script 的後端程式。它會新增訂閱、避免重複 Email，替每筆訂閱建立退訂 token，並寄出歡迎信。

`assets/patch-paper-wordmark.jpg` 是首頁標準字圖。

`assets/patch-paper-back-cover.jpg` 是封底圖。

`issues/` 是文章頁。`issues/index.html` 是文章列表，`issues/read.html` 是從 Google Sheet 讀文章的通用頁。

文章頁右下角有鉛筆按鈕。輸入管理密碼後，可以直接改 issue、slug、標題、信件標題、文章內容。換行會保留，送出後會寫回 Google Sheet 的 `issues` 工作表。

## 更新文章

文章內容放在 Google Sheet 的 `issues` 工作表。第一次設定時，到 Apps Script 執行：

```text
setupPatchPaperManager
```

它會建立 `issues` 工作表。欄位如下：

```text
issue
title
slug
subject
body
status
publishedAt
sentAt
```

平常只需要改這幾格：

```text
issue：03
title：Issue 03 的文章標題
slug：03
subject：寄出去的信件標題
body：電子報正文
status：current
```

`status` 填 `current` 的那一列，會被網站文章頁讀取，也會被寄信功能使用。

文章網址是：

```text
https://patch-paper.patchpaper-tw.workers.dev/issues/read.html?slug=03
```

也可以直接到文章頁右下角按鉛筆，把新文章貼進去。這個做法適合日常更新。

## Google Sheet 與 Apps Script 設定

1. 新增一份 Google Sheet。
2. 如果可以，到「擴充功能」打開 Apps Script。
3. 如果無法從「擴充功能」打開，就直接到 `https://script.google.com/` 新增專案，並把 Google Sheet ID 填進 `SPREADSHEET_ID`。
4. 把 `google-apps-script/Code.gs` 的內容貼進去。
5. 儲存專案。
6. 部署成 Web App。
7. 執行身分選「我」。
8. 存取權限選「任何人」。
9. 複製部署後產生的 Web App URL。
10. 回到 `app.js`，貼到 `APPS_SCRIPT_URL`。

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

## 歡迎信

有人第一次訂閱時，Apps Script 會寄出：

```text
寄件人名稱：PATCH PAPER
信件標題：歡迎訂閱  黏  合  電  子  報
信件內容：hi 你已經訂閱囉♫♪♩♪♩
```

信裡也會附上文章頁和退訂連結。

## 寄出正式電子報

寄出前先在 Apps Script 執行：

```text
sendCurrentIssueToMe
```

確認自己收到、格式沒問題，再執行：

```text
sendCurrentIssueToSubscribers
```

它會寄給 Google Sheet 裡 `status` 是 `active` 的訂閱者，每封信底部都有自己的退訂連結。

## 平常一次更新的流程

1. 打開 Google Sheet。
2. 到 `issues` 工作表。
3. 在 `body` 貼上這一期正文。
4. `status` 填 `current`。
5. 開文章網址檢查網站版。
6. 在 Apps Script 執行 `sendCurrentIssueToMe`。
7. 自己收到後，再執行 `sendCurrentIssueToSubscribers`。
