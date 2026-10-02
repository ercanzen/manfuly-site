/* Man Fu Ly — shared site behaviour */
(function () {
  "use strict";

  /* ---------------------------------------------------------------
     Restaurant data — edit here
     day index: 0 = Sonntag … 6 = Samstag; times "HH:MM"
     --------------------------------------------------------------- */
  var MFL = (window.MFL = {
    whatsapp: "41795504481",
    phone: "+41325554808",
    phoneLabel: "032 555 48 08",
    email: "mann.fuly@gmail.com",
    address: "Bettlachstrasse 36, 2540 Grenchen",
    hours: {
      0: [["11:00", "14:00"], ["17:30", "22:00"]],
      1: [],
      2: [["11:00", "14:00"], ["17:30", "22:00"]],
      3: [["11:00", "14:00"], ["17:30", "22:00"]],
      4: [["11:00", "14:00"], ["17:30", "22:00"]],
      5: [["11:00", "14:00"], ["17:30", "22:00"]],
      6: [["11:00", "14:00"], ["17:30", "22:00"]],
    },
    dayNames: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
  });

  /* ---------- time helpers (Swiss local time) ---------- */
  /* Wall-clock time in Zurich as a local Date (fields only; works in any browser timezone) */
  var zurichFmt = null;
  try {
    zurichFmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Zurich",
      year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric",
      hourCycle: "h23",
    });
  } catch (e) {}
  function zurichNow() {
    var now = new Date();
    if (!zurichFmt || !zurichFmt.formatToParts) return now;
    try {
      var p = {};
      zurichFmt.formatToParts(now).forEach(function (x) { p[x.type] = x.value; });
      var d = new Date(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
      return isNaN(d.getTime()) ? now : d;
    } catch (e) {
      return now;
    }
  }
  function toMin(hhmm) {
    var p = hhmm.split(":");
    return +p[0] * 60 + +p[1];
  }
  function fmt(min) {
    var h = Math.floor(min / 60),
      m = min % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }
  MFL.zurichNow = zurichNow;
  MFL.toMin = toMin;
  MFL.fmt = fmt;

  /* Returns {open, until, next:{day, date, from}} for a given moment */
  MFL.status = function (now) {
    now = now || zurichNow();
    var day = now.getDay(),
      min = now.getHours() * 60 + now.getMinutes();
    var today = MFL.hours[day] || [];
    for (var i = 0; i < today.length; i++) {
      if (min >= toMin(today[i][0]) && min < toMin(today[i][1])) {
        return { open: true, until: today[i][1] };
      }
    }
    for (var d = 0; d < 8; d++) {
      var dd = (day + d) % 7,
        slots = MFL.hours[dd] || [];
      for (var j = 0; j < slots.length; j++) {
        if (d > 0 || toMin(slots[j][0]) > min) {
          var date = new Date(now);
          date.setDate(now.getDate() + d);
          return { open: false, next: { offset: d, day: dd, date: date, from: slots[j][0] } };
        }
      }
    }
    return { open: false };
  };

  MFL.statusText = function () {
    var s = MFL.status();
    if (s.open) return { open: true, text: "Jetzt geöffnet · bis " + s.until };
    if (!s.next) return { open: false, text: "Geschlossen" };
    var when =
      s.next.offset === 0 ? "heute" : s.next.offset === 1 ? "morgen" : MFL.dayNames[s.next.day];
    return { open: false, text: "Geschlossen · öffnet " + when + " " + s.next.from };
  };

  function renderStatus() {
    var st = MFL.statusText();
    document.querySelectorAll("[data-status]").forEach(function (el) {
      el.textContent = st.text;
      el.classList.toggle("is-open", st.open);
      el.classList.toggle("is-closed", !st.open);
    });
  }

  function renderHours() {
    var today = zurichNow().getDay();
    document.querySelectorAll("[data-hours]").forEach(function (tbl) {
      var order = [2, 3, 4, 5, 6, 0, 1];
      tbl.innerHTML =
        "<tbody>" +
        order
          .map(function (d) {
            var sl = MFL.hours[d] || [];
            var val = sl.length
              ? sl.map(function (s) { return s[0] + "–" + s[1]; }).join("<br>")
              : '<span class="closed">Ruhetag</span>';
            return (
              '<tr class="' + (d === today ? "is-today" : "") + '"><th scope="row">' +
              MFL.dayNames[d] + "</th><td>" + val + "</td></tr>"
            );
          })
          .join("") +
        "</tbody>";
    });
  }

  /* ---------- header: scrolled state + mobile menu ---------- */
  function header() {
    var h = document.querySelector(".header");
    if (h) {
      var onScroll = function () {
        h.classList.toggle("is-scrolled", window.scrollY > 8);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    var btn = document.querySelector(".menu-btn");
    var overlay = document.getElementById("overlay");
    if (!btn || !overlay) return;
    var behind = [".strip", "main", ".footer", ".header .brand"]
      .map(function (s) { return document.querySelector(s); })
      .filter(Boolean);
    function set(open) {
      document.body.classList.toggle("menu-open", open);
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? "Menü schliessen" : "Menü öffnen");
      overlay.setAttribute("aria-hidden", String(!open));
      // keep keyboard focus inside the menu while it is open
      behind.forEach(function (el) {
        if (open) el.setAttribute("inert", "");
        else el.removeAttribute("inert");
      });
      if (open) overlay.querySelector("a").focus();
    }
    // rotating a tablet past the breakpoint hides the button; never leave the menu stuck open
    var mq = window.matchMedia("(min-width: 900px)");
    var onMQ = function () {
      if (mq.matches && document.body.classList.contains("menu-open")) set(false);
    };
    if (mq.addEventListener) mq.addEventListener("change", onMQ);
    else if (mq.addListener) mq.addListener(onMQ);
    btn.addEventListener("click", function () {
      set(!document.body.classList.contains("menu-open"));
    });
    overlay.addEventListener("click", function (e) {
      if (e.target.closest("a")) set(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("menu-open")) {
        set(false);
        btn.focus();
      }
    });
  }

  /* ---------- reveal on scroll ---------- */
  function reveal() {
    var els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("is-in");
            io.unobserve(en.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- dish index: image follows the cursor ---------- */
  function indexPreview() {
    var list = document.querySelector("[data-index]");
    if (!list || !window.matchMedia("(hover: hover) and (min-width: 900px)").matches) return;
    var box = document.createElement("div");
    box.className = "index-preview";
    box.setAttribute("aria-hidden", "true");
    var img = null;
    document.body.appendChild(box);
    var x = 0, y = 0, tx = 0, ty = 0, raf = null;
    function loop() {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      box.style.left = x + "px";
      box.style.top = y + "px";
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(loop) : null;
    }
    list.querySelectorAll("a[data-img]").forEach(function (a) {
      a.addEventListener("mouseenter", function (e) {
        if (!img) {
          img = document.createElement("img");
          img.alt = "";
          box.appendChild(img);
        }
        img.src = a.dataset.img;
        x = tx = e.clientX + 170;
        y = ty = e.clientY;
        box.classList.add("is-on");
      });
      a.addEventListener("mousemove", function (e) {
        tx = e.clientX + 170;
        ty = e.clientY;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      a.addEventListener("mouseleave", function () {
        box.classList.remove("is-on");
      });
    });
  }

  /* ---------- map loads only after consent (privacy) ---------- */
  function maps() {
    document.querySelectorAll("[data-map]").forEach(function (m) {
      var b = m.querySelector("button");
      if (!b) return;
      b.addEventListener("click", function () {
        var f = document.createElement("iframe");
        f.title = "Karte: " + MFL.address;
        f.loading = "lazy";
        f.referrerPolicy = "no-referrer-when-downgrade";
        f.src =
          "https://maps.google.com/maps?q=" +
          encodeURIComponent("China Restaurant Man Fu Ly, " + MFL.address) +
          "&t=m&z=16&ie=UTF8&output=embed";
        f.tabIndex = 0;
        m.innerHTML = "";
        m.appendChild(f);
        f.focus();
      });
    });
  }

  /* ---------- toast ---------- */
  var toastEl, toastT;
  MFL.toast = function (msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("is-on"); }, 2200);
  };

  MFL.waLink = function (text) {
    return "https://wa.me/" + MFL.whatsapp + "?text=" + encodeURIComponent(text);
  };

  document.documentElement.classList.add("js");
  function init() {
    renderStatus();
    renderHours();
    header();
    reveal();
    indexPreview();
    maps();
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = zurichNow().getFullYear();
    });
    setInterval(renderStatus, 60000);
    requestAnimationFrame(function () {
      document.body.classList.add("is-loaded");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
