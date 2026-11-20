(function initializeAppearance() {
  const storageKey = "unifee_appearance";
  const validModes = ["system", "light", "dark"];
  const root = document.documentElement;
  const systemPreference = window.matchMedia("(prefers-color-scheme: dark)");
  const sunIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path></svg>`;
  const moonIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20.1 15.1A8.5 8.5 0 0 1 8.9 3.9 8.5 8.5 0 1 0 20.1 15.1Z"></path></svg>`;
  let mode = "system";

  try {
    const savedMode = localStorage.getItem(storageKey);
    if (validModes.includes(savedMode)) mode = savedMode;
  } catch (error) {
    // Keep the system preference when browser storage is unavailable.
  }

  function applyMode(nextMode) {
    mode = nextMode;
    const resolvedMode = mode === "system"
      ? systemPreference.matches ? "dark" : "light"
      : mode;
    root.dataset.theme = resolvedMode;
    root.style.colorScheme = resolvedMode;
    updateAppearanceIcon(resolvedMode);
  }

  function updateAppearanceIcon(resolvedMode) {
    const icon = document.querySelector(".appearance-icon");
    if (icon) icon.innerHTML = resolvedMode === "dark" ? moonIcon : sunIcon;

    const toggle = document.querySelector(".appearance-toggle");
    if (toggle) {
      const nextMode = resolvedMode === "dark" ? "light" : "dark";
      const label = `Switch to ${nextMode} mode`;
      toggle.setAttribute("aria-label", label);
      toggle.title = label;
    }
  }

  function addAppearanceControl() {
    const letterhead = document.querySelector(".letterhead");
    const control = document.createElement("div");
    control.className = "appearance-control";
    control.innerHTML = `
      <button class="appearance-toggle" type="button" aria-label="Switch theme">
        <span class="appearance-icon" aria-hidden="true"></span>
      </button>`;

    const toggle = control.querySelector(".appearance-toggle");
    toggle.addEventListener("click", () => {
      applyMode(root.dataset.theme === "dark" ? "light" : "dark");
      try {
        localStorage.setItem(storageKey, mode);
      } catch (error) {
        console.warn("Could not save the appearance preference in this browser.", error);
      }
    });

    if (letterhead) {
      let inner = letterhead.querySelector(".letterhead-inner");
      if (!inner) {
        inner = document.createElement("div");
        inner.className = "letterhead-inner";
        const content = document.createElement("div");
        content.className = "letterhead-content";
        const existingContent = Array.from(letterhead.childNodes);
        existingContent.forEach((node) => content.appendChild(node));
        inner.appendChild(content);
        letterhead.appendChild(inner);
      }

      const content = inner.querySelector(".letterhead-content");
      if (content && !content.querySelector(".brand-lockup")) {
        const lockup = document.createElement("div");
        lockup.className = "brand-lockup";
        const logo = document.createElement("img");
        logo.className = "brand-logo";
        logo.src = "/images/cresa-logo.jpg";
        logo.alt = "CRESA logo";
        logo.width = 52;
        logo.height = 52;
        logo.decoding = "async";
        const copy = document.createElement("div");
        copy.className = "brand-copy";
        Array.from(content.childNodes).forEach((node) => copy.appendChild(node));
        lockup.append(logo, copy);
        content.appendChild(lockup);
      }
      inner.appendChild(control);
    } else {
      const host = document.getElementById("welcome-appearance");
      if (host) host.appendChild(control);
    }

    updateAppearanceIcon(root.dataset.theme);

    if (!document.querySelector('link[rel="icon"]')) {
      const icon = document.createElement("link");
      icon.rel = "icon";
      icon.href = "/images/cresa-logo.jpg";
      document.head.appendChild(icon);
    }
  }

  applyMode(mode);
  systemPreference.addEventListener("change", () => {
    if (mode === "system") applyMode(mode);
  });
  document.addEventListener("DOMContentLoaded", addAppearanceControl, { once: true });
})();
