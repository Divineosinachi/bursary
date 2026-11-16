(() => {
  const header = document.querySelector(".welcome-header");
  const navigation = header?.querySelector(".welcome-nav");
  const menuToggle = header?.querySelector(".welcome-menu-toggle");

  if (!header || !navigation || !menuToggle) return;

  const menuQuery = window.matchMedia("(max-width: 680px)");
  const sectionLinks = Array.from(navigation.querySelectorAll('a[href^="#"]'));
  const sections = sectionLinks
    .map((link) => document.getElementById(link.hash.slice(1)))
    .filter((section) => section !== null);
  let scrollUpdateScheduled = false;

  function setMenuOpen(isOpen) {
    navigation.classList.toggle("is-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
  }

  function updateCurrentSection() {
    const activationPoint = window.scrollY + header.offsetHeight + 32;
    let currentSectionId = "";

    sections.forEach((section) => {
      if (section.getBoundingClientRect().top + window.scrollY <= activationPoint) {
        currentSectionId = section.id;
      }
    });

    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      currentSectionId = sections[sections.length - 1]?.id ?? currentSectionId;
    }

    sectionLinks.forEach((link) => {
      if (link.hash === `#${currentSectionId}`) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function scheduleCurrentSectionUpdate() {
    if (scrollUpdateScheduled) return;
    scrollUpdateScheduled = true;
    window.requestAnimationFrame(() => {
      updateCurrentSection();
      scrollUpdateScheduled = false;
    });
  }

  menuToggle.addEventListener("click", () => {
    setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
  });

  navigation.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      setMenuOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
      setMenuOpen(false);
      menuToggle.focus();
    }
  });

  menuQuery.addEventListener("change", (event) => {
    if (!event.matches) setMenuOpen(false);
  });

  window.addEventListener("scroll", scheduleCurrentSectionUpdate, { passive: true });
  window.addEventListener("resize", scheduleCurrentSectionUpdate);
  window.addEventListener("hashchange", scheduleCurrentSectionUpdate);
  setMenuOpen(false);
  updateCurrentSection();
})();
