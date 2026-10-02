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
      '<button type="button" data-dec="' + nr + '" aria-label="Eins weniger">−</button>' +
      '<span aria-live="polite">' + q + "</span>" +
      '<button type="button" data-inc="' + nr + '" aria-label="Eins mehr">+</button></span>'
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
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  document.addEventListener("click", function (e) {
    var inc = e.target.closest("[data-inc]");
    var dec = e.target.closest("[data-dec]");
    if (inc) {
      var nr = inc.dataset.inc;
      var first = !cart[nr];
      sent = false;
      setQty(nr, (cart[nr] || 0) + 1);
      if (first) {
        MFL.toast(byNr[nr].name.replace(/,?\s*scharf$/i, "") + " hinzugefügt");
        // keep focus on the control that replaced the + button
        var again = byNr[nr].el.querySelector("[data-inc]");
        if (again && inc.closest(".dish")) again.focus();
      }
    } else if (dec) {
      var k = dec.dataset.dec;
      setQty(k, (cart[k] || 0) - 1);
      var still = byNr[k].el.querySelector("[data-dec]");
      if (still && dec.closest(".dish")) still.focus();
    }
  });

  /* open / close the sheet on small screens */
  function openCart(open) {
    cartEl.classList.toggle("is-open", open);
    scrim.hidden = !open;
    document.body.classList.toggle("cart-open", open);
    if (open) cartEl.querySelector(".cart__close").focus();
    else bar.focus();
  }
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

  function fillTimes() {
    var now = MFL.zurichNow();
    var minNow = now.getHours() * 60 + now.getMinutes();
    var opts = [];
    var dayLabel = function (offset, d) {
      if (offset === 0) return "Heute";
      if (offset === 1) return "Morgen";
      return MFL.dayNames[d.getDay()] + " " + d.getDate() + "." + (d.getMonth() + 1) + ".";
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
          opts.push({ label: dayLabel(off, d) + ", " + MFL.fmt(m), value: dayLabel(off, d) + " " + MFL.fmt(m), today: off === 0 });
        }
      });
    }
    var st = MFL.status(now);
    var html = "";
    if (st.open) {
      html += '<option value="So schnell wie möglich">So schnell wie möglich (ca. 20–30 Min.)</option>';
    }
    html += opts.map(function (o) {
      return '<option value="' + o.value + '">' + o.label + "</option>";
    }).join("");
    var prev = timeSel.value;
    timeSel.innerHTML = html;
    if (prev) timeSel.value = prev;
    timeHint.textContent = st.open
      ? "Gedämpfte Vorspeisen brauchen ca. 20 Min."
      : "Wir haben gerade geschlossen. Sie können für die nächste Öffnungszeit vorbestellen.";
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
    var data = {
      name: form.elements.name.value.trim(),
      tel: form.elements.tel.value.trim(),
      time: form.elements.time.value,
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
              var row = c.parentNode;
              row.scrollTo({ left: c.offsetLeft - row.offsetLeft - 8, behavior: "smooth" });
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
