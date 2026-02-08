(function () {
  var doc = document;
  var root = doc.documentElement;

  function setPageHidden(hidden) {
    if (!root) return;
    if (hidden) {
      root.classList.add("timeline-kc-hidden");
    } else {
      root.classList.remove("timeline-kc-hidden");
    }
  }

  function findRestartControl() {
    var byId = doc.getElementById("reset-login");
    if (byId) return byId;

    var links = Array.prototype.slice.call(doc.querySelectorAll("a,button"));
    return (
      links.find(function (link) {
        var id = (link.id || "").toLowerCase();
        var href = (link.getAttribute("href") || "").toLowerCase();
        var text = (link.textContent || "").trim().toLowerCase();
        return (
          id.indexOf("restart") !== -1 ||
          href.indexOf("restart") !== -1 ||
          text.indexOf("restart login") !== -1
        );
      }) || null
    );
  }

  function run() {
    var passwordInput = doc.getElementById("password");
    var usernameInput = doc.getElementById("username");

    // Re-auth screen typically has only password field and a restart control.
    if (!passwordInput || usernameInput) {
      setPageHidden(false);
      return;
    }

    setPageHidden(true);
    var revealTimer = window.setTimeout(function () {
      setPageHidden(false);
    }, 900);

    var restartControl = findRestartControl();

    if (!restartControl) {
      window.clearTimeout(revealTimer);
      setPageHidden(false);
      return;
    }

    try {
      var guardKey = "timeline.kc.restart." + window.location.search;
      if (window.sessionStorage.getItem(guardKey) === "1") {
        window.clearTimeout(revealTimer);
        setPageHidden(false);
        return;
      }
      window.sessionStorage.setItem(guardKey, "1");
    } catch (_error) {
      // Ignore sessionStorage errors.
    }

    var href = restartControl.getAttribute("href");
    if (href) {
      window.location.replace(href);
      return;
    }

    restartControl.click();
  }

  run();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  }
})();
