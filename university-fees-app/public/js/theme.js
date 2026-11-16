(function initializeAppearance() {
  const storageKey = "unifee_appearance";
  const validModes = ["system", "light", "dark"];
  const root = document.documentElement;
  const systemPreference = window.matchMedia("(prefers-color-scheme: dark)");
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
  }

  function addAppearanceControl() {
    const letterhead = document.querySelector(".letterhead");
    const control = document.createElement("div");
    control.className = "appearance-control";
    control.innerHTML = `
      <label for="appearance-mode">Appearance</label>
      <select id="appearance-mode" aria-label="Color theme">
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>`;

    const selector = control.querySelector("select");
    selector.value = mode;
    selector.addEventListener("change", () => {
      applyMode(selector.value);
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
