const SPREADSHEET_ID = "PASTE_YOUR_GOOGLE_SHEET_ID_HERE";
const SHEET_NAME = "subscribers";
const RESPONSE_SOURCE = "patch-paper-subscription";

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
          sheet.getRange(rowNumber, 5).setValue(now);
          return {
            ok: true,
            status: "duplicate",
            message: "Already subscribed.",
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

    return {
      ok: true,
      status: "subscribed",
      message: "Subscribed.",
    };
  } finally {
    lock.releaseLock();
  }
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
    "<script>window.parent.postMessage(" +
    safePayload +
    ", '*');</script>" +
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
