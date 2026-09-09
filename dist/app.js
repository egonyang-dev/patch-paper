const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz1v-iomi9gBLKRkSRsinwu-RLeef97eq9uImnLS_8S0lap9RR3auZVkJSW-qQp2E8/exec";

const form = document.querySelector("#subscribeForm");
const statusText = document.querySelector("#formStatus");
const submitButton = form?.querySelector("button[type='submit']");
const clickSymbols = ["☹", "♩", "☺", "♩", "♫", "☻", "♫"];
const issueArticle = document.querySelector("[data-issue-slug]");
const issueList = document.querySelector("[data-issue-list]");
let currentIssue = null;
let adminDialog = null;
let adminStatus = null;
let adminSaveButton = null;
let adminDeleteButton = null;
let likeButton = null;

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
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      body: new FormData(form),
    });

    form.reset();
    setStatus("訂閱完成。");
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

function loadIssueArticle() {
  if (!issueArticle || !isConfigured()) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const slug = issueArticle.dataset.issueSlug || params.get("slug") || "";
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

  window[callbackName] = (payload) => {
    renderIssueArticle(payload);
    cleanup();
  };

  script.src = url.toString();
  script.onerror = cleanup;
  document.head.append(script);
}

function loadIssueList() {
  if (!issueList || !isConfigured()) {
    return;
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

  window[callbackName] = (payload) => {
    renderIssueList(payload);
    cleanup();
  };

  script.src = url.toString();
  script.onerror = cleanup;
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

  if (title && issue.title) {
    title.textContent = issue.title;
    document.title = `${issue.title} | PATCH PAPER`;
  }

  if (body && issue.body) {
    body.replaceChildren(...plainTextToParagraphs(issue.body));
  }

  renderIssueImage(issue);
  renderIssueTags(issue);
  renderIssueAuthor(issue);
  renderIssueLike(issue);
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
  image.src = issue.imageUrl;
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
    return;
  }

  if (!likeButton) {
    likeButton = document.createElement("button");
    likeButton.className = "article-like-button";
    likeButton.type = "button";
    likeButton.addEventListener("click", likeCurrentIssue);
    issueArticle.append(likeButton);
  }

  likeButton.textContent = `㊝ ${Number(issue.likes || 0)}`;
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

      <div class="admin-head">
        <p>PATCH PAPER editor</p>
        <button type="button" class="admin-close" aria-label="關閉">×</button>
      </div>

      <label>
        密碼
        <input name="password" type="password" autocomplete="current-password" required />
      </label>

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

  const adminForm = adminDialog.querySelector(".admin-form");
  adminStatus = adminDialog.querySelector(".admin-status");
  adminSaveButton = adminDialog.querySelector(".admin-save");
  adminDeleteButton = adminDialog.querySelector(".admin-delete");

  button.addEventListener("click", () => {
    fillAdminForm(adminForm);
    adminStatus.textContent = "";
    adminDialog.showModal();
    adminForm.elements.password.focus();
  });

  adminDialog.querySelector(".admin-close").addEventListener("click", () => {
    adminDialog.close();
  });

  adminDialog.querySelector(".admin-cancel").addEventListener("click", () => {
    adminDialog.close();
  });

  adminDeleteButton.addEventListener("click", () => {
    if (!adminForm.elements.password.value.trim()) {
      adminStatus.textContent = "請先輸入管理密碼。";
      adminForm.elements.password.focus();
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
  adminForm.elements.tags.value = issue.tags || "";
  adminForm.elements.body.value = issue.body || "";
  adminForm.elements.sendNewsletter.checked = false;
}

function receiveAppsScriptMessage(event) {
  const payload = event.data || {};

  if (payload.source !== "patch-paper-subscription" || !adminDialog?.open) {
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
