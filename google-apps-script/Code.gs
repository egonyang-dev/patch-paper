const SPREADSHEET_ID = "PASTE_YOUR_GOOGLE_SHEET_ID_HERE";
const SHEET_NAME = "subscribers";
const RESPONSE_SOURCE = "patch-paper-subscription";
const ADMIN_PASSWORD = "PASTE_ADMIN_PASSWORD_HERE";
const WELCOME_SENDER_NAME = "PATCH PAPER";
const WELCOME_SUBJECT = "歡迎訂閱  黏  合  電  子  報 ";
const WELCOME_TEXT = "hi 你已經訂閱囉♫♪♩♪♩";
const ARTICLES_URL = "https://patch-paper.patchpaper-tw.workers.dev/issues/";
const IMAGE_FOLDER_NAME = "PATCH PAPER issue images";
const ISSUE_SHEET_NAME = "issues";
const FEEDBACK_SHEET_NAME = "feedback";
const ISSUE_HEADERS = [
  "issue",
  "title",
  "slug",
  "subject",
  "body",
  "status",
  "publishedAt",
  "sentAt",
  "imageUrl",
  "tags",
  "author",
  "authorIg",
  "authorPortfolio",
  "authorEmail",
  "likes",
];
const FEEDBACK_HEADERS = [
  "createdAt",
  "issue",
  "slug",
  "title",
  "type",
  "message",
  "name",
  "email",
  "url",
  "userAgent",
];

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("PATCH PAPER")
      .addItem("建立管理表格", "setupPatchPaperManager")
      .addItem("授權圖片上傳", "authorizePatchPaper")
      .addSeparator()
      .addItem("寄本期預覽給我", "sendCurrentIssueToMe")
      .addItem("寄本期給訂閱者", "sendCurrentIssueToSubscribers")
      .addToUi();
  } catch (error) {
    console.log("PATCH PAPER menu unavailable: " + (error.message || error));
  }
}

function doPost(e) {
  const params = (e && e.parameter) || {};
  const action = String(params.action || "subscribe").toLowerCase();

  try {
    if (action === "subscribe") {
      const result = subscribe_(params);
      return iframeResponse_(result);
    }

    if (action === "unsubscribe") {
      const result = unsubscribe_(params.token);
      return iframeResponse_(result);
    }

    if (action === "saveissue") {
      const result = saveIssue_(params);
      return iframeResponse_(result);
    }

    if (action === "deleteissue") {
      const result = deleteIssue_(params);
      return iframeResponse_(result);
    }

    if (action === "feedback") {
      const result = saveFeedback_(params);
      return iframeResponse_(result);
    }

    return iframeResponse_({
      ok: false,
      status: "bad_request",
      message: "Unknown action.",
    });
  } catch (error) {
    return iframeResponse_({
      ok: false,
      status: "error",
      message: error.message || "Unexpected error.",
    });
  }
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = String(params.action || "").toLowerCase();

  if (action === "issue") {
    return issueResponse_(params);
  }

  if (action === "issues") {
    return issuesResponse_(params);
  }

  if (action === "like") {
    return likeIssueResponse_(params);
  }

  if (action === "unsubscribe") {
    const result = unsubscribe_(params.token);
    const title = result.ok ? "退訂完成" : "退訂失敗";
    const body = result.ok
      ? "你已經從 PATCH PAPER 黏合報名單離開。信箱會安靜一點，至少這裡會。"
      : result.message;

    return HtmlService.createHtmlOutput(pageHtml_(title, body))
      .setTitle(title)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createHtmlOutput(
    pageHtml_("PATCH PAPER 黏合報訂閱後端", "這個網址用來接收網站訂閱表單。")
  ).setTitle("PATCH PAPER 黏合報訂閱後端");
}

function subscribe_(params) {
  const email = normalizeEmail_(params.email);

  if (!isValidEmail_(email)) {
    return {
      ok: false,
      status: "invalid_email",
      message: "Invalid email.",
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet_();
    const rows = sheet.getDataRange().getValues();
    const now = new Date();

    for (let i = 1; i < rows.length; i += 1) {
      const rowEmail = normalizeEmail_(rows[i][0]);

      if (rowEmail === email) {
        const rowNumber = i + 1;
        const currentStatus = String(rows[i][1] || "active").toLowerCase();

        if (currentStatus === "active") {
          const token = rows[i][2] || Utilities.getUuid();
          if (!rows[i][2]) {
            sheet.getRange(rowNumber, 3).setValue(token);
          }

          sheet.getRange(rowNumber, 5).setValue(now);
          sendWelcomeEmail_(email, token);

          return {
            ok: true,
            status: "duplicate",
            message: "Already subscribed. Welcome email sent again.",
          };
        }

        const token = rows[i][2] || Utilities.getUuid();
        sheet.getRange(rowNumber, 1, 1, 8).setValues([
          [
            email,
            "active",
            token,
            rows[i][3] || now,
            now,
            params.source || "patch-paper-site",
            params.userAgent || "",
            "",
          ],
        ]);

        sendWelcomeEmail_(email, token);

        return {
          ok: true,
          status: "subscribed",
          message: "Subscribed.",
        };
      }
    }

    const token = Utilities.getUuid();
    sheet.appendRow([
      email,
      "active",
      token,
      now,
      now,
      params.source || "patch-paper-site",
      params.userAgent || "",
      "",
    ]);

    sendWelcomeEmail_(email, token);

    return {
      ok: true,
      status: "subscribed",
      message: "Subscribed.",
    };
  } finally {
    lock.releaseLock();
  }
}

function sendWelcomeEmail_(email, token) {
  const unsubscribeUrl = buildUnsubscribeUrl_(token);
  const body =
    WELCOME_TEXT +
    "\n\n文章頁：" +
    ARTICLES_URL +
    "\n\n退訂：" +
    unsubscribeUrl;
  const htmlBody =
    '<div style="font-family:Helvetica,Arial,sans-serif;color:#174ea6;font-size:18px;line-height:1.7">' +
    "<p>" +
    escapeHtml_(WELCOME_TEXT) +
    "</p>" +
    '<p><a style="color:#d96f9a" href="' +
    escapeHtml_(ARTICLES_URL) +
    '">文章頁</a></p>' +
    '<p><a style="color:#d96f9a" href="' +
    escapeHtml_(unsubscribeUrl) +
    '">退訂</a></p>' +
    "</div>";

  GmailApp.sendEmail(email, WELCOME_SUBJECT, body, {
    name: WELCOME_SENDER_NAME,
    htmlBody: htmlBody,
  });
}

function unsubscribe_(token) {
  const cleanToken = String(token || "").trim();

  if (!cleanToken) {
    return {
      ok: false,
      status: "missing_token",
      message: "Missing unsubscribe token.",
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet_();
    const rows = sheet.getDataRange().getValues();
    const now = new Date();

    for (let i = 1; i < rows.length; i += 1) {
      if (String(rows[i][2] || "").trim() === cleanToken) {
        const rowNumber = i + 1;
        sheet.getRange(rowNumber, 2).setValue("unsubscribed");
        sheet.getRange(rowNumber, 5).setValue(now);
        sheet.getRange(rowNumber, 8).setValue(now);

        return {
          ok: true,
          status: "unsubscribed",
          message: "Unsubscribed.",
        };
      }
    }

    return {
      ok: false,
      status: "token_not_found",
      message: "Token not found.",
    };
  } finally {
    lock.releaseLock();
  }
}

function getActiveSubscribers() {
  const sheet = getSheet_();
  const rows = sheet.getDataRange().getValues();
  const subscribers = [];

  for (let i = 1; i < rows.length; i += 1) {
    const status = String(rows[i][1] || "").toLowerCase();

    if (status === "active") {
      subscribers.push({
        email: rows[i][0],
        token: rows[i][2],
        unsubscribeUrl: buildUnsubscribeUrl_(rows[i][2]),
      });
    }
  }

  return subscribers;
}

function saveIssue_(params) {
  requireAdmin_(params.password);

  const issueNumber = String(params.issue || "").trim() || "03";
  const slug = String(params.slug || issueNumber).trim();
  const title = String(params.title || "").trim() || "Issue " + issueNumber;
  const subject = String(params.subject || "").trim() || title + "｜黏  合  電  子  報";
  const body = String(params.body || "").trim();
  const status = String(params.status || "current").trim().toLowerCase();
  const tags = normalizeTags_(params.tags);
  const uploadedImageUrl = saveIssueImage_(params);
  const submittedImageUrl = String(params.imageUrl || "").trim();
  const author = String(params.author || "").trim();
  const authorIg = String(params.authorIg || "").trim();
  const authorPortfolio = String(params.authorPortfolio || "").trim();
  const authorEmail = normalizeEmail_(params.authorEmail);
  const shouldSend = String(params.sendNewsletter || "").toLowerCase() === "yes";

  if (!slug) {
    throw new Error("請填 slug。");
  }

  if (!body) {
    throw new Error("請貼上文章內容。");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getIssuesSheet_();
    const rows = sheet.getDataRange().getValues();
    let rowNumber = 0;
    let existingRow = [];

    for (let i = 1; i < rows.length; i += 1) {
      const rowIssue = String(rows[i][0] || "").trim();
      const rowSlug = String(rows[i][2] || "").trim();

      if (rowSlug === slug || rowIssue === issueNumber) {
        rowNumber = i + 1;
        existingRow = rows[i];
        break;
      }
    }

    if (status === "current") {
      for (let i = 1; i < rows.length; i += 1) {
        const targetRow = i + 1;

        if (targetRow !== rowNumber && String(rows[i][5] || "").trim().toLowerCase() === "current") {
          sheet.getRange(targetRow, 6).setValue("published");
        }
      }
    }

    const imageUrl = uploadedImageUrl || submittedImageUrl || String(existingRow[8] || "").trim();
    const values = [
      issueNumber,
      title,
      slug,
      subject,
      body,
      status,
      existingRow[6] || new Date(),
      existingRow[7] || "",
      imageUrl,
      tags,
      author,
      authorIg,
      authorPortfolio,
      authorEmail,
      Number(existingRow[14] || 0),
    ];

    if (rowNumber) {
      sheet.getRange(rowNumber, 1, 1, ISSUE_HEADERS.length).setValues([values]);
    } else {
      sheet.appendRow(values);
    }

    let sentCount = 0;

    if (shouldSend) {
      const savedRowNumber = rowNumber || sheet.getLastRow();
      const issue = issueFromRow_(values, savedRowNumber);
      const subscribers = getActiveSubscribers();

      subscribers.forEach(function (subscriber) {
        sendNewsletterEmail_(subscriber.email, subscriber.token, issue);
      });

      sentCount = subscribers.length;
      markIssueSent_(savedRowNumber);
    }

    return {
      ok: true,
      status: "saved",
      message: shouldSend
        ? "文章已更新，已寄給 " + sentCount + " 位訂閱者。"
        : "文章已更新。",
      slug: slug,
      imageUrl: imageUrl,
      tags: tags,
      sentCount: sentCount,
      author: author,
      authorIg: authorIg,
      authorPortfolio: authorPortfolio,
      authorEmail: authorEmail,
      likes: Number(existingRow[14] || 0),
    };
  } finally {
    lock.releaseLock();
  }
}

function deleteIssue_(params) {
  requireAdmin_(params.password);

  const issueNumber = String(params.issue || "").trim();
  const slug = String(params.slug || "").trim();

  if (!issueNumber && !slug) {
    throw new Error("請填 Issue 或 Slug。");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getIssuesSheet_();
    const rows = sheet.getDataRange().getValues();

    for (let i = 1; i < rows.length; i += 1) {
      const rowIssue = String(rows[i][0] || "").trim();
      const rowSlug = String(rows[i][2] || "").trim();

      if ((slug && rowSlug === slug) || (issueNumber && rowIssue === issueNumber)) {
        sheet.deleteRow(i + 1);

        return {
          ok: true,
          status: "deleted",
          message: "文章已刪除。",
          slug: slug || rowSlug,
        };
      }
    }

    throw new Error("找不到這篇文章。");
  } finally {
    lock.releaseLock();
  }
}

function likeIssueResponse_(params) {
  const callback = String(params.callback || "").trim();
  const slug = String(params.slug || "").trim();
  const payload = likeIssue_(slug);

  if (callback) {
    if (!/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback)) {
      return ContentService.createTextOutput("Bad callback.")
        .setMimeType(ContentService.MimeType.TEXT);
    }

    return ContentService.createTextOutput(callback + "(" + JSON.stringify(payload) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function likeIssue_(slug) {
  if (!slug) {
    return {
      ok: false,
      message: "Missing slug.",
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getIssuesSheet_();
    const rows = sheet.getDataRange().getValues();
    const likesColumn = ISSUE_HEADERS.indexOf("likes") + 1;

    for (let i = 1; i < rows.length; i += 1) {
      const issue = issueFromRow_(rows[i], i + 1);

      if (issue.slug === slug && issue.status !== "draft") {
        const likes = Number(rows[i][likesColumn - 1] || 0) + 1;
        sheet.getRange(i + 1, likesColumn).setValue(likes);

        return {
          ok: true,
          status: "liked",
          slug: slug,
          likes: likes,
        };
      }
    }

    return {
      ok: false,
      message: "No issue found.",
    };
  } finally {
    lock.releaseLock();
  }
}

function setupPatchPaperManager() {
  getSheet_();
  getIssuesSheet_();
  getFeedbackSheet_();
  return "PATCH PAPER 管理表格已建立。到 issues 工作表貼文章，status 填 current。";
}

function authorizePatchPaper() {
  getSheet_();
  getIssuesSheet_();
  getFeedbackSheet_();
  getImageFolder_();
  return "PATCH PAPER 已取得圖片上傳需要的 Google Drive 權限。";
}

function saveFeedback_(params) {
  const message = String(params.message || "").trim();

  if (!message) {
    return {
      ok: false,
      status: "missing_message",
      message: "信還是空的。",
    };
  }

  const sheet = getFeedbackSheet_();
  const email = normalizeEmail_(params.email);
  const feedbackType = String(params.feedbackType || "秘密告白").trim();

  sheet.appendRow([
    new Date(),
    String(params.issue || "").trim(),
    String(params.slug || "").trim(),
    String(params.title || "").trim(),
    feedbackType,
    message,
    String(params.name || "").trim(),
    email,
    String(params.url || "").trim(),
    String(params.userAgent || "").trim(),
  ]);

  return {
    ok: true,
    status: "feedback_saved",
    message: "收到了。謝謝你把信放在這裡♫♪♩♪♩",
  };
}

function sendTestWelcomeEmail() {
  const email = Session.getEffectiveUser().getEmail();

  if (!email) {
    throw new Error("Google 無法讀取目前帳號 Email。請改用網站表單測試。");
  }

  sendWelcomeEmail_(email, Utilities.getUuid());
  return "Test welcome email sent to " + email;
}

function sendCurrentIssueToMe() {
  const email = Session.getEffectiveUser().getEmail();

  if (!email) {
    throw new Error("Google 無法讀取目前帳號 Email。請改用自己的 Email 先訂閱，再測試寄送。");
  }

  const issue = getCurrentIssue_();
  sendNewsletterEmail_(email, "", issue);
  return "Preview newsletter sent to " + email;
}

function sendCurrentIssueToSubscribers() {
  const issue = getCurrentIssue_();
  const subscribers = getActiveSubscribers();

  if (subscribers.length === 0) {
    return "No active subscribers.";
  }

  subscribers.forEach(function (subscriber) {
    sendNewsletterEmail_(subscriber.email, subscriber.token, issue);
  });

  markIssueSent_(issue.rowNumber);
  return "Newsletter sent to " + subscribers.length + " subscribers.";
}

function sendNewsletterEmail_(email, token, issue) {
  const unsubscribeUrl = token ? buildUnsubscribeUrl_(token) : "";
  const body =
    issue.body +
    "\n\n閱讀文章：" +
    issue.url +
    (issue.tags ? "\n\n" + issue.tags : "") +
    "\n\n退訂：" +
    (unsubscribeUrl || "預覽信不適用");
  const htmlBody =
    '<div style="font-family:Helvetica,Arial,sans-serif;color:#174ea6;font-size:18px;line-height:1.7">' +
    '<p style="color:#d96f9a">' +
    escapeHtml_(issue.title) +
    "</p>" +
    (issue.imageUrl
      ? '<p><img src="' + escapeHtml_(issue.imageUrl) + '" alt="" style="max-width:100%;height:auto"></p>'
      : "") +
    htmlParagraphs_(issue.body) +
    (issue.tags
      ? '<p style="color:#d96f9a">' + escapeHtml_(issue.tags) + "</p>"
      : "") +
    '<p><a style="color:#d96f9a" href="' +
    escapeHtml_(issue.url) +
    '">閱讀文章</a></p>' +
    (unsubscribeUrl
      ? '<p><a style="color:#d96f9a" href="' + escapeHtml_(unsubscribeUrl) + '">退訂</a></p>'
      : '<p style="color:#d96f9a">退訂：預覽信不適用</p>') +
    "</div>";

  GmailApp.sendEmail(email, issue.subject, body, {
    name: WELCOME_SENDER_NAME,
    htmlBody: htmlBody,
  });
}

function getCurrentIssue_() {
  const sheet = getIssuesSheet_();
  const rows = sheet.getDataRange().getValues();
  let fallback = null;

  for (let i = 1; i < rows.length; i += 1) {
    const issue = issueFromRow_(rows[i], i + 1);

    if (!issue.issue && !issue.title && !issue.body) {
      continue;
    }

    fallback = issue;

    if (issue.status === "current") {
      return issue;
    }
  }

  if (fallback) {
    return fallback;
  }

  throw new Error("issues 工作表沒有可寄出的文章。");
}

function getPublicIssue_(slug) {
  const sheet = getIssuesSheet_();
  const rows = sheet.getDataRange().getValues();
  const cleanSlug = String(slug || "").trim();
  let currentIssue = null;

  for (let i = 1; i < rows.length; i += 1) {
    const issue = issueFromRow_(rows[i], i + 1);

    if (!issue.issue && !issue.title && !issue.body) {
      continue;
    }

    if (issue.status === "current") {
      currentIssue = issue;
    }

    if (cleanSlug && issue.slug === cleanSlug && issue.status !== "draft") {
      return issue;
    }
  }

  return cleanSlug ? null : currentIssue;
}

function issueFromRow_(row, rowNumber) {
  const issue = String(row[0] || "").trim();
  const title = String(row[1] || issue || "Issue").trim();
  const slug = String(row[2] || issue || "").trim();
  const subject = String(row[3] || title + "｜黏  合  電  子  報").trim();
  const body = String(row[4] || "").trim();
  const status = String(row[5] || "").trim().toLowerCase();
  const imageUrl = String(row[8] || "").trim();
  const tags = normalizeTags_(row[9]);
  const author = String(row[10] || "").trim();
  const authorIg = String(row[11] || "").trim();
  const authorPortfolio = String(row[12] || "").trim();
  const authorEmail = normalizeEmail_(row[13]);
  const likes = Number(row[14] || 0);
  const publishedAt = row[6] || "";

  return {
    rowNumber: rowNumber,
    issue: issue,
    title: title,
    slug: slug,
    subject: subject,
    body: body,
    status: status,
    publishedAt: publishedAt,
    publishedDate: formatDate_(publishedAt),
    imageUrl: imageUrl,
    tags: tags,
    author: author,
    authorIg: authorIg,
    authorPortfolio: authorPortfolio,
    authorEmail: authorEmail,
    likes: likes,
    url: ARTICLES_URL + "read.html?slug=" + encodeURIComponent(slug || "03"),
  };
}

function issueResponse_(params) {
  const callback = String(params.callback || "").trim();
  const issue = getPublicIssue_(params.slug);
  const payload = issue
    ? {
        ok: true,
        issue: {
          issue: issue.issue,
          title: issue.title,
          slug: issue.slug,
          subject: issue.subject,
          status: issue.status,
          publishedAt: issue.publishedAt,
          publishedDate: issue.publishedDate,
          body: issue.body,
          imageUrl: issue.imageUrl,
          tags: issue.tags,
          author: issue.author,
          authorIg: issue.authorIg,
          authorPortfolio: issue.authorPortfolio,
          authorEmail: issue.authorEmail,
          likes: issue.likes,
          url: issue.url,
        },
      }
    : {
        ok: false,
        message: "No current issue.",
      };

  if (callback) {
    if (!/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback)) {
      return ContentService.createTextOutput("Bad callback.")
        .setMimeType(ContentService.MimeType.TEXT);
    }

    return ContentService.createTextOutput(callback + "(" + JSON.stringify(payload) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function issuesResponse_(params) {
  const callback = String(params.callback || "").trim();
  const sheet = getIssuesSheet_();
  const rows = sheet.getDataRange().getValues();
  const issues = [];

  for (let i = 1; i < rows.length; i += 1) {
    const issue = issueFromRow_(rows[i], i + 1);

    if (!issue.issue && !issue.title && !issue.body) {
      continue;
    }

    if (issue.status === "draft") {
      continue;
    }

    issues.push({
      issue: issue.issue,
      title: issue.title,
      slug: issue.slug,
      status: issue.status,
      publishedDate: issue.publishedDate,
      imageUrl: issue.imageUrl,
      tags: issue.tags,
      author: issue.author,
      url: issue.url,
    });
  }

  const payload = {
    ok: true,
    issues: issues.reverse(),
  };

  if (callback) {
    if (!/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback)) {
      return ContentService.createTextOutput("Bad callback.")
        .setMimeType(ContentService.MimeType.TEXT);
    }

    return ContentService.createTextOutput(callback + "(" + JSON.stringify(payload) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function requireAdmin_(password) {
  const storedPassword =
    PropertiesService.getScriptProperties().getProperty("PATCH_PAPER_ADMIN_PASSWORD") ||
    ADMIN_PASSWORD;
  const cleanStoredPassword = String(storedPassword || "").trim();
  const cleanPassword = String(password || "").trim();

  if (
    !cleanStoredPassword ||
    cleanStoredPassword === "PASTE_ADMIN_PASSWORD_HERE"
  ) {
    throw new Error("請先在 Apps Script 設定管理密碼。");
  }

  if (cleanPassword !== cleanStoredPassword) {
    throw new Error("管理密碼錯誤。");
  }
}

function markIssueSent_(rowNumber) {
  if (!rowNumber) {
    return;
  }

  const sheet = getIssuesSheet_();
  sheet.getRange(rowNumber, 8).setValue(new Date());
}

function formatDate_(value) {
  if (!value) {
    return "";
  }

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone() || "Asia/Taipei", "yyyy.MM.dd");
  }

  return String(value || "").trim();
}

function getIssuesSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(ISSUE_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(ISSUE_SHEET_NAME);
  }

  const firstRow = sheet.getRange(1, 1, 1, ISSUE_HEADERS.length).getValues()[0];
  const hasHeaders = firstRow.join("") !== "";

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, ISSUE_HEADERS.length).setValues([ISSUE_HEADERS]);
    sheet.setFrozenRows(1);
  } else {
    sheet.getRange(1, 1, 1, ISSUE_HEADERS.length).setValues([ISSUE_HEADERS]);
  }

  if (sheet.getLastRow() < 2) {
    sheet.appendRow([
      "03",
      "Issue 03 preparing.",
      "03",
      "Issue 03｜黏  合  電  子  報",
      [
        "在這裡貼上這一期電子報正文。",
        "可以一段一行。",
        "status 填 current，網站文章頁和寄信都會讀這一列。",
      ].join("\n\n"),
      "current",
      "",
      "",
      "",
      "#文字",
      "",
      "",
      "",
      "",
      0,
    ]);
  }

  sheet.autoResizeColumns(1, ISSUE_HEADERS.length);
  return sheet;
}

function getFeedbackSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(FEEDBACK_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(FEEDBACK_SHEET_NAME);
  }

  const firstRow = sheet.getRange(1, 1, 1, FEEDBACK_HEADERS.length).getValues()[0];
  const hasHeaders = firstRow.join("") !== "";

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, FEEDBACK_HEADERS.length).setValues([FEEDBACK_HEADERS]);
    sheet.setFrozenRows(1);
  } else {
    sheet.getRange(1, 1, 1, FEEDBACK_HEADERS.length).setValues([FEEDBACK_HEADERS]);
  }

  sheet.autoResizeColumns(1, FEEDBACK_HEADERS.length);
  return sheet;
}

function saveIssueImage_(params) {
  const imageData = String(params.imageData || "").trim();

  if (!imageData) {
    return "";
  }

  const match = imageData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw new Error("圖片格式無法讀取。");
  }

  const contentType = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const safeName = String(params.imageName || "patch-paper-image.jpg")
    .replace(/[^\w.\-\u4e00-\u9fff]/g, "-")
    .slice(0, 80);
  const blob = Utilities.newBlob(bytes, contentType, safeName);
  const folder = getImageFolder_();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1600";
}

function getImageFolder_() {
  const folders = DriveApp.getFoldersByName(IMAGE_FOLDER_NAME);

  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder(IMAGE_FOLDER_NAME);
}

function normalizeTags_(value) {
  return String(value || "")
    .split(/[,\s]+/)
    .map(function (tag) {
      const cleanTag = tag.trim().replace(/^#+/, "");
      return cleanTag ? "#" + cleanTag : "";
    })
    .filter(Boolean)
    .join(" ");
}

function getSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  const headers = [
    "email",
    "status",
    "token",
    "subscribedAt",
    "updatedAt",
    "source",
    "userAgent",
    "unsubscribedAt",
  ];

  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeaders = firstRow.join("") !== "";

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function getSpreadsheet_() {
  const spreadsheetId = String(SPREADSHEET_ID || "").trim();

  if (
    spreadsheetId &&
    spreadsheetId !== "PASTE_YOUR_GOOGLE_SHEET_ID_HERE"
  ) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error("Please set SPREADSHEET_ID to your Google Sheet ID.");
  }

  return spreadsheet;
}

function normalizeEmail_(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildUnsubscribeUrl_(token) {
  const baseUrl = ScriptApp.getService().getUrl();
  return baseUrl + "?action=unsubscribe&token=" + encodeURIComponent(token);
}

function iframeResponse_(payload) {
  const safePayload = JSON.stringify(Object.assign({ source: RESPONSE_SOURCE }, payload));
  const message = payload && payload.message ? payload.message : "";
  const html =
    "<!doctype html><html><head><meta charset=\"utf-8\"></head><body>" +
    "<p>" +
    escapeHtml_(message) +
    "</p>" +
    "<script>(function(){var payload=" +
    safePayload +
    ";try{window.parent.postMessage(payload,'*')}catch(error){}try{window.top.postMessage(payload,'*')}catch(error){}}());</script>" +
    "</body></html>";

  return HtmlService.createHtmlOutput(html)
    .setTitle("PATCH PAPER subscription response")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function pageHtml_(title, body) {
  return (
    "<!doctype html><html><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Noto Sans TC',sans-serif;background:#f7f1e5;color:#1e1c19;line-height:1.7;padding:40px;max-width:680px;margin:auto}h1{font-size:32px}</style>" +
    "</head><body><h1>" +
    escapeHtml_(title) +
    "</h1><p>" +
    escapeHtml_(body) +
    "</p></body></html>"
  );
}

function escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlParagraphs_(value) {
  return String(value || "")
    .split(/\n{2,}/)
    .map(function (paragraph) {
      return "<p>" + escapeHtml_(paragraph).replace(/\n/g, "<br>") + "</p>";
    })
    .join("");
}
