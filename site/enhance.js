(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    /* Scroll progress bar */
    var bar = document.createElement("div");
    bar.id = "mfl-progress";
    document.body.appendChild(bar);
    function updateProgress() {
      var h = document.documentElement;
      var scrolled = h.scrollTop || document.body.scrollTop;
      var max = (h.scrollHeight || document.body.scrollHeight) - h.clientHeight;
      var pct = max > 0 ? (scrolled / max) * 100 : 0;
      bar.style.width = pct + "%";
    }
    document.addEventListener("scroll", updateProgress, { passive: true });
    updateProgress();

    /* Back-to-top button */
    var top = document.createElement("div");
    top.id = "mfl-top";
    top.setAttribute("role", "button");
    top.setAttribute("aria-label", "Nach oben scrollen");
    top.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M12 4l-8 8h5v8h6v-8h5z"/></svg>';
    document.body.appendChild(top);
    top.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    document.addEventListener(
      "scroll",
      function () {
        if (window.scrollY > 500) top.classList.add("mfl-show");
        else top.classList.remove("mfl-show");
      },
      { passive: true }
    );

    /* Scroll-reveal for content sections */
    var reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    var sections = document.querySelectorAll("main section");
    if (!reduceMotion && "IntersectionObserver" in window && sections.length) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("mfl-visible");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
      );
      sections.forEach(function (section, i) {
        section.classList.add("mfl-reveal");
        section.style.transitionDelay = Math.min(i * 60, 240) + "ms";
        io.observe(section);
      });
    }

    /* Tag large photos for cinematic hover-zoom (skip small icons/logos) */
    var imgs = document.querySelectorAll("main img");
    imgs.forEach(function (img) {
      function tag() {
        if (img.naturalWidth >= 220 && img.naturalHeight >= 160) {
          var parent = img.parentElement;
          if (parent && !parent.classList.contains("mfl-photo")) {
            parent.classList.add("mfl-photo");
          }
        }
      }
      if (img.complete) tag();
      else img.addEventListener("load", tag);
    });
  });
})();
