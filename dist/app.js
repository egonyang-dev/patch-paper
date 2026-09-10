const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz1v-iomi9gBLKRkSRsinwu-RLeef97eq9uImnLS_8S0lap9RR3auZVkJSW-qQp2E8/exec";

const form = document.querySelector("#subscribeForm");
const statusText = document.querySelector("#formStatus");
const submitButton = form?.querySelector("button[type='submit']");
const clickSymbols = ["☹", "♩", "☺", "♩", "♫", "☻", "♫"];
const issueArticle = document.querySelector("[data-issue-slug]");
const issueList = document.querySelector("[data-issue-list]");
const ISSUE_CACHE_PREFIX = "patchPaperIssue:";
const ISSUE_LIST_CACHE_KEY = "patchPaperIssues";
const CACHE_MAX_AGE_MS = 1000 * 60 * 30;
let currentIssue = null;
let adminDialog = null;
let adminStatus = null;
let adminSaveButton = null;
let adminDeleteButton = null;
let likeButton = null;
let feedbackDialog = null;
let feedbackStatus = null;
let feedbackButton = null;
let feedbackSubmitButton = null;
let commentsSection = null;
let commentsList = null;
let commentsForm = null;
let commentsStatus = null;
let commentsSubmitButton = null;
let adminGateDialog = null;
let adminGateStatus = null;
let adminGateSubmitButton = null;
let adminGatePassword = "";
let pendingAdminForm = null;

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.classList.toggle("is-error", isError);
}

function isConfigured() {
  return (
    APPS_SCRIPT_URL &&
    !APPS_SCRIPT_URL.includes("PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE")
  );
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");

  if (!isConfigured()) {
    setStatus("請先填入 Apps Script URL。", true);
    return;
  }

  const emailInput = form.querySelector("input[name='email']");
  const userAgentInput = form.querySelector("input[name='userAgent']");
  const email = normalizeEmail(emailInput.value);

  if (!email || !emailInput.checkValidity()) {
    setStatus("請輸入有效 Email。", true);
    return;
  }

  emailInput.value = email;
  userAgentInput.value = navigator.userAgent || "";
  submitButton.disabled = true;
  setStatus("送出中。");

  try {
    const request = fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      body: new FormData(form),
    });
    request.catch(() => {});

    await Promise.race([request, wait(1600)]);

    form.reset();
    setStatus("已送出。信箱可能晚一點收到。");
  } catch (error) {
    setStatus("送出失敗。請稍後再試。", true);
  } finally {
    submitButton.disabled = false;
  }
});

function showClickMood(event) {
  const note = document.createElement("div");
  note.className = "click-mood";
  note.setAttribute("aria-hidden", "true");
  note.style.left = `${event.clientX}px`;
  note.style.top = `${event.clientY}px`;

  clickSymbols.forEach((symbol, index) => {
    const span = document.createElement("span");
    span.textContent = symbol;
    span.style.setProperty("--delay", `${index * 55}ms`);
    span.className = index === 0 ? "is-sad" : "is-happy";
    note.append(span);
  });

  document.body.append(note);
  window.setTimeout(() => note.remove(), 1100);
}

window.addEventListener("pointerdown", showClickMood, { passive: true });
window.addEventListener("message", receiveAppsScriptMessage);
normalizeCurrentIssueUrl();

function loadIssueArticle() {
  if (!issueArticle || !isConfigured()) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const slug = issueArticle.dataset.issueSlug || params.get("slug") || "";
  const cacheKey = `${ISSUE_CACHE_PREFIX}${slug || "current"}`;
  const cachedPayload = readCache(cacheKey);
  let didRender = Boolean(cachedPayload);

  if (cachedPayload) {
    renderIssueArticle(cachedPayload);
  } else {
    renderIssueLoading("等一下下♫♪♩♪♩", "");
  }

  const callbackName = `patchPaperIssue${Date.now()}`;
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set("action", "issue");
  url.searchParams.set("slug", slug);
  url.searchParams.set("callback", callbackName);

  const script = document.createElement("script");
  const cleanup = () => {
    delete window[callbackName];
    script.remove();
  };

  const loadingTimer = window.setTimeout(() => {
    if (!didRender) {
      renderIssueLoading("等一下下♫♪♩♪♩", "");
    }
  }, 4200);

  window[callbackName] = (payload) => {
    didRender = true;
    window.clearTimeout(loadingTimer);
    if (payload?.ok && payload.issue) {
      writeCache(cacheKey, payload);
    }
    renderIssueArticle(payload);
    cleanup();
  };

  script.src = url.toString();
  script.onerror = () => {
    window.clearTimeout(loadingTimer);
    if (!didRender) {
      renderIssueLoading("等一下下♫♪♩♪♩", "");
    }
    cleanup();
  };
  document.head.append(script);
}

function loadIssueList() {
  if (!issueList || !isConfigured()) {
    return;
  }

  const cachedPayload = readCache(ISSUE_LIST_CACHE_KEY);
  let didRender = Boolean(cachedPayload);

  if (cachedPayload) {
    renderIssueList(cachedPayload);
  } else {
    renderIssueListLoading("等一下下♫♪♩♪♩");
  }

  const callbackName = `patchPaperIssues${Date.now()}`;
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set("action", "issues");
  url.searchParams.set("callback", callbackName);

  const script = document.createElement("script");
  const cleanup = () => {
    delete window[callbackName];
    script.remove();
  };

  const loadingTimer = window.setTimeout(() => {
    if (!didRender) {
      renderIssueListLoading("等一下下♫♪♩♪♩");
    }
  }, 5200);

  window[callbackName] = (payload) => {
    didRender = true;
    window.clearTimeout(loadingTimer);
    if (payload?.ok && Array.isArray(payload.issues)) {
      writeCache(ISSUE_LIST_CACHE_KEY, payload);
    }
    renderIssueList(payload);
    cleanup();
  };

  script.src = url.toString();
  script.onerror = () => {
    window.clearTimeout(loadingTimer);
    if (!didRender) {
      renderIssueListLoading("等一下下♫♪♩♪♩");
    }
    cleanup();
  };
  document.head.append(script);
}

function renderIssueArticle(payload) {
  if (!payload || !payload.ok || !payload.issue) {
    renderMissingIssue();
    return;
  }

  const issue = payload.issue;
  issueArticle.classList.remove("is-loading");
  currentIssue = issue;
  if (issue.slug) {
    issueArticle.dataset.issueSlug = issue.slug;
  }
  const kicker = issueArticle.querySelector("[data-issue-kicker]");
  const title = issueArticle.querySelector("[data-issue-title]");
  const body = issueArticle.querySelector("[data-issue-body]");

  if (kicker) {
    const issueLabel = issue.issue ? `Issue ${issue.issue}` : "Issue";
    kicker.textContent = [issueLabel, issue.tags].filter(Boolean).join("  ");
  }

  if (title) {
    title.textContent = issue.title || "untitled";
    document.title = `${issue.title || "文章"} | PATCH PAPER`;
  }

  if (body) {
    body.replaceChildren(...plainTextToParagraphs(issue.body || ""));
  }

  renderIssueImage(issue);
  renderIssueTags(issue);
  renderIssueAuthor(issue);
  renderIssueLike(issue);
  renderIssueFeedback(issue);
  renderIssueComments(issue);
}

function renderMissingIssue() {
  if (!issueArticle) {
    return;
  }

  issueArticle.classList.remove("is-loading");
  currentIssue = null;
  const kicker = issueArticle.querySelector("[data-issue-kicker]");
  const title = issueArticle.querySelector("[data-issue-title]");
  const body = issueArticle.querySelector("[data-issue-body]");
  kicker && (kicker.textContent = "Issue");
  title && (title.textContent = "文章不存在或已刪除。");
  body && body.replaceChildren();
  renderIssueImage({});
  renderIssueTags({});
  renderIssueAuthor({});
  renderIssueLike({});
  renderIssueFeedback({});
  renderIssueComments({});
}

function renderIssueLoading(titleText, bodyText) {
  if (!issueArticle) {
    return;
  }

  issueArticle.classList.add("is-loading");
  currentIssue = null;
  const kicker = issueArticle.querySelector("[data-issue-kicker]");
  const title = issueArticle.querySelector("[data-issue-title]");
  const body = issueArticle.querySelector("[data-issue-body]");
  kicker && (kicker.textContent = "Issue");
  title && (title.textContent = titleText);
  body && body.replaceChildren(...plainTextToParagraphs(bodyText));
  renderIssueImage({});
  renderIssueTags({});
  renderIssueAuthor({});
  renderIssueLike({});
  renderIssueFeedback({});
  renderIssueComments({});
}

function plainTextToParagraphs(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim())
    .map((paragraph) => {
      const element = document.createElement("p");
      paragraph.split("\n").forEach((line, index) => {
        if (index > 0) {
          element.append(document.createElement("br"));
        }

        element.append(document.createTextNode(line));
      });
      return element;
    });
}

loadIssueArticle();
loadIssueList();
setupIssueAdmin();
setupIssueFeedback();
setupIssueComments();

function normalizeCurrentIssueUrl() {
  if (window.location.pathname.endsWith("/issues/read")) {
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}.html${window.location.search}${window.location.hash}`
    );
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function readCache(key) {
  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const cached = JSON.parse(raw);

    if (!cached?.savedAt || Date.now() - cached.savedAt > CACHE_MAX_AGE_MS) {
      return null;
    }

    return cached.payload || null;
  } catch (error) {
    return null;
  }
}

function writeCache(key, payload) {
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        payload,
      })
    );
  } catch (error) {}
}

function clearIssueCaches(slug) {
  try {
    window.localStorage.removeItem(ISSUE_LIST_CACHE_KEY);

    if (slug) {
      window.localStorage.removeItem(`${ISSUE_CACHE_PREFIX}${slug}`);
    }
  } catch (error) {}
}

function renderIssueImage(issue) {
  if (!issueArticle) {
    return;
  }

  let figure = issueArticle.querySelector("[data-issue-image]");

  if (!issue.imageUrl) {
    figure?.remove();
    return;
  }

  if (!figure) {
    figure = document.createElement("figure");
    figure.className = "article-image";
    figure.dataset.issueImage = "";
    const image = document.createElement("img");
    image.alt = "";
    figure.append(image);
    const kicker = issueArticle.querySelector("[data-issue-kicker]");
    kicker?.insertAdjacentElement("afterend", figure);
  }

  const image = figure.querySelector("img");
  image.src = normalizeIssueImageUrl(issue.imageUrl);
}

function normalizeIssueImageUrl(imageUrl) {
  const url = String(imageUrl || "").trim();
  const fileId = getGoogleDriveFileId(url);

  if (!fileId) {
    return url;
  }

  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1600`;
}

function getGoogleDriveFileId(url) {
  const idMatch = url.match(/[?&]id=([^&]+)/);

  if (idMatch) {
    return decodeURIComponent(idMatch[1]);
  }

  const pathMatch = url.match(/\/file\/d\/([^/]+)/);

  if (pathMatch) {
    return decodeURIComponent(pathMatch[1]);
  }

  return "";
}

function renderIssueTags(issue) {
  if (!issueArticle) {
    return;
  }

  let tags = issueArticle.querySelector("[data-issue-tags]");

  if (!issue.tags) {
    tags?.remove();
    return;
  }

  if (!tags) {
    tags = document.createElement("p");
    tags.className = "article-tags";
    tags.dataset.issueTags = "";
    issueArticle.append(tags);
  }

  tags.textContent = issue.tags;
}

function renderIssueAuthor(issue) {
  if (!issueArticle) {
    return;
  }

  let authorBlock = issueArticle.querySelector("[data-issue-author]");
  const hasAuthor = issue.author || issue.authorIg || issue.authorPortfolio || issue.authorEmail;

  if (!hasAuthor) {
    authorBlock?.remove();
    return;
  }

  if (!authorBlock) {
    authorBlock = document.createElement("section");
    authorBlock.className = "article-author";
    authorBlock.dataset.issueAuthor = "";
    issueArticle.append(authorBlock);
  }

  const name = issue.author || "作者";
  const links = [];

  if (issue.authorIg) {
    links.push(createProfileLink("IG", issue.authorIg));
  }

  if (issue.authorPortfolio) {
    links.push(createProfileLink("作品集", issue.authorPortfolio));
  }

  if (issue.authorEmail) {
    links.push(createProfileLink("Email", `mailto:${issue.authorEmail}`));
  }

  authorBlock.replaceChildren();

  const label = document.createElement("p");
  label.className = "eyebrow";
  label.textContent = "Author";

  const authorName = document.createElement("p");
  authorName.className = "article-author-name";
  authorName.textContent = name;

  authorBlock.append(label, authorName, ...links);
}

function createProfileLink(label, href) {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = label;

  if (!href.startsWith("mailto:")) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  return link;
}

function renderIssueLike(issue) {
  if (!issueArticle) {
    return;
  }

  if (!issue.slug) {
    likeButton?.remove();
    likeButton = null;
    removeEmptyArticleActions();
    return;
  }

  if (!likeButton) {
    likeButton = document.createElement("button");
    likeButton.className = "article-like-button";
    likeButton.type = "button";
    likeButton.addEventListener("click", likeCurrentIssue);
  }

  likeButton.textContent = `㊝ ${Number(issue.likes || 0)}`;
  ensureArticleActions().prepend(likeButton);
}

function likeCurrentIssue() {
  if (!currentIssue?.slug || !isConfigured() || !likeButton) {
    return;
  }

  likeButton.disabled = true;
  const nextLikes = Number(currentIssue.likes || 0) + 1;
  currentIssue.likes = nextLikes;
  likeButton.textContent = `㊝ ${nextLikes}`;

  const callbackName = `patchPaperLike${Date.now()}`;
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set("action", "like");
  url.searchParams.set("slug", currentIssue.slug);
  url.searchParams.set("callback", callbackName);

  const script = document.createElement("script");
  const cleanup = () => {
    delete window[callbackName];
    script.remove();
    if (likeButton) {
      likeButton.disabled = false;
    }
  };

  window[callbackName] = (payload) => {
    if (payload?.ok && typeof payload.likes !== "undefined") {
      currentIssue.likes = Number(payload.likes || 0);
      likeButton.textContent = `㊝ ${currentIssue.likes}`;
    }
    cleanup();
  };

  script.src = url.toString();
  script.onerror = cleanup;
  document.head.append(script);
}

function renderIssueFeedback(issue) {
  if (!issueArticle) {
    return;
  }

  if (!issue.slug) {
    feedbackButton?.remove();
    feedbackButton = null;
    removeEmptyArticleActions();
    return;
  }

  if (!feedbackButton) {
    feedbackButton = document.createElement("button");
    feedbackButton.className = "article-feedback-button";
    feedbackButton.type = "button";
    feedbackButton.textContent = "給予作者回饋～";
    feedbackButton.addEventListener("click", openFeedbackDialog);
  }

  ensureArticleActions().append(feedbackButton);
}

function ensureArticleActions() {
  let actions = issueArticle.querySelector("[data-article-actions]");

  if (!actions) {
    actions = document.createElement("div");
    actions.className = "article-actions";
    actions.dataset.articleActions = "";
    issueArticle.append(actions);
  }

  return actions;
}

function removeEmptyArticleActions() {
  const actions = issueArticle?.querySelector("[data-article-actions]");

  if (actions && !actions.children.length) {
    actions.remove();
  }
}

function setupIssueFeedback() {
  if (!issueArticle) {
    return;
  }

  const iframeName = "patchPaperFeedbackFrame";
  const frame = document.createElement("iframe");
  frame.className = "hidden-frame";
  frame.name = iframeName;
  frame.title = "回饋信送出狀態";
  document.body.append(frame);

  feedbackDialog = document.createElement("dialog");
  feedbackDialog.className = "feedback-dialog";
  feedbackDialog.innerHTML = `
    <form class="feedback-form" method="post" target="${iframeName}">
      <input type="hidden" name="action" value="feedback" />
      <input type="hidden" name="returnMode" value="iframe" />
      <input type="hidden" name="issue" value="" />
      <input type="hidden" name="slug" value="" />
      <input type="hidden" name="title" value="" />
      <input type="hidden" name="url" value="" />
      <input type="hidden" name="userAgent" value="" />

      <div class="feedback-head">
        <p>給予作者回饋～</p>
        <button type="button" class="feedback-close" aria-label="關閉">×</button>
      </div>

      <label>
        這封信是
        <select name="feedbackType">
          <option value="給予作者回饋">給予作者回饋～</option>
          <option value="愛的回饋">愛的回饋</option>
          <option value="建設信">建設信</option>
        </select>
      </label>

      <label>
        信
        <textarea name="message" rows="7" placeholder="可以匿名。可以很短。" required></textarea>
      </label>

      <div class="feedback-grid">
        <label>
          名字
          <input name="name" type="text" placeholder="可留空" />
        </label>
        <label>
          Email
          <input name="email" type="email" placeholder="想收到回信再填" />
        </label>
      </div>

      <p class="feedback-note">這封信只會送到 PATCH PAPER 後台，不會公開。</p>
      <p class="feedback-status" role="status" aria-live="polite"></p>

      <div class="feedback-actions">
        <button type="button" class="feedback-cancel">取消</button>
        <button type="submit" class="feedback-submit">送出 ♫</button>
      </div>
    </form>
  `;
  document.body.append(feedbackDialog);

  const feedbackForm = feedbackDialog.querySelector(".feedback-form");
  feedbackStatus = feedbackDialog.querySelector(".feedback-status");
  feedbackSubmitButton = feedbackDialog.querySelector(".feedback-submit");

  feedbackDialog.querySelector(".feedback-close").addEventListener("click", () => {
    feedbackDialog.close();
  });

  feedbackDialog.querySelector(".feedback-cancel").addEventListener("click", () => {
    feedbackDialog.close();
  });

  feedbackForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitFeedbackForm(feedbackForm);
  });
}

function openFeedbackDialog() {
  if (!feedbackDialog) {
    return;
  }

  const feedbackForm = feedbackDialog.querySelector(".feedback-form");
  fillFeedbackForm(feedbackForm);
  feedbackStatus.textContent = "";
  feedbackDialog.showModal();
  feedbackForm.elements.message.focus();
}

function fillFeedbackForm(feedbackForm) {
  const issue = currentIssue || {};
  feedbackForm.elements.issue.value = issue.issue || "";
  feedbackForm.elements.slug.value = issue.slug || "";
  feedbackForm.elements.title.value = issue.title || "";
  feedbackForm.elements.url.value = window.location.href;
  feedbackForm.elements.userAgent.value = navigator.userAgent || "";
  feedbackForm.elements.feedbackType.value = "給予作者回饋";
  feedbackForm.elements.message.value = "";
  feedbackForm.elements.name.value = "";
  feedbackForm.elements.email.value = "";
}

function submitFeedbackForm(feedbackForm) {
  if (!isConfigured()) {
    feedbackStatus.textContent = "等一下下♫♪♩♪♩";
    return;
  }

  if (!feedbackForm.elements.message.value.trim()) {
    feedbackStatus.textContent = "信還是空的。";
    feedbackForm.elements.message.focus();
    return;
  }

  feedbackForm.setAttribute("action", APPS_SCRIPT_URL);
  feedbackSubmitButton.disabled = true;
  feedbackStatus.textContent = "送出中。";
  HTMLFormElement.prototype.submit.call(feedbackForm);
}

function handleFeedbackResponse(payload) {
  if (!feedbackStatus) {
    return;
  }

  if (feedbackSubmitButton) {
    feedbackSubmitButton.disabled = false;
  }

  if (!payload.ok) {
    feedbackStatus.textContent = payload.message || "送出失敗。";
    return;
  }

  feedbackStatus.textContent = "收到了。謝謝你把信放在這裡♫♪♩♪♩";
  window.setTimeout(() => feedbackDialog?.close(), 1200);
}

function setupIssueComments() {
  if (!issueArticle) {
    return;
  }

  const iframeName = "patchPaperCommentFrame";
  const frame = document.createElement("iframe");
  frame.className = "hidden-frame";
  frame.name = iframeName;
  frame.title = "留言送出狀態";
  document.body.append(frame);
}

function renderIssueComments(issue) {
  if (!issueArticle) {
    return;
  }

  if (!issue.slug) {
    commentsSection?.remove();
    commentsSection = null;
    commentsList = null;
    commentsForm = null;
    commentsStatus = null;
    commentsSubmitButton = null;
    return;
  }

  if (!commentsSection) {
    commentsSection = document.createElement("section");
    commentsSection.className = "comments-section";
    commentsSection.dataset.issueComments = "";
    commentsSection.innerHTML = `
      <div class="comments-head">
        <p>友善討論區 (=^‥^=)</p>
      </div>

      <div class="comments-list" aria-live="polite"></div>

      <form class="comments-form" method="post" target="patchPaperCommentFrame">
        <input type="hidden" name="action" value="comment" />
        <input type="hidden" name="returnMode" value="iframe" />
        <input type="hidden" name="issue" value="" />
        <input type="hidden" name="slug" value="" />
        <input type="hidden" name="title" value="" />
        <input type="hidden" name="url" value="" />
        <input type="hidden" name="userAgent" value="" />

        <label>
          名字
          <input name="name" type="text" placeholder="可留空" />
        </label>

        <label>
          留言
          <textarea name="message" rows="4" placeholder="ฅ(=^･ω･^=)ฅ₍˄•.•˄₎و🐾" required></textarea>
        </label>

        <div class="comments-actions">
          <p class="comments-status" role="status" aria-live="polite"></p>
          <button type="submit" class="comments-submit">送出 🐾</button>
        </div>
      </form>
    `;
    issueArticle.append(commentsSection);
    commentsList = commentsSection.querySelector(".comments-list");
    commentsForm = commentsSection.querySelector(".comments-form");
    commentsStatus = commentsSection.querySelector(".comments-status");
    commentsSubmitButton = commentsSection.querySelector(".comments-submit");
    commentsForm.addEventListener("submit", submitCommentForm);
  }

  commentsForm.elements.issue.value = issue.issue || "";
  commentsForm.elements.slug.value = issue.slug || "";
  commentsForm.elements.title.value = issue.title || "";
  commentsForm.elements.url.value = window.location.href;
  commentsForm.elements.userAgent.value = navigator.userAgent || "";
  commentsStatus.textContent = "";
  renderCommentsLoading("等一下下♫♪♩♪♩");
  loadIssueComments(issue.slug);
}

function loadIssueComments(slug) {
  if (!commentsList || !isConfigured()) {
    renderCommentsLoading("等一下下♫♪♩♪♩");
    return;
  }

  const callbackName = `patchPaperComments${Date.now()}`;
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set("action", "comments");
  url.searchParams.set("slug", slug);
  url.searchParams.set("callback", callbackName);

  const script = document.createElement("script");
  const cleanup = () => {
    delete window[callbackName];
    script.remove();
  };

  window[callbackName] = (payload) => {
    renderComments(payload);
    cleanup();
  };

  script.src = url.toString();
  script.onerror = () => {
    renderCommentsLoading("等一下下♫♪♩♪♩");
    cleanup();
  };
  document.head.append(script);
}

function renderComments(payload) {
  if (!commentsList) {
    return;
  }

  if (!payload?.ok || !Array.isArray(payload.comments)) {
    renderCommentsLoading("等一下下♫♪♩♪♩");
    return;
  }

  if (!payload.comments.length) {
    renderCommentsLoading("目前還沒有人留言。🐾 (ﾐΦ ﻌ Φﾐ)");
    return;
  }

  commentsList.replaceChildren(
    ...payload.comments.map((comment) => {
      const item = document.createElement("article");
      item.className = "comment-item";

      const meta = document.createElement("p");
      meta.className = "comment-meta";
      meta.textContent = [comment.name || "匿名", comment.createdDate].filter(Boolean).join(" / ");

      const message = document.createElement("div");
      message.className = "comment-message";
      message.replaceChildren(...plainTextToParagraphs(comment.message || ""));

      item.append(meta, message);
      return item;
    })
  );
}

function renderCommentsLoading(message) {
  if (!commentsList) {
    return;
  }

  const empty = document.createElement("p");
  empty.className = "comments-empty";
  empty.textContent = message;
  commentsList.replaceChildren(empty);
}

function submitCommentForm(event) {
  event.preventDefault();

  if (!commentsForm || !commentsStatus) {
    return;
  }

  if (!isConfigured()) {
    commentsStatus.textContent = "等一下下♫♪♩♪♩";
    return;
  }

  if (!commentsForm.elements.message.value.trim()) {
    commentsStatus.textContent = "留言還是空的。";
    commentsForm.elements.message.focus();
    return;
  }

  commentsForm.elements.url.value = window.location.href;
  commentsForm.elements.userAgent.value = navigator.userAgent || "";
  commentsForm.setAttribute("action", APPS_SCRIPT_URL);
  commentsSubmitButton.disabled = true;
  commentsStatus.textContent = "送出中。";
  HTMLFormElement.prototype.submit.call(commentsForm);
}

function handleCommentResponse(payload) {
  if (!commentsStatus || !commentsForm) {
    return;
  }

  if (commentsSubmitButton) {
    commentsSubmitButton.disabled = false;
  }

  if (!payload.ok) {
    commentsStatus.textContent = payload.message || "留言送出失敗。";
    return;
  }

  const issue = currentIssue || {};
  commentsStatus.textContent = "留言已送出。🐾 ฅ(๑*д*๑)ฅ!!";
  commentsForm.elements.name.value = "";
  commentsForm.elements.message.value = "";
  commentsForm.elements.issue.value = issue.issue || "";
  commentsForm.elements.slug.value = issue.slug || "";
  commentsForm.elements.title.value = issue.title || "";
  commentsForm.elements.url.value = window.location.href;
  commentsForm.elements.userAgent.value = navigator.userAgent || "";
  loadIssueComments(payload.slug || issue.slug);
}

function renderIssueList(payload) {
  if (!payload || !payload.ok || !Array.isArray(payload.issues) || !payload.issues.length) {
    const empty = document.createElement("p");
    empty.className = "article-empty";
    empty.textContent = "文章整理中。";
    issueList?.replaceChildren(empty);
    return;
  }

  issueList.replaceChildren(
    ...payload.issues.map((issue) => {
      const link = document.createElement("a");
      link.className = "article-row";
      link.href = getIssueReadHref(issue);

      const meta = document.createElement("span");
      meta.className = "article-row-meta";
      meta.textContent = [
        issue.issue ? `Issue ${issue.issue}` : "Issue",
        issue.publishedDate,
        issue.author,
        issue.tags,
      ]
        .filter(Boolean)
        .join(" / ");

      const title = document.createElement("strong");
      title.textContent = issue.title || "untitled";

      link.append(title, meta);

      return link;
    })
  );
}

function renderIssueListLoading(message) {
  if (!issueList) {
    return;
  }

  const loading = document.createElement("p");
  loading.className = "article-empty";
  loading.textContent = message;
  issueList.replaceChildren(loading);
}

function getIssueReadHref(issue) {
  const slug = encodeURIComponent(issue.slug || issue.issue || "");

  if (window.location.pathname.includes("/issues/")) {
    return `./read.html?slug=${slug}`;
  }

  return `./issues/read.html?slug=${slug}`;
}

function setupIssueAdmin() {
  if (!issueArticle) {
    return;
  }

  const iframeName = "patchPaperAdminFrame";
  const frame = document.createElement("iframe");
  frame.className = "hidden-frame";
  frame.name = iframeName;
  frame.title = "文章更新狀態";
  document.body.append(frame);

  const button = document.createElement("button");
  button.className = "admin-edit-button";
  button.type = "button";
  button.setAttribute("aria-label", "編輯文章");
  button.textContent = "✎";
  issueArticle.insertAdjacentElement("afterend", button);

  adminDialog = document.createElement("dialog");
  adminDialog.className = "admin-dialog";
  adminDialog.innerHTML = `
    <form class="admin-form" method="post" target="${iframeName}">
      <input type="hidden" name="action" value="saveIssue" />
      <input type="hidden" name="returnMode" value="iframe" />
      <input type="hidden" name="imageData" value="" />
      <input type="hidden" name="imageName" value="" />
      <input type="hidden" name="password" value="" />

      <div class="admin-head">
        <p>PATCH PAPER editor</p>
        <button type="button" class="admin-close" aria-label="關閉">×</button>
      </div>

      <div class="admin-grid">
        <label>
          Issue
          <input name="issue" type="text" value="03" required />
        </label>
        <label>
          Slug
          <input name="slug" type="text" value="03" required />
        </label>
      </div>

      <label>
        文章標題
        <input name="title" type="text" required />
      </label>

      <div class="admin-grid">
        <label>
          作者
          <input name="author" type="text" placeholder="作者名稱" />
        </label>
        <label>
          作者 Email
          <input name="authorEmail" type="email" placeholder="合作聯絡信箱" />
        </label>
      </div>

      <div class="admin-grid">
        <label>
          作者 IG
          <input name="authorIg" type="url" placeholder="https://www.instagram.com/..." />
        </label>
        <label>
          作品集
          <input name="authorPortfolio" type="url" placeholder="https://..." />
        </label>
      </div>

      <label>
        信件標題
        <input name="subject" type="text" />
      </label>

      <label>
        圖片網址
        <input name="imageUrl" type="url" placeholder="可留空，或貼圖片網址" />
      </label>

      <label>
        上傳圖片
        <input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
      </label>

      <label>
        #分類
        <input name="tags" type="text" placeholder="#藝術市場 #散文" />
      </label>

      <label>
        文章內容
        <textarea name="body" rows="13" required></textarea>
      </label>

      <input name="status" type="hidden" value="current" />

      <label class="admin-check">
        <input name="sendNewsletter" type="checkbox" value="yes" />
        <span>更新後立刻寄給所有訂閱者</span>
      </label>

      <p class="admin-status" role="status" aria-live="polite"></p>

      <div class="admin-actions">
        <button type="button" class="admin-delete">刪除文章</button>
        <button type="button" class="admin-cancel">取消</button>
        <button type="submit" class="admin-save">更新文章</button>
      </div>
    </form>
  `;
  document.body.append(adminDialog);
  setupAdminGate(iframeName);

  const adminForm = adminDialog.querySelector(".admin-form");
  adminStatus = adminDialog.querySelector(".admin-status");
  adminSaveButton = adminDialog.querySelector(".admin-save");
  adminDeleteButton = adminDialog.querySelector(".admin-delete");

  button.addEventListener("click", () => {
    pendingAdminForm = adminForm;
    openAdminGate();
  });

  adminDialog.querySelector(".admin-close").addEventListener("click", () => {
    adminDialog.close();
  });

  adminDialog.querySelector(".admin-cancel").addEventListener("click", () => {
    adminDialog.close();
  });

  adminDeleteButton.addEventListener("click", () => {
    if (!adminForm.elements.password.value.trim()) {
      adminDialog.close();
      pendingAdminForm = adminForm;
      openAdminGate();
      return;
    }

    if (!window.confirm("確定要刪除這篇文章嗎？")) {
      return;
    }

    submitAdminForm(adminForm, "deleteIssue");
  });

  adminForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitAdminForm(adminForm, "saveIssue");
  });
}

function setupAdminGate(iframeName) {
  adminGateDialog = document.createElement("dialog");
  adminGateDialog.className = "admin-dialog admin-gate-dialog";
  adminGateDialog.innerHTML = `
    <form class="admin-gate-form" method="post" target="${iframeName}">
      <input type="hidden" name="action" value="verifyAdmin" />
      <input type="hidden" name="returnMode" value="iframe" />

      <div class="admin-head">
        <p>管理密碼</p>
        <button type="button" class="admin-close" aria-label="關閉">×</button>
      </div>

      <label>
        密碼
        <input name="password" type="password" autocomplete="current-password" required />
      </label>

      <p class="admin-gate-status" role="status" aria-live="polite"></p>

      <div class="admin-actions">
        <button type="button" class="admin-cancel">取消</button>
        <button type="submit" class="admin-save">確認</button>
      </div>
    </form>
  `;
  document.body.append(adminGateDialog);

  const formElement = adminGateDialog.querySelector(".admin-gate-form");
  adminGateStatus = adminGateDialog.querySelector(".admin-gate-status");
  adminGateSubmitButton = adminGateDialog.querySelector(".admin-save");

  adminGateDialog.querySelector(".admin-close").addEventListener("click", () => {
    adminGateDialog.close();
  });

  adminGateDialog.querySelector(".admin-cancel").addEventListener("click", () => {
    adminGateDialog.close();
  });

  formElement.addEventListener("submit", (event) => {
    event.preventDefault();
    submitAdminGate(formElement);
  });
}

function openAdminGate() {
  if (!adminGateDialog) {
    return;
  }

  const formElement = adminGateDialog.querySelector(".admin-gate-form");
  formElement.elements.password.value = "";
  adminGateStatus.textContent = "";
  adminGateDialog.showModal();
  formElement.elements.password.focus();
}

function submitAdminGate(formElement) {
  if (!isConfigured()) {
    adminGateStatus.textContent = "等一下下♫♪♩♪♩";
    return;
  }

  if (!formElement.elements.password.value.trim()) {
    adminGateStatus.textContent = "請輸入管理密碼。";
    formElement.elements.password.focus();
    return;
  }

  formElement.setAttribute("action", APPS_SCRIPT_URL);
  adminGateSubmitButton.disabled = true;
  adminGateStatus.textContent = "確認中。";
  HTMLFormElement.prototype.submit.call(formElement);
}

function handleAdminGateResponse(payload) {
  if (adminGateSubmitButton) {
    adminGateSubmitButton.disabled = false;
  }

  if (!adminGateStatus) {
    return;
  }

  if (!payload.ok || payload.status !== "admin_verified") {
    adminGateStatus.textContent = payload.message || "管理密碼錯誤。";
    return;
  }

  const formElement = adminGateDialog.querySelector(".admin-gate-form");
  adminGatePassword = formElement.elements.password.value;
  adminGateDialog.close();

  if (!pendingAdminForm) {
    return;
  }

  fillAdminForm(pendingAdminForm);
  pendingAdminForm.elements.password.value = adminGatePassword;
  adminStatus.textContent = "";
  adminDialog.showModal();
  pendingAdminForm.elements.title.focus();
}

function submitAdminForm(adminForm, action) {
  if (!isConfigured()) {
    adminStatus.textContent = "請先填入 Apps Script URL。";
    return;
  }

  adminForm.elements.action.value = action;
  adminForm.setAttribute("action", APPS_SCRIPT_URL);
  setAdminButtonsDisabled(true);

  if (action === "deleteIssue") {
    adminStatus.textContent = "刪除中。";
    adminForm.elements.imageData.value = "";
    adminForm.elements.imageName.value = "";
    HTMLFormElement.prototype.submit.call(adminForm);
    return;
  }

  adminStatus.textContent = adminForm.elements.sendNewsletter.checked
    ? "更新中，等一下會寄出。"
    : "更新中。";

  prepareImageFields(adminForm)
    .then(() => {
      HTMLFormElement.prototype.submit.call(adminForm);
    })
    .catch((error) => {
      setAdminButtonsDisabled(false);
      adminStatus.textContent = error.message || "圖片讀取失敗。";
    });
}

function setAdminButtonsDisabled(disabled) {
  if (adminSaveButton) {
    adminSaveButton.disabled = disabled;
  }

  if (adminDeleteButton) {
    adminDeleteButton.disabled = disabled;
  }
}

function fillAdminForm(adminForm) {
  const params = new URLSearchParams(window.location.search);
  const slug = issueArticle.dataset.issueSlug || params.get("slug") || "03";
  const issue = currentIssue || {};

  adminForm.elements.issue.value = issue.issue || slug || "03";
  adminForm.elements.slug.value = issue.slug || slug || "03";
  adminForm.elements.title.value = issue.title || "";
  adminForm.elements.subject.value = issue.subject || "";
  adminForm.elements.author.value = issue.author || "";
  adminForm.elements.authorIg.value = issue.authorIg || "";
  adminForm.elements.authorPortfolio.value = issue.authorPortfolio || "";
  adminForm.elements.authorEmail.value = issue.authorEmail || "";
  adminForm.elements.imageUrl.value = issue.imageUrl || "";
  adminForm.elements.imageFile.value = "";
  adminForm.elements.imageData.value = "";
  adminForm.elements.imageName.value = "";
  adminForm.elements.password.value = adminGatePassword;
  adminForm.elements.tags.value = issue.tags || "";
  adminForm.elements.body.value = issue.body || "";
  adminForm.elements.sendNewsletter.checked = false;
}

function receiveAppsScriptMessage(event) {
  const payload = event.data || {};

  if (payload.source !== "patch-paper-subscription") {
    return;
  }

  if (payload.status === "comment_saved" || commentsSubmitButton?.disabled) {
    handleCommentResponse(payload);
    return;
  }

  if (adminGateDialog?.open) {
    handleAdminGateResponse(payload);
    return;
  }

  if (feedbackDialog?.open) {
    handleFeedbackResponse(payload);
    return;
  }

  if (!adminDialog?.open) {
    return;
  }

  if (adminSaveButton) {
    setAdminButtonsDisabled(false);
  }

  if (!adminStatus) {
    return;
  }

  if (!payload.ok) {
    adminStatus.textContent = payload.message || "更新失敗。";
    return;
  }

  if (payload.status === "saved") {
    adminStatus.textContent = "已更新。";
    const adminForm = adminDialog.querySelector(".admin-form");
    const previousSlug = currentIssue?.slug;
    currentIssue = {
      issue: adminForm.elements.issue.value,
      slug: adminForm.elements.slug.value,
      title: adminForm.elements.title.value,
      subject: adminForm.elements.subject.value,
      status: "current",
      imageUrl: payload.imageUrl || adminForm.elements.imageUrl.value,
      tags: adminForm.elements.tags.value,
      author: adminForm.elements.author.value,
      authorIg: adminForm.elements.authorIg.value,
      authorPortfolio: adminForm.elements.authorPortfolio.value,
      authorEmail: adminForm.elements.authorEmail.value,
      likes: payload.likes || currentIssue?.likes || 0,
      body: adminForm.elements.body.value,
    };
    clearIssueCaches(previousSlug);
    clearIssueCaches(currentIssue.slug);
    writeCache(`${ISSUE_CACHE_PREFIX}${currentIssue.slug}`, { ok: true, issue: currentIssue });
    renderIssueArticle({ ok: true, issue: currentIssue });
    if (currentIssue.slug) {
      const url = new URL(window.location.href);
      url.searchParams.set("slug", currentIssue.slug);
      window.history.replaceState({}, "", url);
    }
    window.setTimeout(() => adminDialog.close(), 1000);
  }

  if (payload.status === "deleted") {
    adminStatus.textContent = "已刪除。";
    clearIssueCaches(currentIssue?.slug);
    renderMissingIssue();
    window.setTimeout(() => {
      adminDialog.close();
      window.location.href = "./index.html";
    }, 700);
  }
}

function prepareImageFields(adminForm) {
  const file = adminForm.elements.imageFile.files[0];
  adminForm.elements.imageData.value = "";
  adminForm.elements.imageName.value = "";

  if (!file) {
    return Promise.resolve();
  }

  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("請選圖片檔。"));
  }

  if (file.size > 8 * 1024 * 1024) {
    return Promise.reject(new Error("圖片請先壓到 8MB 以內。"));
  }

  return resizeImage(file).then((dataUrl) => {
    adminForm.elements.imageData.value = dataUrl;
    adminForm.elements.imageName.value = file.name || "patch-paper-image.jpg";
  });
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("圖片讀取失敗。"));
    reader.onload = () => {
      const image = new Image();

      image.onerror = () => resolve(reader.result);
      image.onload = () => {
        const maxWidth = 1600;
        const scale = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.84));
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}
