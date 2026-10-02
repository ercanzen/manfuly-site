/* Reservierung: date/time picker → WhatsApp request */
(function () {
  "use strict";
  var MFL = window.MFL;
  var form = document.querySelector("[data-res-form]");
  if (!form) return;
  var date = form.elements.date;
  var time = form.elements.time;
  var hint = form.querySelector("[data-date-hint]");

  function iso(d) {
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function parse(v) {
    var p = v.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  var now = MFL.zurichNow();
  date.min = iso(now);
  var max = new Date(now);
  max.setDate(max.getDate() + 90);
  date.max = iso(max);

  /* default: next day that still has a free slot */
  function slotsFor(d) {
    var windows = MFL.hours[d.getDay()] || [];
    var out = [];
    var isToday = iso(d) === iso(MFL.zurichNow());
    var n = MFL.zurichNow();
    var nowMin = n.getHours() * 60 + n.getMinutes();
    windows.forEach(function (w) {
      // last table about an hour before the kitchen closes
      for (var m = MFL.toMin(w[0]); m <= MFL.toMin(w[1]) - 60; m += 30) {
        if (!isToday || m > nowMin + 60) out.push(MFL.fmt(m));
      }
    });
    return out;
  }
  for (var i = 0; i < 14; i++) {
    var d = new Date(now);
    d.setDate(now.getDate() + i);
    if (slotsFor(d).length) {
      date.value = iso(d);
      break;
    }
  }

  function fill() {
    if (!date.value) return;
    var d = parse(date.value);
    var slots = slotsFor(d);
    var prev = time.value;
    if (!slots.length) {
      time.innerHTML = '<option value="">Keine Zeiten verfügbar</option>';
      hint.textContent = (MFL.hours[d.getDay()] || []).length
        ? "Für heute sind keine Zeiten mehr frei. Bitte ein anderes Datum wählen."
        : MFL.dayNames[d.getDay()] + " ist Ruhetag. Bitte ein anderes Datum wählen.";
      date.setAttribute("aria-invalid", "true");
      return;
    }
    date.setAttribute("aria-invalid", "false");
    hint.textContent = MFL.dayNames[d.getDay()] + ", " + d.getDate() + "." + (d.getMonth() + 1) + "." + d.getFullYear();
    var lunch = slots.filter(function (s) { return MFL.toMin(s) < 15 * 60; });
    var dinner = slots.filter(function (s) { return MFL.toMin(s) >= 15 * 60; });
    var group = function (label, arr) {
      return arr.length
        ? '<optgroup label="' + label + '">' + arr.map(function (s) { return "<option>" + s + "</option>"; }).join("") + "</optgroup>"
        : "";
    };
    time.innerHTML = group("Mittag", lunch) + group("Abend", dinner);
    if (slots.indexOf(prev) !== -1) time.value = prev;
    else if (dinner.length) time.value = dinner[Math.min(2, dinner.length - 1)];
  }
  date.addEventListener("change", fill);
  fill();

  try {
    var c = JSON.parse(localStorage.getItem("mfl-contact") || "{}");
    if (c.name) form.elements.name.value = c.name;
    if (c.tel) form.elements.tel.value = c.tel;
  } catch (e) {}

  form.addEventListener("input", function (e) {
    if (e.target.getAttribute("aria-invalid") === "true" && e.target !== date) e.target.setAttribute("aria-invalid", "false");
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var ok = true;
    ["date", "time", "name", "tel"].forEach(function (n) {
      var f = form.elements[n];
      var bad = !f.value.trim() || (n === "tel" && f.value.replace(/\D/g, "").length < 9) ||
        (n === "date" && f.getAttribute("aria-invalid") === "true");
      f.setAttribute("aria-invalid", String(bad));
      if (bad && ok) {
        f.focus();
        ok = false;
      }
    });
    if (!ok) {
      MFL.toast("Bitte alle Pflichtfelder ausfüllen");
      return;
    }
    var d = parse(date.value);
    var lines = [
      "*Reservierungsanfrage · Man Fu Ly*",
      "",
      "Datum: " + MFL.dayNames[d.getDay()] + ", " + d.getDate() + "." + (d.getMonth() + 1) + "." + d.getFullYear(),
      "Uhrzeit: " + time.value,
      "Personen: " + form.elements.persons.value,
      "Name: " + form.elements.name.value.trim(),
      "Telefon: " + form.elements.tel.value.trim(),
    ];
    var note = form.elements.note.value.trim();
    if (note) lines.push("Bemerkung: " + note);
    try {
      localStorage.setItem("mfl-contact", JSON.stringify({ name: form.elements.name.value.trim(), tel: form.elements.tel.value.trim() }));
    } catch (err) {}
    var link = MFL.waLink(lines.join("\n"));
    var w = window.open(link, "_blank");
    if (!w) window.location.href = link;
    MFL.toast("WhatsApp geöffnet. Bitte Nachricht absenden.");
  });
})();
