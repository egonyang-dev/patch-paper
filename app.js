const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz1v-iomi9gBLKRkSRsinwu-RLeef97eq9uImnLS_8S0lap9RR3auZVkJSW-qQp2E8/exec";

const form = document.querySelector("#subscribeForm");
const statusText = document.querySelector("#formStatus");
const submitButton = form?.querySelector("button[type='submit']");
const clickSymbols = ["☹", "♩", "☺", "♩", "♫", "☻", "♫"];

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
