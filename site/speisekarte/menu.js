/* Speisekarte: renders window.MFL_MENU (menu-data.js) into the page */
(function () {
  "use strict";

  var MENU = window.MFL_MENU || [];
  var NOTE = window.MFL_MENU_NOTE || "";

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function slug(s) {
    return s
      .toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
  function price(p) {
    return p === 0 ? "Gratis" : p.toFixed(2);
  }
  function isSpicy(it) {
    return /scharf/i.test(it.name);
  }
  function isSweetSour(it) {
    return /süss-sauer|süß-sauer/i.test(it.name);
  }

  var total = MENU.reduce(function (n, c) { return n + c.items.length; }, 0);

  function itemHTML(it) {
    var tags = "";
    if (isSpicy(it)) tags += '<span class="mfl-tag mfl-tag--hot">scharf</span>';
    if (isSweetSour(it)) tags += '<span class="mfl-tag">süss-sauer</span>';
    var name = it.name.replace(/,?\s*scharf\b/i, "").replace(/\s+Scharf$/, "");
    return (
      '<li class="mfl-item' + (it.img ? " mfl-item--photo" : "") + '"' +
      ' data-search="' + esc((it.nr + " " + it.name + " " + (it.desc || "")).toLowerCase()) + '"' +
      ' data-hot="' + isSpicy(it) + '" data-ss="' + isSweetSour(it) + '">' +
      '<span class="mfl-item__nr">' + esc(it.nr) + "</span>" +
      '<span class="mfl-item__main">' +
      (it.img
        ? '<img class="mfl-item__img" src="' + esc(it.img) + '" alt="' + esc(it.name) + '" loading="lazy" width="550" height="440">'
        : "") +
      '<span class="mfl-item__body"><span class="mfl-item__name">' + esc(name) + "</span>" +
      (it.desc ? '<span class="mfl-item__desc">' + esc(it.desc) + "</span>" : "") +
      (tags ? '<span class="mfl-item__tags">' + tags + "</span>" : "") +
      "</span></span>" +
      '<span class="mfl-item__price">' + price(it.price) + "</span></li>"
    );
  }

  function build() {
    var featured = [];
    MENU.forEach(function (c) {
      c.items.forEach(function (it) {
        if (it.img && !featured.some(function (f) { return f.img === it.img; })) featured.push(it);
      });
    });

    var html =
      '<section id="mfl-menu" class="mfl-menu" aria-labelledby="mfl-menu-title">' +
      '<header class="mfl-menu__head">' +
      '<p class="mfl-menu__kicker">Man Fu Ly · Grenchen</p>' +
      '<h1 id="mfl-menu-title" class="mfl-menu__title">Speisekarte</h1>' +
      '<p class="mfl-menu__lead">' + total + " Gerichte aus der chinesischen Küche. Alle Preise in CHF.</p>" +
      "</header>" +
      '<div class="mfl-feature" role="list" aria-label="Beliebte Gerichte">' +
      featured.map(function (it) {
        return (
          '<figure class="mfl-feature__card" role="listitem">' +
          '<img src="' + esc(it.img) + '" alt="' + esc(it.name) + '" loading="lazy" width="550" height="440">' +
          '<figcaption><span class="mfl-feature__name">' + esc(it.nr) + ". " + esc(it.name.replace(/\s*\(.*\)$/, "")) + "</span>" +
          '<span class="mfl-feature__price">CHF ' + price(it.price) + "</span></figcaption></figure>"
        );
      }).join("") +
      "</div>" +
      '<div class="mfl-toolbar">' +
      '<div class="mfl-toolbar__row">' +
      '<label class="mfl-search"><span class="mfl-sr">Suche</span>' +
      '<input id="mfl-q" type="search" placeholder="Gericht suchen, z. B. Curry, Ente, 52" autocomplete="off"></label>' +
      '<button type="button" class="mfl-toggle" data-filter="hot" aria-pressed="false">Scharf</button>' +
      '<button type="button" class="mfl-toggle" data-filter="ss" aria-pressed="false">Süss-Sauer</button>' +
      "</div>" +
      '<nav class="mfl-chips" aria-label="Kategorien">' +
      MENU.map(function (c) {
        return '<button type="button" class="mfl-chip" data-target="k-' + slug(c.name) + '">' + esc(c.name) + "</button>";
      }).join("") +
      "</nav></div>" +
      '<div class="mfl-cats">' +
      MENU.map(function (c) {
        return (
          '<section class="mfl-cat" id="k-' + slug(c.name) + '">' +
          '<h2 class="mfl-cat__title">' + esc(c.name) + ' <span class="mfl-cat__count">' + c.items.length + "</span></h2>" +
          '<ol class="mfl-list">' + c.items.map(itemHTML).join("") + "</ol></section>"
        );
      }).join("") +
      '<p class="mfl-empty" hidden>Kein Gericht gefunden.</p>' +
      "</div>" +
      (NOTE ? '<p class="mfl-note"><strong>Hinweis</strong> ' + esc(NOTE) + "</p>" : "") +
      "</section>";

    var wrap = document.createElement("div");
    wrap.innerHTML = html;
    return wrap.firstChild;
  }

  function wire(root) {
    var q = root.querySelector("#mfl-q");
    var toggles = root.querySelectorAll(".mfl-toggle");
    var items = root.querySelectorAll(".mfl-item");
    var cats = root.querySelectorAll(".mfl-cat");
    var empty = root.querySelector(".mfl-empty");
    var feature = root.querySelector(".mfl-feature");
    var active = { hot: false, ss: false };

    function apply() {
      var term = q.value.trim().toLowerCase();
      var filtering = term || active.hot || active.ss;
      items.forEach(function (li) {
        var ok =
          (!term || li.dataset.search.indexOf(term) !== -1) &&
          (!active.hot || li.dataset.hot === "true") &&
          (!active.ss || li.dataset.ss === "true");
        li.hidden = !ok;
      });
      var any = false;
      cats.forEach(function (c) {
        var vis = c.querySelectorAll(".mfl-item:not([hidden])").length;
        c.hidden = vis === 0;
        if (vis) any = true;
      });
      empty.hidden = any;
      feature.hidden = !!filtering;
    }

    q.addEventListener("input", apply);
    toggles.forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.dataset.filter;
        active[k] = !active[k];
        b.setAttribute("aria-pressed", String(active[k]));
        apply();
      });
    });

    /* Category chips: smooth scroll below the sticky bars, highlight current */
    var chips = root.querySelectorAll(".mfl-chip");
    chips.forEach(function (a) {
      a.addEventListener("click", function () {
        var t = document.getElementById(a.dataset.target);
        if (!t) return;
        setTop();
        t.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            chips.forEach(function (a) {
              var on = a.dataset.target === en.target.id;
              a.classList.toggle("is-active", on);
              if (on && a.parentNode.scrollTo) {
                a.parentNode.scrollTo({ left: a.offsetLeft - 16, behavior: "smooth" });
              }
            });
          });
        },
        { rootMargin: "-40% 0px -55% 0px" }
      );
      cats.forEach(function (c) { io.observe(c); });
    }
  }

  function stickyOffset() {
    var h = document.querySelector(".block-header");
    if (!h) return 0;
    var el = h;
    while (el && el !== document.body) {
      var pos = getComputedStyle(el).position;
      if (pos === "sticky" || pos === "fixed") return Math.max(0, h.getBoundingClientRect().height);
      el = el.parentElement;
    }
    return 0;
  }

  /* Toolbar sticks under the site header; categories scroll to just below both */
  function setTop() {
    var root = document.getElementById("mfl-menu");
    if (!root) return;
    var top = stickyOffset();
    root.style.setProperty("--mfl-sticky-top", top + "px");
    root.style.setProperty("--mfl-bar-h", root.querySelector(".mfl-toolbar").offsetHeight + "px");
  }

  function mount() {
    if (document.getElementById("mfl-menu")) return true;
    var footer = document.querySelector("main section.block--footer");
    if (!footer) return false;
    var old = document.getElementById("zNLt-b");
    if (old) old.style.display = "none";
    var root = build();
    footer.parentNode.insertBefore(root, footer);
    wire(root);
    setTop();
    window.addEventListener("resize", setTop, { passive: true });
    window.addEventListener("scroll", setTop, { passive: true });
    return true;
  }

  /* The page body is a hydrated island; mount after hydration and re-mount if it re-renders */
  function start() {
    var island = document.querySelector('astro-island[component-url*="Page"]');
    var tries = 0;
    (function wait() {
      if ((!island || !island.hasAttribute("ssr") || tries > 40) && mount()) {
        new MutationObserver(function () {
          if (!document.getElementById("mfl-menu")) mount();
        }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
        return;
      }
      tries++;
      setTimeout(wait, 100);
    })();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
