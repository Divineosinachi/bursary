(() => {
  const installButton = document.getElementById("install-app");
  const installStatus = document.getElementById("install-status");
  const navigation = document.getElementById("welcome-navigation");
  const menuToggle = document.querySelector(".welcome-menu-toggle");
  let deferredInstallPrompt = null;

  if (!installButton || !installStatus) {
    return;
  }

  const showInstallInstructions = () => {
    installStatus.textContent = "To install, open your browser menu and choose “Install app” or “Add to Home Screen”. On iPhone or iPad, use Share, then Add to Home Screen.";
    installStatus.hidden = false;
  };

  const isInstalled = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  const closeMobileNavigation = () => {
    navigation?.classList.remove("is-open");
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.setAttribute("aria-label", "Open navigation menu");
  };

  if (isInstalled()) {
    installButton.hidden = true;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installButton.hidden = true;
    installStatus.textContent = "CRE Bursary Portal is installed on this device.";
    installStatus.hidden = false;
  });

  installButton.addEventListener("click", async () => {
    closeMobileNavigation();

    if (!deferredInstallPrompt) {
      showInstallInstructions();
      return;
    }

    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;

    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") {
        installButton.hidden = true;
        installStatus.textContent = "CRE Bursary Portal is being installed.";
        installStatus.hidden = false;
      }
    } catch (error) {
      console.error("Could not start the app installation prompt.", error);
      showInstallInstructions();
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js")
      .catch((error) => {
        console.error("Could not register the service worker.", error);
      });
  }
})();
