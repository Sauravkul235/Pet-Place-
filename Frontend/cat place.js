const menuBtn = document.getElementById("menu-btn");
const navLinks = document.getElementById("nav-links");
const menuBtnIcon = menuBtn?.querySelector("i");
const navOverlay = document.getElementById("nav-overlay");

function toggleMenu(open) {
  if (!navLinks) return;
  if (open) {
    navLinks.classList.add("open");
    navOverlay?.classList.add("active");
    menuBtnIcon?.setAttribute("class", "ri-close-line");
  } else {
    navLinks.classList.remove("open");
    navOverlay?.classList.remove("active");
    menuBtnIcon?.setAttribute("class", "ri-menu-line");
  }
}

menuBtn?.addEventListener("click", (e) => {
  const isOpen = navLinks.classList.contains("open");
  toggleMenu(!isOpen);
  e.stopPropagation();
});

navOverlay?.addEventListener("click", () => toggleMenu(false));

navLinks?.addEventListener("click", (e) => {
  const clicked = e.target;
  if (clicked.closest("a") || clicked.tagName === "I") toggleMenu(false);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && navLinks?.classList.contains("open")) toggleMenu(false);
});

(function () {
  let __srInitialized = false;

  function initScrollReveal() {
    if (__srInitialized) return;
    if (typeof ScrollReveal === "undefined") {
      return;
    }

    __srInitialized = true;

    const sr = ScrollReveal({
      distance: "60px",
      origin: "bottom",
      duration: 900,
      easing: "ease-in-out",
      opacity: 0,
      reset: true, 
      mobile: true,
    });

    if (document.querySelector(".header_content")) {
      sr.reveal(".header_content h4", { delay: 100 });
      sr.reveal(".header_content h1", { delay: 300 });
      sr.reveal(".header_content h2", { delay: 500 });
      sr.reveal(".header_content p", { delay: 700 });
      sr.reveal(".header-btn", { delay: 900 });
      sr.reveal(".header_image", { delay: 1100 });
    }

    if (document.querySelector(".intro_card")) {
      sr.reveal(".section__subheader", { delay: 100 });
      sr.reveal(".section__header", { delay: 180 });
      sr.reveal(".intro_card", { interval: 180, delay: 260 });
      sr.reveal(".service__card", { interval: 180, delay: 340 });
    }

  }

  function runInitOnceSafe() {
    if (document.readyState === "interactive" || document.readyState === "complete") {
      requestAnimationFrame(initScrollReveal);
    } else {
      document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(initScrollReveal));
    }
  }

  runInitOnceSafe();

  window.addEventListener("pageshow", (event) => {
    requestAnimationFrame(initScrollReveal);
  });

  setTimeout(() => {
    if (typeof ScrollReveal !== "undefined") initScrollReveal();
  }, 700);
})();


