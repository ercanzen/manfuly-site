"""Build the static Man Fu Ly site.

Usage:  python tools/build.py            (writes into site-new/ by default)
        python tools/build.py site       (writes into site/)

Source of truth for dishes and prices: content/menu.json
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "site-new")
MENU = json.loads((ROOT / "content" / "menu.json").read_text(encoding="utf-8"))

SITE = "https://www.manfuly.ch"
PHONE = "+41325554808"
PHONE_LABEL = "032 555 48 08"
EMAIL = "mann.fuly@gmail.com"
WHATSAPP = "41795504481"
WHATSAPP_LABEL = "079 550 44 81"
STREET = "Bettlachstrasse 36"
CITY = "2540 Grenchen"
VERSION = "3"

e = html.escape

# Full-bleed background: poster image first (fast), video swapped in by main.js when visible.
# The clip is a camera move over the restaurant's own table photo (tools/render_video.py).
def film_bg(eager=True):
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    return f"""<div class="film__bg" aria-hidden="true">
    <picture>
      <source media="(max-aspect-ratio: 4/5)" srcset="/assets/video/kueche-hoch.jpg">
      <img class="film__poster" src="/assets/video/kueche-1600.jpg" alt="" width="1600" height="900" {load}>
    </picture>
    <video class="bgvid" muted loop playsinline preload="none" data-src="/assets/video/kueche-1600.mp4" data-src-portrait="/assets/video/kueche-hoch.mp4"></video>
    <span class="film__scrim"></span>
  </div>"""


PRELOAD_FILM = (
    '\n<link rel="preload" as="image" href="/assets/video/kueche-1600.jpg" media="(min-aspect-ratio: 4/5)" fetchpriority="high">'
    '\n<link rel="preload" as="image" href="/assets/video/kueche-hoch.jpg" media="(max-aspect-ratio: 4/5)" fetchpriority="high">'
)


VIDEO_TOGGLE = (
    '<button type="button" class="vid-toggle" data-video-toggle aria-pressed="false">'
    '<span class="vid-toggle__ico" aria-hidden="true"></span><span class="vid-toggle__txt">Video anhalten</span></button>'
)


def film_head(meta, title_html, aside):
    return f"""<section class="film film--page" aria-labelledby="page-title">
  {film_bg()}
  <div class="wrap film__inner">
    <div class="film__text">
      <span class="meta">{meta}</span>
      <h1 class="display" id="page-title">{title_html}</h1>
      <p class="lead">{aside}</p>
    </div>
    <div class="film__foot meta"><span class="status" data-status>Öffnungszeiten</span>{VIDEO_TOGGLE}</div>
  </div>
</section>"""


# Rendered into the HTML so hours are visible without JavaScript; main.js re-renders and marks today.
_DAYS = ["Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
HOURS_TABLE = (
    '<table class="hours" data-hours><tbody>'
    + "".join(f'<tr><th scope="row">{d}</th><td>11:00–14:00<br>17:30–22:00</td></tr>' for d in _DAYS)
    + '<tr><th scope="row">Montag</th><td><span class="closed">Ruhetag</span></td></tr></tbody></table>'
)


def slug(s):
    s = s.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("à", "a")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def chf(p):
    return "Gratis" if p == 0 else f"{p:.2f}"


def is_hot(name):
    return bool(re.search(r"scharf", name, re.I))


def is_sweetsour(name):
    return bool(re.search(r"süss-sauer", name, re.I))


def clean_name(name):
    """Drop a trailing ', scharf' since it is shown as a tag instead."""
    return re.sub(r",\s*scharf\b", "", name, flags=re.I).strip()


ALL_ITEMS = [(c["name"], it) for c in MENU["categories"] for it in c["items"]]
TOTAL = len(ALL_ITEMS)

# Some numbers appear twice on the printed menu (6 in two sizes, 84 twice).
# Every dish gets a unique key for anchors and the cart.
_seen, _count = {}, {}
for _, _it in ALL_ITEMS:
    _seen[_it["nr"]] = _seen.get(_it["nr"], 0) + 1
for _, _it in ALL_ITEMS:
    if _seen[_it["nr"]] > 1:
        _count[_it["nr"]] = _count.get(_it["nr"], 0) + 1
        _it["key"] = f"{_it['nr']}-{_count[_it['nr']]}"
    else:
        _it["key"] = _it["nr"]


def find(nr):
    for cat, it in ALL_ITEMS:
        if it["nr"] == nr:
            return cat, it
    raise KeyError(nr)


# ---------------------------------------------------------------- layout

NAV = [("/speisekarte/", "Speisekarte"), ("/reservierung/", "Reservierung"), ("/kontakt/", "Kontakt")]


def head(title, desc, path, extra_css="", jsonld=None):
    url = SITE + path
    ld = ""
    if jsonld:
        ld = '<script type="application/ld+json">' + json.dumps(jsonld, ensure_ascii=False) + "</script>"
    return f"""<!doctype html>
<html lang="de-CH">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<meta name="theme-color" content="#f5efe4">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Man Fu Ly">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}/assets/img/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="de_CH">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/fraunces.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/instrument-sans.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/main.css?v={VERSION}">{extra_css}
{ld}
</head>
"""


def header(path):
    links = "".join(
        f'<a href="{h}"' + (' aria-current="page"' if path == h else "") + f">{t}</a>" for h, t in NAV
    )
    over = "".join(f'<a href="{h}">{t}</a>' for h, t in [("/", "Startseite")] + NAV)
    return f"""<body>
<a class="skip" href="#main">Zum Inhalt springen</a>
<div class="strip">
  <div class="wrap strip__inner">
    <span class="status" data-status>Öffnungszeiten</span>
    <span class="strip__addr">{STREET}, {CITY}</span>
    <a href="tel:{PHONE}" class="num strip__phone">{PHONE_LABEL}</a>
  </div>
</div>
<header class="header">
  <div class="wrap header__inner">
    <a class="brand" href="/" aria-label="Man Fu Ly, zur Startseite">
      <img src="/assets/brand/logo.svg" alt="Man Fu Ly China-Restaurant Grenchen" width="356" height="120">
      <img class="brand__inv" src="/assets/brand/logo-invers.svg" alt="" width="356" height="120">
    </a>
    <nav class="nav" aria-label="Hauptnavigation">{links}</nav>
    <a class="btn header__cta" href="/speisekarte/">Online bestellen</a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="overlay" aria-label="Menü öffnen"><span></span><span></span></button>
  </div>
</header>
<div class="overlay" id="overlay" aria-hidden="true">
  <nav aria-label="Mobile Navigation">{over}</nav>
  <div class="overlay__foot">
    <span class="status" data-status></span>
    <a href="tel:{PHONE}">{PHONE_LABEL}</a>
    <span>{STREET}, {CITY}</span>
  </div>
</div>
"""


def footer(extra_js=""):
    return f"""<footer class="footer">
  <div class="wrap">
    <div class="grid footer__top">
      <div class="footer__seal"><img src="/assets/brand/seal.svg" alt="" width="200" height="200"></div>
      <div class="footer__col">
        <span class="meta">Adresse</span>
        <span>China-Restaurant Man Fu Ly</span>
        <span>{STREET}</span>
        <span>{CITY}</span>
      </div>
      <div class="footer__col">
        <span class="meta">Kontakt</span>
        <a href="tel:{PHONE}">{PHONE_LABEL}</a>
        <a href="https://wa.me/{WHATSAPP}">WhatsApp {WHATSAPP_LABEL}</a>
        <a href="mailto:{EMAIL}">{EMAIL}</a>
      </div>
      <div class="footer__col">
        <span class="meta">Seiten</span>
        <a href="/speisekarte/">Speisekarte &amp; Bestellung</a>
        <a href="/reservierung/">Tisch reservieren</a>
        <a href="/kontakt/">Kontakt &amp; Anfahrt</a>
      </div>
    </div>
    <div class="footer__base">
      <span>© <span data-year>2026</span> China-Restaurant Man Fu Ly, Grenchen</span>
      <span><a href="/impressum/">Impressum &amp; Datenschutz</a></span>
    </div>
  </div>
</footer>
<script src="/assets/js/main.js?v={VERSION}"></script>{extra_js}
</body>
</html>
"""


RESTAURANT_LD = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "name": "China-Restaurant Man Fu Ly",
    "url": SITE + "/",
    "image": SITE + "/assets/img/og.jpg",
    "logo": SITE + "/assets/brand/seal.svg",
    "telephone": PHONE,
    "email": EMAIL,
    "servesCuisine": ["Chinesisch", "Kantonesisch"],
    "priceRange": "CHF 15–25",
    "address": {
        "@type": "PostalAddress",
        "streetAddress": STREET,
        "postalCode": "2540",
        "addressLocality": "Grenchen",
        "addressRegion": "SO",
        "addressCountry": "CH",
    },
    "openingHoursSpecification": [
        {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            "opens": o,
            "closes": c,
        }
        for o, c in [("11:00", "14:00"), ("17:30", "22:00")]
    ],
    "hasMenu": SITE + "/speisekarte/",
    "acceptsReservations": "True",
}


def write(rel, content):
    p = OUT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8", newline="\n")


# ---------------------------------------------------------------- pages

def page_home():
    featured = ["64", "7", "52", "56", "26", "8"]
    rows = []
    for nr in featured:
        cat, it = find(nr)
        rows.append(
            f"""<li class="index__row"><a href="/speisekarte/#g-{slug(it['key'])}" data-img="{it['img']}">
  <img class="index__thumb" src="{it['img']}" alt="" width="550" height="440" loading="lazy">
  <span class="index__nr num">Nr. {e(it['nr'])}</span>
  <span class="index__name">{e(clean_name(it['name']))}</span>
  <span class="index__cat">{e(cat)}</span>
  <span class="index__price num">CHF {chf(it['price'])}</span>
</a></li>"""
        )
    words = [
        "Siu Mai", "Jiao Zi", "Ente süss-sauer", "Szechuan", "Kun Po", "Frühlingsrolle",
        "Gebratene Nudeln", "Rotes Curry", "Sate", "Juan Bing", "Krevetten", "Zitronensauce",
    ]
    marquee = "".join(f"<span>{w}</span>" for w in words) * 2
    return (
        head(
            "Man Fu Ly · China-Restaurant in Grenchen",
            "Chinesische Küche aus Wok und Bambuskorb an der Bettlachstrasse 36 in Grenchen. "
            "Speisekarte mit 100 Gerichten, online bestellen per WhatsApp und Tisch reservieren.",
            "/",
            extra_css=PRELOAD_FILM,
            jsonld=RESTAURANT_LD,
        )
        + header("/")
        + f"""<main id="main">
<section class="film" aria-labelledby="hero-title">
  {film_bg("Kamerafahrt über einen gedeckten Tisch: Ente, Siu Mai, gebratene Nudeln, gebackenes Poulet und gebratener Reis")}
  <div class="wrap film__inner">
    <div class="film__text">
      <span class="meta">China-Restaurant in Grenchen</span>
      <h1 class="film__title" id="hero-title">Chinesische Küche aus Wok und <em>Bambuskorb.</em></h1>
      <p class="lead">Im Restaurant an der Bettlachstrasse 36 oder zum Mitnehmen. Online bestellen und frisch zubereitet abholen.</p>
      <div class="hero__actions">
        <a class="btn" href="/speisekarte/">Online bestellen</a>
        <a class="link" href="/reservierung/">Tisch reservieren <span class="arrow" aria-hidden="true">→</span></a>
      </div>
    </div>
    <div class="film__foot meta">
      <span class="status" data-status>Öffnungszeiten</span>
      <span>{STREET}, Grenchen</span>
      {VIDEO_TOGGLE}
    </div>
  </div>
</section>

<div class="marquee" aria-hidden="true"><div class="marquee__track">{marquee}</div></div>

<section class="section wrap" aria-labelledby="klassiker">
  <div class="grid section__head reveal">
    <span class="meta">Aus der Küche</span>
    <h2 class="h2" id="klassiker">Ein paar <em>Klassiker</em></h2>
    <div class="section__aside"><a class="link" href="/speisekarte/">Ganze Speisekarte <span class="arrow" aria-hidden="true">→</span></a></div>
  </div>
  <ul class="index reveal" data-index>
    {''.join(rows)}
  </ul>
  <div class="index-more">
    <span class="meta">Preise in CHF</span>
    <a class="link" href="/speisekarte/">Alle {TOTAL} Gerichte ansehen und bestellen <span class="arrow" aria-hidden="true">→</span></a>
  </div>
</section>

<section class="section wrap" aria-labelledby="dimsum">
  <div class="grid split">
    <div class="split__quote reveal">
      <span class="meta" id="dimsum">Dim Sum</span>
      <blockquote><p style="margin:14px 0 0">Dim Sum braucht <em>Zeit.</em> Rund zwanzig Minuten, um genau zu sein.</p></blockquote>
      <p class="lead">Siu Mai und Jiao Zi kommen frisch aus dem Bambuskorb. Rechnen Sie bei gedämpften Vorspeisen mit etwa 20 Minuten Wartezeit.</p>
      <p><a class="link" href="/speisekarte/#k-vorspeisen">Vorspeisen ansehen <span class="arrow" aria-hidden="true">→</span></a></p>
    </div>
    <div class="split__media">
      <figure class="reveal steamy">
        <img src="/assets/img/menu/siu-mai.jpg" alt="Gedämpfte Siu Mai im Bambuskorb mit Chilisauce" width="550" height="440" loading="lazy">
        <span class="steam" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <figcaption class="caption"><span>Nr. 7 · Gedämpfte Siu Mai</span><span class="num">CHF {chf(find('7')[1]['price'])}</span></figcaption>
      </figure>
      <figure class="reveal steamy">
        <img src="/assets/img/menu/jiao-zi.jpg" alt="Gedämpfte Jiao Zi im Bambuskorb" width="550" height="440" loading="lazy">
        <span class="steam steam--late" aria-hidden="true"><i></i><i></i><i></i></span>
        <figcaption class="caption"><span>Nr. 8 · Gedämpfte Jiao Zi</span><span class="num">CHF {chf(find('8')[1]['price'])}</span></figcaption>
      </figure>
    </div>
  </div>
</section>

<section class="dark dark--film" aria-labelledby="bestellen">
  <div class="dark__bg" aria-hidden="true">
    <video class="bgvid" muted loop playsinline preload="none" poster="/assets/video/kueche-unscharf.jpg" data-src="/assets/video/kueche-unscharf.mp4"></video>
  </div>
  <div class="wrap">
    <span class="meta">Bestellen zum Abholen</span>
    <h2 class="h2" id="bestellen" style="margin-top:14px">Bestellt in drei <em>Schritten.</em></h2>
    <ol class="steps">
      <li class="reveal"><span class="steps__nr num">01</span><h3>Auswählen</h3><p>Gerichte aus der Speisekarte in den Warenkorb legen.</p></li>
      <li class="reveal"><span class="steps__nr num">02</span><h3>Per WhatsApp senden</h3><p>Name, Telefon und Abholzeit eintragen. Die Bestellung geht als Nachricht direkt an uns.</p></li>
      <li class="reveal"><span class="steps__nr num">03</span><h3>Abholen</h3><p>Wir bestätigen per WhatsApp. Bezahlt wird bei der Abholung im Restaurant.</p></li>
    </ol>
    <div class="hero__actions">
      <a class="btn" href="/speisekarte/">Jetzt bestellen</a>
      <a class="btn btn--ghost" href="tel:{PHONE}">Lieber anrufen: {PHONE_LABEL}</a>
    </div>
  </div>
</section>

<figure class="band" aria-label="Gebackenes Poulet, gebratene Nudeln und Frühlingsrollen auf dem Tisch">
  <img class="band__img" src="/assets/img/band-1600.jpg" srcset="/assets/img/band-900.jpg 900w, /assets/img/band-1600.jpg 1600w" sizes="100vw" alt="" width="1600" height="900" loading="lazy" data-parallax>
  <figcaption class="wrap band__cap"><span class="band__line">Frisch aus dem Wok,<br><em>jeden Tag ausser Montag.</em></span></figcaption>
</figure>

<section class="section wrap" aria-labelledby="besuch">
  <div class="grid section__head reveal">
    <span class="meta">Besuch</span>
    <h2 class="h2" id="besuch">Bettlachstrasse <em>36</em></h2>
  </div>
  <div class="grid visit">
    <div class="visit__info reveal">
      <span class="meta">Öffnungszeiten</span>
      {HOURS_TABLE}
      <dl class="contact-list">
        <div><dt class="meta">Telefon</dt><dd><a href="tel:{PHONE}" class="num">{PHONE_LABEL}</a></dd></div>
        <div><dt class="meta">WhatsApp</dt><dd><a href="https://wa.me/{WHATSAPP}" class="num">{WHATSAPP_LABEL}</a></dd></div>
        <div><dt class="meta">E-Mail</dt><dd><a href="mailto:{EMAIL}">{EMAIL}</a></dd></div>
      </dl>
    </div>
    <div class="visit__map reveal">
      {map_block()}
    </div>
  </div>
</section>
</main>
"""
        + footer()
    )


def map_block():
    q = "https://www.google.com/maps/dir/?api=1&destination=" + "China+Restaurant+Man+Fu+Ly+Bettlachstrasse+36+2540+Grenchen"
    return f"""<div class="map" data-map>
        <div class="map__consent">
          <span class="map__pin">{STREET}<br>{CITY}</span>
          <p>Die Karte wird von Google Maps geladen. Dabei werden Daten an Google übertragen.</p>
          <button class="btn btn--ink" type="button">Karte anzeigen</button>
        </div>
      </div>
      <p class="caption"><span>Grenchen, Kanton Solothurn</span><a class="link" href="{q}" target="_blank" rel="noopener">Route planen <span class="arrow" aria-hidden="true">↗</span></a></p>"""


def dish_li(it):
    nr = it["nr"]
    hot, ss = is_hot(it["name"]), is_sweetsour(it["name"])
    tags = ""
    if hot:
        tags += '<span class="tag tag--hot">scharf</span>'
    if ss:
        tags += '<span class="tag">süss-sauer</span>'
    search = f"{nr} {it['name']} {it.get('desc', '')}".lower()
    # The Speisekarte is text-only by choice; photos are used on the home page only.
    return f"""<li class="dish" id="g-{slug(it['key'])}" data-key="{e(it['key'])}" data-nr="{e(nr)}" data-name="{e(it['name'])}" data-price="{it['price']}" data-hot="{str(hot).lower()}" data-ss="{str(ss).lower()}" data-search="{e(search)}">
  <span class="dish__nr num">{e(nr)}</span>
  <span class="dish__main"><span class="dish__body"><span class="dish__name">{e(clean_name(it['name']))}</span>{f'<span class="dish__desc">{e(it["desc"])}</span>' if it.get('desc') else ''}{f'<span class="dish__tags">{tags}</span>' if tags else ''}</span></span>
  <span class="dish__price num">{chf(it['price'])}</span>
  <span class="dish__act" data-act></span>
</li>"""


def page_menu():
    cats = MENU["categories"]
    chips = "".join(
        f'<button type="button" class="chip" data-target="k-{slug(c["name"])}">{e(c["name"])}</button>' for c in cats
    )
    sections = "".join(
        f"""<section class="cat" id="k-{slug(c['name'])}" aria-labelledby="h-{slug(c['name'])}">
  <h2 class="cat__title" id="h-{slug(c['name'])}">{e(c['name'])} <span class="cat__count num">{len(c['items'])}</span></h2>
  <ol class="dishes">{''.join(dish_li(it) for it in c['items'])}</ol>
</section>"""
        for c in cats
    )
    menu_ld = {
        "@context": "https://schema.org",
        "@type": "Menu",
        "name": "Speisekarte Man Fu Ly",
        "inLanguage": "de-CH",
        "hasMenuSection": [
            {
                "@type": "MenuSection",
                "name": c["name"],
                "hasMenuItem": [
                    {
                        "@type": "MenuItem",
                        "name": f"{it['nr']}. {it['name']}",
                        "offers": {"@type": "Offer", "price": f"{it['price']:.2f}", "priceCurrency": "CHF"},
                    }
                    for it in c["items"]
                ],
            }
            for c in cats
        ],
    }
    return (
        head(
            "Speisekarte & Bestellung · Man Fu Ly Grenchen",
            f"Speisekarte von Man Fu Ly in Grenchen: {TOTAL} chinesische Gerichte mit Preisen. "
            "Online zusammenstellen und per WhatsApp zum Abholen bestellen.",
            "/speisekarte/",
            extra_css=f'\n<link rel="stylesheet" href="/assets/css/menu.css?v={VERSION}">',
            jsonld=menu_ld,
        )
        + header("/speisekarte/")
        + f"""<main id="main" class="menu-page">
<section class="page-head wrap">
  <span class="meta">Man Fu Ly · Speisekarte</span>
  <div class="grid page-head__row">
    <h1 class="display">Speise&shy;karte</h1>
    <p class="page-head__aside">{TOTAL} Gerichte, Preise in CHF. Zusammenstellen und per WhatsApp zum Abholen bestellen.</p>
  </div>
</section>


<div class="toolbar" id="toolbar">
  <div class="wrap">
    <div class="toolbar__row">
      <label class="search"><span class="sr-only">Speisekarte durchsuchen</span>
        <input id="q" type="search" placeholder="Suchen: Curry, Ente, 52 …" autocomplete="off" enterkeyhint="search">
      </label>
      <button type="button" class="toggle" data-filter="hot" aria-pressed="false">Scharf</button>
      <button type="button" class="toggle" data-filter="ss" aria-pressed="false">Süss-Sauer</button>
    </div>
    <nav class="chips" aria-label="Kategorien">{chips}</nav>
  </div>
</div>

<div class="wrap menu-layout">
  <div class="menu-list">
    {sections}
    <p class="empty" hidden>Kein Gericht gefunden. <button type="button" class="link" data-reset>Suche zurücksetzen</button></p>
    <p class="menu-note"><strong>Hinweis</strong> {e(MENU['note'])}</p>
  </div>

  <aside class="cart" id="cart" aria-labelledby="cart-title">
    <div class="cart__panel">
      <div class="cart__head">
        <h2 class="cart__title" id="cart-title">Ihre Bestellung</h2>
        <button type="button" class="cart__close" data-cart-close aria-label="Warenkorb schliessen">Schliessen</button>
      </div>
      <p class="cart__status"><span class="status" data-status></span></p>
      <div class="cart__empty" data-cart-empty>
        <p>Noch nichts ausgewählt. Tippen Sie bei einem Gericht auf <span class="plus-ico" aria-hidden="true">+</span>, um es hinzuzufügen.</p>
      </div>
      <ul class="cart__items" data-cart-items></ul>
      <div class="cart__total" data-cart-total hidden><span>Total</span><span class="num" data-total>CHF 0.00</span></div>
      <form class="cart__form" data-order-form novalidate hidden>
        <div class="field">
          <label for="o-name">Name</label>
          <input id="o-name" name="name" autocomplete="name" required>
        </div>
        <div class="field">
          <label for="o-tel">Telefon</label>
          <input id="o-tel" name="tel" type="tel" autocomplete="tel" inputmode="tel" required>
        </div>
        <div class="field">
          <label for="o-time">Abholzeit</label>
          <select id="o-time" name="time" required></select>
          <span class="hint" data-time-hint></span>
        </div>
        <div class="field">
          <label for="o-note">Bemerkung <span class="hint">(optional)</span></label>
          <textarea id="o-note" name="note" rows="2" placeholder="z. B. ohne Koriander, extra scharf"></textarea>
        </div>
        <button class="btn btn--block" type="submit">Per WhatsApp bestellen</button>
        <p class="form-note">WhatsApp öffnet sich mit Ihrer fertigen Bestellung. Tippen Sie dort auf <strong>Senden</strong>. Wir bestätigen per WhatsApp, bezahlt wird bei der Abholung.</p>
      </form>
      <div class="cart__sent" data-cart-sent hidden>
        <p class="h3">Fast geschafft.</p>
        <p>Bitte senden Sie die Nachricht in WhatsApp ab. Sobald wir bestätigen, ist Ihre Bestellung in Arbeit.</p>
        <p><a class="link" data-wa-again href="#">WhatsApp erneut öffnen <span class="arrow" aria-hidden="true">↗</span></a></p>
        <button type="button" class="btn btn--ghost btn--block" data-cart-clear>Neue Bestellung beginnen</button>
      </div>
    </div>
  </aside>
</div>

<button type="button" class="cart-bar" data-cart-open hidden>
  <span class="cart-bar__count num" data-count>0</span>
  <span>Warenkorb ansehen</span>
  <span class="num" data-total>CHF 0.00</span>
</button>
<div class="scrim" data-cart-close hidden></div>
</main>
"""
        + footer(f'\n<script src="/assets/js/order.js?v={VERSION}"></script>')
    )


def page_reservation():
    persons = "".join(f'<option value="{i}">{i} {"Person" if i == 1 else "Personen"}</option>' for i in range(1, 11))
    return (
        head(
            "Tisch reservieren · Man Fu Ly Grenchen",
            "Reservieren Sie einen Tisch im China-Restaurant Man Fu Ly in Grenchen, per WhatsApp oder Telefon.",
            "/reservierung/",
            extra_css=PRELOAD_FILM,
            jsonld=RESTAURANT_LD,
        )
        + header("/reservierung/")
        + f"""<main id="main">
{film_head("Man Fu Ly · Reservierung", "Tisch <em>reservieren</em>", "Wählen Sie Tag, Zeit und Anzahl Personen. Die Anfrage geht per WhatsApp an uns, wir bestätigen so schnell wie möglich.")}

<section class="wrap">
  <div class="grid res">
    <form class="form res__form reveal" data-res-form novalidate>
      <div class="field">
        <label for="r-date">Datum</label>
        <input id="r-date" name="date" type="date" required>
        <span class="hint" data-date-hint>Montag ist Ruhetag.</span>
      </div>
      <div class="field">
        <label for="r-time">Uhrzeit</label>
        <select id="r-time" name="time" required><option value="">Zuerst Datum wählen</option></select>
      </div>
      <div class="field">
        <label for="r-persons">Personen</label>
        <select id="r-persons" name="persons" required>{persons}<option value="mehr als 10">Mehr als 10</option></select>
      </div>
      <div class="field">
        <label for="r-name">Name</label>
        <input id="r-name" name="name" autocomplete="name" required>
      </div>
      <div class="field field--full">
        <label for="r-tel">Telefon</label>
        <input id="r-tel" name="tel" type="tel" autocomplete="tel" inputmode="tel" required>
      </div>
      <div class="field field--full">
        <label for="r-note">Bemerkung <span class="hint">(optional)</span></label>
        <textarea id="r-note" name="note" rows="3" placeholder="z. B. Kinderstuhl, Geburtstag, Allergien"></textarea>
      </div>
      <div class="field field--full">
        <button class="btn" type="submit">Anfrage per WhatsApp senden</button>
        <p class="form-note">WhatsApp öffnet sich mit Ihrer Anfrage. Tippen Sie dort auf Senden. Die Reservierung gilt, sobald wir bestätigt haben.</p>
      </div>
    </form>
    <aside class="res__aside reveal">
      <span class="meta">Lieber persönlich?</span>
      <p class="h3" style="margin:12px 0 4px"><a href="tel:{PHONE}" class="num" style="text-decoration:none">{PHONE_LABEL}</a></p>
      <p class="form-note">Während der Öffnungszeiten erreichen Sie uns auch telefonisch.</p>
      {HOURS_TABLE}
    </aside>
  </div>
</section>
</main>
"""
        + footer(f'\n<script src="/assets/js/reservation.js?v={VERSION}"></script>')
    )


def page_contact():
    return (
        head(
            "Kontakt & Anfahrt · Man Fu Ly Grenchen",
            f"China-Restaurant Man Fu Ly, {STREET}, {CITY}. Telefon {PHONE_LABEL}, WhatsApp, E-Mail und Öffnungszeiten.",
            "/kontakt/",
            extra_css=PRELOAD_FILM,
            jsonld=RESTAURANT_LD,
        )
        + header("/kontakt/")
        + f"""<main id="main">
{film_head("Man Fu Ly · Kontakt", "Kontakt", "Für Bestellungen, Reservierungen und Fragen. Am schnellsten per Telefon oder WhatsApp.")}

<section class="wrap">
  <ul class="index contact-index">
    <li class="index__row"><a href="tel:{PHONE}"><span class="index__nr meta">Telefon</span><span class="index__name num">{PHONE_LABEL}</span><span class="index__cat">Anrufen</span><span class="index__price" aria-hidden="true">→</span></a></li>
    <li class="index__row"><a href="https://wa.me/{WHATSAPP}"><span class="index__nr meta">WhatsApp</span><span class="index__name num">{WHATSAPP_LABEL}</span><span class="index__cat">Nachricht schreiben</span><span class="index__price" aria-hidden="true">↗</span></a></li>
    <li class="index__row"><a href="mailto:{EMAIL}"><span class="index__nr meta">E-Mail</span><span class="index__name">{EMAIL}</span><span class="index__cat">E-Mail senden</span><span class="index__price" aria-hidden="true">→</span></a></li>
  </ul>
</section>

<section class="section wrap" aria-labelledby="anfahrt">
  <div class="grid visit">
    <div class="visit__info reveal">
      <span class="meta" id="anfahrt">Adresse</span>
      <p class="h3" style="margin:12px 0 36px">China-Restaurant Man Fu Ly<br>{STREET}<br>{CITY}</p>
      <span class="meta">Öffnungszeiten</span>
      {HOURS_TABLE}
    </div>
    <div class="visit__map reveal">
      {map_block()}
    </div>
  </div>
</section>
</main>
"""
        + footer()
    )


def page_impressum():
    return (
        head(
            "Impressum & Datenschutz · Man Fu Ly",
            "Impressum und Datenschutzerklärung des China-Restaurants Man Fu Ly in Grenchen.",
            "/impressum/",
        )
        + header("/impressum/")
        + f"""<main id="main">
<section class="page-head wrap">
  <span class="meta">Rechtliches</span>
  <div class="grid page-head__row"><h1 class="display">Impressum</h1></div>
</section>
<section class="wrap">
  <div class="prose">
    <h2>Kontaktadresse</h2>
    <p>China-Restaurant Man Fu Ly<br>{STREET}<br>{CITY}<br>Schweiz</p>
    <p>Telefon: <a href="tel:{PHONE}">{PHONE_LABEL}</a><br>E-Mail: <a href="mailto:{EMAIL}">{EMAIL}</a></p>

    <h2>Haftung</h2>
    <p>Preise und Angebot können ändern. Massgebend sind die Preise im Restaurant. Für Inhalte externer Links übernehmen wir keine Verantwortung.</p>

    <h2>Datenschutz</h2>
    <p>Diese Website setzt keine Cookies, verwendet keine Analyse- oder Werbedienste und speichert keine Personendaten auf einem Server.</p>
    <h3>Bestellung und Reservierung per WhatsApp</h3>
    <p>Wenn Sie über die Website bestellen oder reservieren, wird in Ihrem Browser eine Nachricht vorbereitet und in WhatsApp geöffnet. Erst wenn Sie diese Nachricht selbst absenden, erhalten wir Ihre Angaben (Name, Telefonnummer, Bestellung oder Reservierungswunsch). Wir verwenden sie nur zur Abwicklung Ihrer Bestellung oder Reservierung. WhatsApp ist ein Dienst der WhatsApp Ireland Ltd. bzw. Meta Platforms; es gelten dessen Datenschutzbestimmungen.</p>
    <h3>Warenkorb</h3>
    <p>Der Inhalt Ihres Warenkorbs wird nur lokal in Ihrem Browser gespeichert (localStorage), damit er beim Neuladen der Seite erhalten bleibt. Er wird nicht an uns übertragen.</p>
    <h3>Karte</h3>
    <p>Die Google-Maps-Karte wird erst geladen, wenn Sie auf «Karte anzeigen» klicken. Dabei werden Daten wie Ihre IP-Adresse an Google übertragen.</p>
    <h3>Hosting</h3>
    <p>Die Website wird über GitHub Pages (GitHub Inc.) ausgeliefert. Beim Aufruf werden technisch notwendige Daten wie die IP-Adresse verarbeitet.</p>
    <h3>Ihre Rechte</h3>
    <p>Sie können jederzeit Auskunft über Ihre bei uns gespeicherten Daten verlangen oder deren Löschung beantragen. Schreiben Sie uns an <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>

    <h2>Gestaltung</h2>
    <p>Schriften: Fraunces und Instrument Sans (SIL Open Font License).</p>
  </div>
</section>
</main>
"""
        + footer()
    )


def page_404():
    return (
        head("Seite nicht gefunden · Man Fu Ly", "Diese Seite gibt es nicht.", "/404.html")
        + header("")
        + """<main id="main">
<section class="page-head wrap">
  <span class="meta">Fehler 404</span>
  <div class="grid page-head__row">
    <h1 class="display">Nicht <em>gefunden</em></h1>
    <p class="page-head__aside">Diese Seite gibt es nicht. Vielleicht suchen Sie die Speisekarte?</p>
  </div>
  <p style="margin-top:32px"><a class="btn" href="/speisekarte/">Zur Speisekarte</a></p>
</section>
</main>
"""
        + footer()
    )


def main():
    write("index.html", page_home())
    write("speisekarte/index.html", page_menu())
    write("reservierung/index.html", page_reservation())
    write("kontakt/index.html", page_contact())
    write("impressum/index.html", page_impressum())
    write("404.html", page_404())
    write("robots.txt", f"User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n")
    urls = ["/", "/speisekarte/", "/reservierung/", "/kontakt/", "/impressum/"]
    write(
        "sitemap.xml",
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{SITE}{u}</loc></url>\n" for u in urls)
        + "</urlset>\n",
    )
    write("CNAME", "www.manfuly.ch\n")
    print(f"built {OUT} ({TOTAL} dishes)")


if __name__ == "__main__":
    main()
