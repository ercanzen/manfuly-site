/* Speisekarte: search, filters, cart and WhatsApp order */
(function () {
  "use strict";
  var MFL = window.MFL;
  var KEY = "mfl-cart-v1";

  var dishes = Array.prototype.slice.call(document.querySelectorAll(".dish"));
  var byNr = {};
  dishes.forEach(function (li) {
    byNr[li.dataset.key] = {
      key: li.dataset.key,
      nr: li.dataset.nr,
      name: li.dataset.name,
      price: parseFloat(li.dataset.price),
      el: li,
    };
  });

  /* ---------------- cart state ---------------- */
  var cart = load();
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "{}");
      var out = {};
      Object.keys(raw).forEach(function (k) {
        if (byNr[k] && raw[k] > 0) out[k] = Math.min(99, raw[k] | 0);
      });
      return out;
    } catch (e) {
      return {};
    }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(cart));
    } catch (e) {}
  }
  function setQty(nr, q) {
    if (q <= 0) delete cart[nr];
    else cart[nr] = Math.min(99, q);
    save();
    render();
  }
  function count() {
    return Object.keys(cart).reduce(function (n, k) { return n + cart[k]; }, 0);
  }
  function total() {
    return Object.keys(cart).reduce(function (s, k) { return s + cart[k] * byNr[k].price; }, 0);
  }
  function chf(n) {
    return "CHF " + n.toFixed(2);
  }

  /* ---------------- dish row controls ---------------- */
  function qtyHTML(nr, q, label) {
    return (
      '<span class="qty" role="group" aria-label="Menge ' + label + '">' +
      '<button type="button" data-dec="' + nr + '" aria-label="' + label + ': eins weniger">−</button>' +
      "<span>" + q + "</span>" +
      '<button type="button" data-inc="' + nr + '" aria-label="' + label + ': eins mehr">+</button></span>'
    );
  }
  function shortName(d) {
    return d.name.replace(/"/g, "");
  }
  function renderRow(d) {
    var slot = d.el.querySelector("[data-act]");
    var q = cart[d.key] || 0;
    var want = q ? "q" + q : "add";
    if (slot.dataset.state === want) return;
    slot.dataset.state = want;
    slot.innerHTML = q
      ? qtyHTML(d.key, q, shortName(d))
      : '<button type="button" class="add" data-inc="' + d.key + '" aria-label="' + shortName(d) + ' hinzufügen">+</button>';
  }

  /* ---------------- cart panel ---------------- */
  var cartEl = document.getElementById("cart");
  var itemsEl = cartEl.querySelector("[data-cart-items]");
  var emptyEl = cartEl.querySelector("[data-cart-empty]");
  var totalBox = cartEl.querySelector("[data-cart-total]");
  var form = cartEl.querySelector("[data-order-form]");
  var sentEl = cartEl.querySelector("[data-cart-sent]");
  var bar = document.querySelector(".cart-bar");
  var scrim = document.querySelector(".scrim");
  var sent = false;

  function render() {
    dishes.forEach(function (li) { renderRow(byNr[li.dataset.key]); });
    var keys = Object.keys(cart);
    // keep menu order in the cart
    keys.sort(function (a, b) { return dishes.indexOf(byNr[a].el) - dishes.indexOf(byNr[b].el); });
    itemsEl.innerHTML = keys
      .map(function (k) {
        var d = byNr[k];
        return (
          '<li class="cart__item"><span class="cart__item-name"><small>' + d.nr + ".</small>" +
          escapeHTML(d.name) + '</span><span class="cart__item-price num">' +
          (d.price ? (cart[k] * d.price).toFixed(2) : "Gratis") + "</span>" +
          qtyHTML(k, cart[k], escapeHTML(d.name)) + "</li>"
        );
      })
      .join("");
    var n = count(), t = total();
    emptyEl.hidden = n > 0 || sent;
    itemsEl.hidden = n === 0 || sent;
    totalBox.hidden = n === 0 || sent;
    form.hidden = n === 0 || sent;
    sentEl.hidden = !sent;
    document.querySelectorAll("[data-total]").forEach(function (el) { el.textContent = chf(t); });
    document.querySelectorAll("[data-count]").forEach(function (el) { el.textContent = n; });
    bar.hidden = n === 0 && !sent;
    live.textContent = n ? "Warenkorb: " + n + (n === 1 ? " Artikel, " : " Artikel, ") + chf(t) : "Warenkorb ist leer";
  }

  /* one polite live region for cart changes (screen readers) */
  var live = document.createElement("div");
  live.className = "sr-only";
  live.setAttribute("aria-live", "polite");
  document.body.appendChild(live);

  function escapeHTML(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* Re-rendering replaces the buttons, so put keyboard focus back where it was */
  function refocus(key, kind, inCart, index) {
    var sel = "[data-" + kind + '="' + key + '"]';
    var target;
    if (inCart) {
      target = itemsEl.querySelector(sel);
      if (!target) {
        var rest = itemsEl.querySelectorAll("[data-inc]");
        target = rest[Math.min(index, rest.length - 1)] || cartEl.querySelector(".cart__close:not([hidden])") || form.elements.name;
        if (target && !target.offsetParent) target = document.getElementById("q");
      }
    } else {
      target = byNr[key].el.querySelector(sel) || byNr[key].el.querySelector("[data-inc]");
    }
    if (target) target.focus();
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-inc], [data-dec]");
    if (!btn) return;
    var kind = btn.hasAttribute("data-inc") ? "inc" : "dec";
    var key = btn.dataset[kind];
    if (!byNr[key]) return;
    var inCart = !!btn.closest("[data-cart-items]");
    var index = inCart ? Array.prototype.indexOf.call(itemsEl.children, btn.closest("li")) : 0;
    var hadFocus = document.activeElement === btn;
    if (kind === "inc") {
      var first = !cart[key];
      sent = false;
      setQty(key, (cart[key] || 0) + 1);
      if (first) MFL.toast(byNr[key].name.replace(/,\s*scharf$/i, "") + " hinzugefügt");
    } else {
      setQty(key, (cart[key] || 0) - 1);
    }
    if (hadFocus || e.detail === 0) refocus(key, kind, inCart, index);
  });

  /* open / close the sheet on small screens */
  var sheetMQ = window.matchMedia("(max-width: 1099px)");
  function behind() {
    // everything except the cart sheet itself
    var list = [".strip", ".header", ".page-head", ".toolbar", ".menu-list", ".cart-bar", ".footer"];
    return list.map(function (s) { return document.querySelector(s); }).filter(Boolean);
  }
  function openCart(open) {
    cartEl.classList.toggle("is-open", open);
    scrim.hidden = !open;
    document.body.classList.toggle("cart-open", open);
    if (open) {
      cartEl.setAttribute("role", "dialog");
      cartEl.setAttribute("aria-modal", "true");
    } else {
      cartEl.removeAttribute("role");
      cartEl.removeAttribute("aria-modal");
    }
    behind().forEach(function (el) {
      if (open) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    });
    if (open) cartEl.querySelector(".cart__close").focus();
    else if (!bar.hidden) bar.focus();
    else document.getElementById("q").focus();
  }
  // leaving the small-screen layout while the sheet is open must not leave the page inert
  var onMQ = function () {
    if (!sheetMQ.matches && cartEl.classList.contains("is-open")) openCart(false);
  };
  if (sheetMQ.addEventListener) sheetMQ.addEventListener("change", onMQ);
  else if (sheetMQ.addListener) sheetMQ.addListener(onMQ);
  bar.addEventListener("click", function () { openCart(true); });
  document.querySelectorAll("[data-cart-close]").forEach(function (b) {
    b.addEventListener("click", function () { openCart(false); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && cartEl.classList.contains("is-open")) openCart(false);
  });

  /* ---------------- pickup times ---------------- */
  var timeSel = form.querySelector("#o-time");
  var timeHint = form.querySelector("[data-time-hint]");
  var LEAD = 25; // minutes kitchen needs at least

  var lastTimesHTML = "";
  function fillTimes() {
    var now = MFL.zurichNow();
    var minNow = now.getHours() * 60 + now.getMinutes();
    var opts = [];
    var short = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    var dayLabel = function (offset, d) {
      var date = short[d.getDay()] + " " + d.getDate() + "." + (d.getMonth() + 1) + ".";
      if (offset === 0) return "Heute, " + date;
      if (offset === 1) return "Morgen, " + date;
      return date;
    };
    // look up to 7 days ahead, collect slots of the first day that still has any
    for (var off = 0; off < 7 && !opts.length; off++) {
      var d = new Date(now);
      d.setDate(now.getDate() + off);
      var windows = MFL.hours[d.getDay()] || [];
      windows.forEach(function (w) {
        var from = MFL.toMin(w[0]) + 15, to = MFL.toMin(w[1]) - 15;
        var start = off === 0 ? Math.max(from, Math.ceil((minNow + LEAD) / 15) * 15) : from;
        for (var m = start; m <= to; m += 15) {
          opts.push({ label: dayLabel(off, d) + ", " + MFL.fmt(m), value: dayLabel(off, d) + ", " + MFL.fmt(m) + " Uhr" });
        }
      });
    }
    var st = MFL.status(now);
    // "as soon as possible" only while the kitchen can still finish before closing
    var asap = st.open && minNow + LEAD <= MFL.toMin(st.until);
    var html = "";
    if (asap) {
      html += '<option value="So schnell wie möglich">So schnell wie möglich (ca. 20–30 Min.)</option>';
    }
    html += opts.map(function (o) {
      return '<option value="' + o.value + '">' + o.label + "</option>";
    }).join("");
    if (!html) html = '<option value="">Zurzeit keine Abholzeit verfügbar</option>';
    var hint = asap
      ? "Gedämpfte Vorspeisen brauchen ca. 20 Min."
      : st.open
        ? "Für heute ist keine Abholung mehr möglich. Sie können für die nächste Öffnungszeit vorbestellen."
        : "Momentan geschlossen. Sie können für die nächste Öffnungszeit vorbestellen.";
    // rebuilding an open <select> closes it on Android, so only touch it when something changed
    if (html !== lastTimesHTML) {
      var prev = timeSel.value;
      lastTimesHTML = html;
      timeSel.innerHTML = html;
      if (prev) {
        timeSel.value = prev;
        if (timeSel.value !== prev) hint = "Die gewählte Zeit ist nicht mehr verfügbar. Bitte eine neue Abholzeit wählen.";
      }
    }
    timeHint.textContent = hint;
  }

  /* ---------------- submit → WhatsApp ---------------- */
  function openWA(link) {
    var w = window.open(link, "_blank");
    if (!w) window.location.href = link;
  }
  var lastLink = "";
  function orderNo() {
    var d = MFL.zurichNow();
    return (
      ("0" + d.getDate()).slice(-2) + ("0" + (d.getMonth() + 1)).slice(-2) + "-" +
      Math.floor(1000 + Math.random() * 9000)
    );
  }
  function message(data) {
    var lines = ["*Neue Bestellung · Man Fu Ly*", "Nr. " + orderNo(), ""];
    Object.keys(cart)
      .sort(function (a, b) { return dishes.indexOf(byNr[a].el) - dishes.indexOf(byNr[b].el); })
      .forEach(function (k) {
        var d = byNr[k];
        lines.push(cart[k] + "× " + d.nr + ". " + d.name + "  " + (d.price ? chf(cart[k] * d.price) : "Gratis"));
      });
    lines.push("", "*Total: " + chf(total()) + "*", "");
    lines.push("Abholung: " + data.time);
    lines.push("Name: " + data.name);
    lines.push("Telefon: " + data.tel);
    if (data.note) lines.push("Bemerkung: " + data.note);
    lines.push("", "Bezahlung bei Abholung.");
    return lines.join("\n");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (total() === 0) {
      MFL.toast("Reis ist eine Beilage. Bitte noch ein Gericht wählen.");
      return;
    }
    var ok = true;
    ["name", "tel", "time"].forEach(function (n) {
      var f = form.elements[n];
      var bad = !f.value.trim() || (n === "tel" && f.value.replace(/\D/g, "").length < 9);
      f.setAttribute("aria-invalid", String(bad));
      if (bad && ok) {
        f.focus();
        ok = false;
      }
    });
    if (!ok) {
      MFL.toast("Bitte Name, Telefon und Abholzeit angeben");
      return;
    }
    var time = form.elements.time.value;
    if (time === "So schnell wie möglich") {
      var n = MFL.zurichNow();
      time += " (bestellt " + n.getDate() + "." + (n.getMonth() + 1) + ". um " + MFL.fmt(n.getHours() * 60 + n.getMinutes()) + " Uhr)";
    }
    var data = {
      name: form.elements.name.value.trim(),
      tel: form.elements.tel.value.trim(),
      time: time,
      note: form.elements.note.value.trim(),
    };
    try {
      localStorage.setItem("mfl-contact", JSON.stringify({ name: data.name, tel: data.tel }));
    } catch (err) {}
    lastLink = MFL.waLink(message(data));
    sent = true;
    render();
    openWA(lastLink);
  });
  form.addEventListener("input", function (e) {
    if (e.target.getAttribute("aria-invalid") === "true") e.target.setAttribute("aria-invalid", "false");
  });
  sentEl.querySelector("[data-wa-again]").addEventListener("click", function (e) {
    e.preventDefault();
    if (lastLink) openWA(lastLink);
  });
  sentEl.querySelector("[data-cart-clear]").addEventListener("click", function () {
    cart = {};
    sent = false;
    save();
    render();
    fillTimes();
  });

  try {
    var c = JSON.parse(localStorage.getItem("mfl-contact") || "{}");
    if (c.name) form.elements.name.value = c.name;
    if (c.tel) form.elements.tel.value = c.tel;
  } catch (e) {}

  /* ---------------- search + filters ---------------- */
  var q = document.getElementById("q");
  var toggles = document.querySelectorAll(".toggle");
  var cats = document.querySelectorAll(".cat");
  var empty = document.querySelector(".empty");
  var active = { hot: false, ss: false };

  function norm(s) {
    return s.toLowerCase().replace(/ß/g, "ss").normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  dishes.forEach(function (li) { li.dataset.norm = norm(li.dataset.search); });

  function apply() {
    var term = norm(q.value.trim());
    dishes.forEach(function (li) {
      li.hidden = !(
        (!term || li.dataset.norm.indexOf(term) !== -1) &&
        (!active.hot || li.dataset.hot === "true") &&
        (!active.ss || li.dataset.ss === "true")
      );
    });
    var any = false;
    cats.forEach(function (c) {
      var vis = c.querySelector(".dish:not([hidden])");
      c.hidden = !vis;
      if (vis) any = true;
    });
    empty.hidden = any;
  }
  q.addEventListener("input", apply);
  toggles.forEach(function (b) {
    b.addEventListener("click", function () {
      active[b.dataset.filter] = !active[b.dataset.filter];
      b.setAttribute("aria-pressed", String(active[b.dataset.filter]));
      apply();
    });
  });
  document.querySelector("[data-reset]").addEventListener("click", function () {
    q.value = "";
    active = { hot: false, ss: false };
    toggles.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
    apply();
    q.focus();
  });

  /* ---------------- category chips ---------------- */
  var toolbar = document.getElementById("toolbar");
  function setBarH() {
    document.documentElement.style.setProperty("--toolbar-h", toolbar.offsetHeight + "px");
  }
  setBarH();
  window.addEventListener("resize", setBarH, { passive: true });

  var chips = document.querySelectorAll(".chip");
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      var t = document.getElementById(c.dataset.target);
      if (t && !t.hidden) t.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          chips.forEach(function (c) {
            var on = c.dataset.target === en.target.id;
            c.classList.toggle("is-active", on);
            if (on) {
              // only scroll the chip row when the active chip is out of view
              var row = c.parentNode;
              var left = c.offsetLeft - row.offsetLeft;
              if (left < row.scrollLeft || left + c.offsetWidth > row.scrollLeft + row.clientWidth) {
                row.scrollTo({ left: Math.max(0, left - 16), behavior: "smooth" });
              }
            }
          });
        });
      },
      { rootMargin: "-35% 0px -60% 0px" }
    );
    cats.forEach(function (c) { io.observe(c); });
  }

  /* highlight a dish when arriving via #g-52 */
  function highlight() {
    var id = location.hash.slice(1);
    var el = id && document.getElementById(id);
    if (el && el.classList.contains("dish")) {
      el.classList.add("is-target");
      setTimeout(function () { el.classList.remove("is-target"); }, 2400);
    }
  }
  window.addEventListener("hashchange", highlight);

  fillTimes();
  setInterval(fillTimes, 60000);
  render();
  highlight();
})();
