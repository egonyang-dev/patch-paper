// ── Scroll reveal ───────────────────────────────────────────
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.12,
    rootMargin: "0px 0px -60px 0px",
  }
);

document.querySelectorAll(".reveal").forEach((el) => {
  revealObserver.observe(el);
});

// ── Hero — fade in on load ──────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  const hero = document.querySelector(".hero");
  if (hero) {
    hero.style.opacity = "0";
    hero.style.transition = "opacity 1.2s ease";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        hero.style.opacity = "1";
      });
    });
  }
});

// ── Cursor: subtle crosshair on image hover ─────────────────
document.querySelectorAll(".image-block__frame, .diptych__item, .full-image").forEach((el) => {
  el.style.cursor = "crosshair";
});
