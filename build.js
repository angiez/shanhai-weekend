const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = __dirname;
const dist = path.join(root, "dist");
const SITE_URL = "https://weekend.bchomehub.com";

function loadSite() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  ["data.js", "places1.js", "places2.js", "places3.js", "en.js"].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), ctx);
  });
  return ctx.window.SITE;
}

const COPY = (() => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "en.js"), "utf8"), ctx);
  return ctx.window.COPY;
})();

const PLACE_EN = JSON.parse(fs.readFileSync(path.join(root, "place-en.json"), "utf8"));
const PLACE_COORDS = fs.existsSync(path.join(root, "place-coords.json"))
  ? JSON.parse(fs.readFileSync(path.join(root, "place-coords.json"), "utf8"))
  : {};
function publicAnonKey() {
  const key = (process.env.SUPABASE_ANON_KEY || "").trim();
  if (!key) return "";
  if (/^sb_secret_/i.test(key)) return "";
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return key;
  const parts = key.split(".");
  if (parts.length !== 3) return "";
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (payload.role !== "anon") return "";
  } catch (err) {
    return "";
  }
  return key;
}
function canadianProjectUrl() {
  const region = process.env.SUPABASE_REGION || "";
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  if (region !== "ca-central-1") return "";
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(url)) return "";
  if (url.toLowerCase().includes("cuheydevtbwmfzvvdxaw")) return "";
  return url;
}
const canadaUrl = canadianProjectUrl();
const PUBLIC = {
  supabaseUrl: canadaUrl,
  supabaseAnonKey: canadaUrl ? publicAnonKey() : "",
  supabaseRegion: canadaUrl ? "ca-central-1" : "",
  gaId: /^G-[A-Z0-9]+$/.test(process.env.GA_MEASUREMENT_ID || "") ? process.env.GA_MEASUREMENT_ID : "",
  contactEmail: process.env.CONTACT_EMAIL || "",
  siteVerification: /^[A-Za-z0-9_-]{8,128}$/.test(process.env.GOOGLE_SITE_VERIFICATION || "") ? process.env.GOOGLE_SITE_VERIFICATION : ""
};
const SITE = loadSite();
const month = new Date().getMonth() + 1;
const COST_ZH = ["免费", "人均约 20 加元内", "人均约 20–50 加元", "人均 50 加元以上"];
const COST_EN = ["Free", "About $20 or less per person", "About $20–50 per person", "Over $50 per person"];
const AGE_ZH = { toddler: "幼儿", kid: "小学生", teen: "青少年" };
const AGE_EN = { toddler: "toddlers", kid: "school-age children", teen: "teens" };
const CAT_EN = {
  park: "Parks and beaches",
  museum: "Museums",
  hike: "Trails",
  animal: "Animals and birds",
  farm: "Farms",
  thrill: "Bigger thrills",
  water: "Water",
  food: "Markets and food",
  walk: "Neighbourhood walks",
  culture: "History and culture"
};
const DUR_EN = {
  "半天到一天": "Half a day to a full day",
  "2–3 小时": "2–3 hours",
  "2–4 小时": "2–4 hours",
  "1.5–3 小时": "1.5–3 hours",
  "1–2 小时": "1–2 hours",
  "45–90 分钟": "45–90 minutes",
  "1 小时": "1 hour",
  "1.5–2.5 小时": "1.5–2.5 hours",
  "半天": "Half a day",
  "1–3 小时": "1–3 hours",
  "约 1 小时": "About 1 hour",
  "1–1.5 小时": "1–1.5 hours",
  "30–60 分钟": "30–60 minutes",
  "一天": "A full day",
  "30–90 分钟": "30–90 minutes",
  "4–7 小时": "4–7 hours",
  "市区一天": "One day in the city",
  "列治文一天": "One day in Richmond",
  "北温一天": "One day in North Vancouver",
  "温哥华半天": "Half a day in Vancouver",
  "河谷一天": "One day in the valley",
  "斯阔米什": "Squamish",
  "三角洲半天": "Half a day in Delta",
  "出城一天": "A full day out of town",
  "温哥华一天": "One day in Vancouver",
  "本拿比": "Burnaby",
  "南岸半天": "Half a day on the south shore"
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function openMonths(p) {
  return p.open === "all" ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : p.open;
}
function isOpen(p) { return openMonths(p).includes(month); }
function isBest(p) { return (p.best || []).includes(month); }
function cityBy(id) { return SITE.cities.find((c) => c.id === id); }
function placeBy(id) { return SITE.places.find((p) => p.id === id); }
function catZh(id) { return SITE.cats.find((c) => c.id === id).zh; }
function enPlace(p) {
  return PLACE_EN[p.id] || {
    summary: `${p.en} is a family outing in ${cityBy(p.city).en}.`,
    body: `${p.en} (${p.zh}) is in ${cityBy(p.city).en}. ${COST_EN[p.cost]}. Allow ${DUR_EN[p.duration] || p.duration}.`,
    tips: []
  };
}
function seasonZh(p) {
  if (!isOpen(p)) return "这个月通常关闭";
  if (isBest(p)) return "这个月正合适";
  if (p.open === "all") return "全年可去";
  return "本月开放";
}
function seasonEn(p) {
  if (!isOpen(p)) return "Usually closed this month";
  if (isBest(p)) return "A good month to go";
  if (p.open === "all") return "Open year-round";
  return "Open this month";
}
function seasonSentence(p) {
  const zh = p.open === "all"
    ? ((p.best || []).length ? `全年可去，${p.best.join("、")} 月更合适。` : "全年都可以去。")
    : `${p.open.join("、")} 月开放。出发前再对一下当年日历。`;
  const en = p.open === "all"
    ? ((p.best || []).length ? `Open year-round, and especially good in months ${p.best.join(", ")}.` : "Open year-round.")
    : `Open in months ${p.open.join(", ")}. Check this year's calendar before you go.`;
  return { zh, en };
}

function page({ title, description, url, jsonld, main, nav, extraHead = "", extraFoot = "", robots = "index, follow" }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(url)}" />
  <meta name="robots" content="${esc(robots)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="山海周末 Shanhai Weekend" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:locale" content="zh_CN" />
  <meta property="og:locale:alternate" content="en_CA" />
  <meta property="og:image" content="${SITE_URL}/images/og-share.webp" />
  <meta property="og:image:alt" content="Illustration of families on a waterfront path. Not a photograph of a specific place or of real members." />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${SITE_URL}/images/og-share.webp" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@600;700&display=swap" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@600;700&display=swap" media="print" onload="this.media='all'" />
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@600;700&display=swap" /></noscript>
  <link rel="stylesheet" href="/styles.css" />
  ${PUBLIC.siteVerification ? `<meta name="google-site-verification" content="${esc(PUBLIC.siteVerification)}" />` : ""}
  <script>window.SHANHAI_PUBLIC=${JSON.stringify({ supabaseUrl: PUBLIC.supabaseUrl, supabaseAnonKey: PUBLIC.supabaseAnonKey, supabaseRegion: PUBLIC.supabaseRegion, contactEmail: PUBLIC.contactEmail, gaId: PUBLIC.gaId })};</script>
  ${extraHead}
  ${(Array.isArray(jsonld) ? jsonld : [jsonld]).map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`).join("\n")}
</head>
<body>
  <a class="skip" href="#main">跳到内容 / Skip to content</a>
  <header class="topbar">
    <a class="brand" href="/">
      <span class="brand-mark" aria-hidden="true">山</span>
      <span>
        <strong>山海周末</strong>
        <small>Shanhai Weekend · 大温家庭的出门地图</small>
      </span>
    </a>
    <form class="search" action="/" method="get" role="search">
      <label class="sr" for="q">搜索地点 Search places</label>
      <input id="q" name="q" type="search" placeholder="三文鱼、列治文 / salmon, Richmond" autocomplete="off" />
    </form>
    <nav class="nav" aria-label="主要 Main">
      <a href="/" ${nav === "home" ? 'aria-current="page"' : ""}>地点<small>Places</small></a>
      <a href="/map/" ${nav === "map" ? 'aria-current="page"' : ""}>地图<small>Map</small></a>
      <a href="/routes/" ${nav === "routes" ? 'aria-current="page"' : ""}>路线<small>Routes</small></a>
      <a href="/activities/" ${nav === "activities" ? 'aria-current="page"' : ""}>结伴<small>Activities</small></a>
      <a href="/rain/" ${nav === "rain" ? 'aria-current="page"' : ""}>雨天<small>Rain</small></a>
      <a href="/saved/" ${nav === "saved" ? 'aria-current="page"' : ""}>想去 <em id="saved-count">0</em><small>Saved</small></a>
    </nav>
    <button class="nav-toggle" id="nav-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav">菜单 Menu</button>
  </header>
  <div class="mobile-nav" id="mobile-nav" hidden>
    <a href="/">地点 Places</a>
    <a href="/map/">地图 Map</a>
    <a href="/routes/">路线 Routes</a>
    <a href="/activities/">结伴 Activities</a>
    <a href="/rain/">雨天 Rain</a>
    <a href="/saved/">想去 Saved</a>
  </div>
  <main id="main">${main}</main>
  <footer class="footer">
    <div>
      <strong>山海周末 Shanhai Weekend</strong>
      <p lang="zh-CN">给住在大温、想周末带家人出门的人。不卖票，只把地方讲清楚：在哪、适不适合小孩、大概要花多少、这个月值不值得去。</p>
      <p class="alt-lang" lang="en">A weekend map for families in Greater Vancouver. No tickets for sale. Each place says where it is, who it suits, what it costs, and whether this month is a good time to go.</p>
    </div>
    <p class="fine" lang="zh-CN">开放时间、预约和票价会变，出发前以公园告示或官方网站为准。山路、湖水和海边请按自己的经验和天气决定。跨境需要护照和合法入境资格。</p>
    <p class="fine" lang="en">Hours, reservations, and prices change. Check the park notice or the official site before you leave. Choose trails, lakes, and beaches according to your own experience and the weather. Crossing the border requires a passport and the legal right to enter.</p>
    <p class="fine"><a href="/privacy/">隐私 Privacy</a> · <a href="/terms/">条款 Terms</a> · <a href="/guidelines/">准则 Guidelines</a> · <a href="/activities/">结伴 Activities</a></p>
  </footer>
  <script src="/enhance.js"></script>
  ${extraFoot}
</body>
</html>`;
}

const HERO = { src: "/images/hero-waterfront.webp", w: 1600, h: 900 };
const SCENES = {
  water: { src: "/images/scene-friends.webp", w: 960, h: 720 },
  market: { src: "/images/scene-market.webp", w: 960, h: 720 },
  hike: { src: "/images/scene-hike.webp", w: 960, h: 720 },
  plan: { src: "/images/scene-planning.webp", w: 960, h: 720 }
};

function sceneForPlace(p) {
  if (p.cat === "hike" || p.cat === "animal") return SCENES.hike;
  if (p.cat === "food" || p.cat === "walk") return SCENES.market;
  if (p.cat === "park" || p.cat === "water") return SCENES.water;
  return SCENES.plan;
}

function sceneForCity(city) {
  if (city.id === "richmond") return SCENES.market;
  if (["northvan", "squamish", "whistler", "hope", "mapleridge", "mission", "chilliwack", "harrison"].includes(city.id)) return SCENES.hike;
  if (["vancouver", "westvan", "bowen", "whiterock", "victoria", "bellingham", "delta"].includes(city.id)) return SCENES.water;
  return SCENES.plan;
}

function illustration(scene, alt, caption, eager) {
  return `<figure class="illustration${eager ? " hero-photo" : ""}">
    <img src="${scene.src}" width="${scene.w}" height="${scene.h}" alt="${esc(alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">
    ${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}
  </figure>`;
}

function ctaBand() {
  return `<nav class="cta-band" aria-label="行动 Action">
    <a href="/"><strong>发现周末好去处</strong><span lang="en">Discover Weekend Adventures</span></a>
    <a href="/activities/"><strong>找人一起出发</strong><span lang="en">Find People to Explore With</span></a>
    <a href="/account/"><strong>免费报名参加</strong><span lang="en">Join an Activity for Free</span></a>
    <a href="/activities/"><strong>一起规划行程</strong><span lang="en">Plan Your Weekend Together</span></a>
  </nav>`;
}

function card(p) {
  const c = cityBy(p.city);
  const en = enPlace(p);
  const blob = [p.zh, p.en, p.summary, en.summary, c.zh, c.en, catZh(p.cat), CAT_EN[p.cat], ...(p.alias || [])].join(" ");
  return `<article class="card" data-city="${esc(p.city)}" data-cat="${esc(p.cat)}" data-cost="${p.cost}" data-indoor="${p.indoor ? "1" : "0"}" data-stroller="${p.stroller ? "1" : "0"}" data-open="${isOpen(p) ? "1" : "0"}" data-blob="${esc(blob.toLowerCase())}">
    <button class="save" type="button" data-save="${esc(p.id)}">想去 Save</button>
    <a class="card-link" href="/place/${esc(p.id)}/">
      <img class="card-photo" src="${sceneForPlace(p).src}" width="${sceneForPlace(p).w}" height="${sceneForPlace(p).h}" alt="${esc("插画：" + catZh(p.cat) + "氛围，不是" + p.zh + "的实拍照片。Illustration of a " + CAT_EN[p.cat] + " outing, not a photograph of " + p.en + ".")}" loading="lazy" decoding="async">
      <div class="badges"><span class="badge${isBest(p) ? " hot" : ""}">${esc(seasonZh(p))} / ${esc(seasonEn(p))}</span><span class="badge${p.cost === 0 ? " free" : " dim"}">${esc(COST_ZH[p.cost])} / ${esc(COST_EN[p.cost])}</span>${p.indoor ? '<span class="badge dim">室内 Indoor</span>' : ""}</div>
      <h3 lang="zh-CN">${esc(p.zh)}</h3>
      <p class="en" lang="en">${esc(p.en)} · ${esc(c.zh)} ${esc(c.en)}</p>
      <p class="summary" lang="zh-CN">${esc(p.summary)}</p>
      <p class="alt-lang" lang="en">${esc(en.summary)}</p>
      <p class="meta"><span>${esc(catZh(p.cat))} / ${esc(CAT_EN[p.cat])}</span><span>${esc(p.duration)} / ${esc(DUR_EN[p.duration] || p.duration)}</span></p>
    </a>
  </article>`;
}

function filters(cityId) {
  const cats = `<button class="chip" type="button" data-cat="" aria-pressed="true">全部玩法 All</button>` +
    SITE.cats.map((c) => `<button class="chip" type="button" data-cat="${esc(c.id)}">${esc(c.zh)} ${esc(CAT_EN[c.id])}</button>`).join("");
  const costs = [["", "不限花费 Any cost"], ["0", "只看免费 Free"], ["1", "小花费以内 Under $20"], ["2", "50 加元以内 Under $50"]]
    .map(([v, label]) => `<button class="chip" type="button" data-cost="${v}"${v === "" ? ' aria-pressed="true"' : ""}>${label}</button>`).join("");
  return `<div class="filters" id="browse"><div class="filter-row">${cats}</div><div class="filter-row">${costs}
    <button class="chip" type="button" data-toggle="stroller">推车友好 Stroller</button>
    <button class="chip" type="button" data-toggle="openNow">这个月开着 Open now</button>
    <button class="chip" type="button" data-random="1">随机一个 Surprise me</button>
    ${cityId ? '<a class="chip" href="/">全部城市 All cities</a>' : ""}
  </div></div>`;
}

function write(rel, html) {
  const file = path.join(dist, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

function homeMain() {
  const picks = ["hatchery", "capilano", "tynehead"].map(placeBy).filter(Boolean);
  const tickets = picks.map((p, i) => {
    const c = cityBy(p.city);
    const en = enPlace(p);
    return `<a class="ticket" href="/place/${esc(p.id)}/"><div class="stamp">${month}月<br>合适</div><div><p class="when">0${i + 1} · ${esc(c.zh)} ${esc(c.en)}</p><h3 lang="zh-CN">${esc(p.zh)}</h3><p lang="zh-CN">${esc(p.summary)}</p><p class="alt-lang" lang="en">${esc(en.summary)}</p></div><span class="go">去看</span></a>`;
  }).join("");
  const regions = SITE.regions.map((r) => {
    const chips = SITE.cities.filter((c) => c.region === r.id).map((c) => {
      const n = SITE.places.filter((p) => p.city === c.id).length;
      return `<a class="city-chip" href="/city/${esc(c.id)}/"><b>${esc(c.zh)}</b><span>${esc(c.en)} · ${n}</span></a>`;
    }).join("");
    return `<section class="region"><header><h3>${esc(r.zh)}</h3><small>${esc(r.en)}</small></header><div class="city-row">${chips}</div></section>`;
  }).join("");
  const routes = SITE.routes.slice(0, 4).map((r, i) => routeCard(r, i)).join("");
  return `<section class="hero"><div class="wrap">
    ${illustration(HERO, "插画：家人沿着海边步道散步。这不是某一处景点的实拍照片，也不是真实会员。Illustration of a family walking a waterfront path. This is not a photograph of a specific place or of real members.", "插画示意，不是某一处景点或真实会员的照片。Illustration, not a photograph of a specific place or of real members.", true)}
    <div class="hero-grid"><div>
    <p class="kicker">${month}月 · October · 大温 Greater Vancouver</p>
    <h1>山海周末</h1>
    <p class="lede" lang="zh-CN">从史提夫斯顿的码头走到格罗斯山的雪线。按城市找公园、博物馆、农场和一日游，下雨也有地方去。</p>
    <p class="alt-lang" lang="en">From the Steveston docks to the snowline on Grouse. Find parks, museums, farms, and day trips by city, including places that still work in the rain.</p>
    <div class="hero-actions"><a class="btn sea" href="/routes/">看十二条路线 12 routes</a><a class="btn ghost" href="/rain/">下雨的时候 Rainy days</a></div>
    ${ctaBand()}
    <ul class="stats"><li><strong>${SITE.places.length}</strong><span>个地方 places</span></li><li><strong>${SITE.cities.length}</strong><span>座城市 cities</span></li><li><strong>${SITE.routes.length}</strong><span>条路线 routes</span></li></ul>
  </div><div class="ticket-stack">${tickets}</div></div></div></section>
  <section class="section"><div class="wrap"><div class="section-head"><div><h2>先选一座城</h2><p lang="zh-CN">中文地名旁边是英文地名。</p><p class="alt-lang" lang="en">Every city is labeled in Chinese and English.</p></div></div><div class="regions">${regions}</div></div></section>
  <section class="section"><div class="wrap"><div class="section-head"><div><h2>全部地方 All places</h2><p lang="zh-CN">当季的排在前面。票价和开放日出门前再确认一次。</p><p class="alt-lang" lang="en">In-season places come first. Confirm prices and hours before you go.</p></div></div>
  ${filters("")}<p class="result-line" id="result-line">${SITE.places.length} 个地方 places</p><div class="grid" id="place-grid">${SITE.places.map(card).join("")}</div></div></section>
  <section class="section"><div class="wrap"><div class="section-head"><div><h2>排好的一天 Ready-made days</h2><p class="alt-lang" lang="en">One direction and one kind of weather. Not a bridge, a zoo, and a ferry in the same Saturday.</p></div><a href="/routes/">全部路线 All routes</a></div><div class="routes">${routes}</div></div></section>`;
}

function routeCard(r, i) {
  const en = COPY.routes[r.id];
  const names = r.cities.map((id) => `${cityBy(id).zh} ${cityBy(id).en}`).join(" · ");
  return `<a class="route" href="/route/${esc(r.id)}/"><div class="num">${String(i + 1).padStart(2, "0")}</div><div><p>${esc(r.days)} / ${esc(DUR_EN[r.days] || "")} · ${esc(names)}</p><h3 lang="zh-CN">${esc(r.zh)}</h3><p lang="zh-CN">${esc(r.blurb)}</p><p class="alt-lang" lang="en">${esc(en.title)}. ${esc(en.blurb)}</p></div></a>`;
}

function cityMain(city) {
  const en = COPY.cities[city.id];
  const list = SITE.places.filter((p) => p.city === city.id);
  const scene = sceneForCity(city);
  return `<section class="section"><div class="wrap">
    ${illustration(scene, "插画：" + city.zh + "一带的周末氛围，不是这座城市的实拍照片。Illustration of a weekend in the " + city.en + " area, not a photograph of the city.", "插画示意，不是这座城市的实拍。Illustration, not a photograph of this city.")}
    <article class="city-guide" id="city-guide">
      <div>
        <p class="en">${esc(city.en)}</p>
        <h1 lang="zh-CN">${esc(city.zh)}</h1>
        <p lang="zh-CN">${esc(city.blurb)}</p>
        <p lang="en">${esc(en.blurb)}</p>
      </div>
      <div>
        <h2 lang="zh-CN">怎么去 <span lang="en">Getting there</span></h2>
        <p lang="zh-CN">${esc(city.getting)}</p>
        <p lang="en">${esc(en.getting)}</p>
        <h2 lang="zh-CN">吃 <span lang="en">Eat</span></h2>
        <p lang="zh-CN">${esc(city.eat)}</p>
        <p lang="en">${esc(en.eat)}</p>
      </div>
    </article>
    ${filters(city.id)}<p class="result-line" id="result-line">${list.length} 个地方 places</p><div class="grid" id="place-grid">${list.map(card).join("")}</div>
  </div></section>`;
}

function seawallNotice() {
  const until = "2026-11-20";
  if (Date.now() > new Date(until + "T23:59:59-08:00").getTime()) return "";
  return `<aside class="note" data-until="${until}">
    <h2>海堤临时封闭 <span lang="en">Seawall closure</span></h2>
    <p lang="zh-CN">温哥华市政府公告：2026年10月19日起，斯坦利公园海堤有一段关闭，至11月7日。间歇性封闭可能持续到11月20日。市政府海堤页写明，这段每年的落石维修通常在 Prospect Point 和 Third Beach 之间，园内会贴绕行指示。不要按走完整圈来安排。想看落日，改从公园南边走到英吉利湾，出发当天再核对市政府页面。</p>
    <p lang="en">The City of Vancouver says a section of the Stanley Park seawall will be closed from October 19, 2026 until November 7, 2026. Intermittent closures may continue until November 20, 2026. The city's seawall page says this yearly rock-scaling work is usually between Prospect Point and Third Beach, with detour signs in the park. Do not plan on walking the full loop. For sunset, use the south side toward English Bay, and check the city page on the day you go.</p>
    <p><a href="https://vancouver.ca/parks-recreation-culture/seawall.aspx">市政府海堤封闭与绕行说明 City seawall closure and detour</a></p>
  </aside>`;
}

function placeMain(p) {
  const c = cityBy(p.city);
  const en = enPlace(p);
  const season = seasonSentence(p);
  const agesZh = (p.ages || []).map((a) => AGE_ZH[a]).join("、");
  const agesEn = (p.ages || []).map((a) => AGE_EN[a]).join(", ");
  const nearby = SITE.places.filter((o) => o.city === p.city && o.id !== p.id).slice(0, 4);
  const note = !isOpen(p)
    ? `<div class="note" lang="zh-CN">这个月通常不开放。页面留着，是为了规划下一季。</div><p class="alt-lang" lang="en">Usually closed this month. The page stays up so you can plan the next season.</p>`
    : (isBest(p) ? `<div class="note" lang="zh-CN">以现在的月份，这里正是值得出门的时候。</div><p class="alt-lang" lang="en">This month is a good time to go.</p>` : "");
  return `<section class="detail"><div class="wrap">
    <p class="crumb"><a href="/">地点 Places</a> / <a href="/map/">地图 Map</a> / <a href="/city/${esc(c.id)}/">${esc(c.zh)} ${esc(c.en)}</a> / ${esc(p.zh)}</p>
    <div class="detail-hero"><p class="kicker">${esc(catZh(p.cat))} ${esc(CAT_EN[p.cat])} · ${esc(c.zh)} ${esc(c.en)}</p>
    <h1 lang="zh-CN">${esc(p.zh)}</h1><p class="en" lang="en">${esc(p.en)}</p>
    <p class="lede" lang="zh-CN">${esc(p.summary)}</p><p class="alt-lang" lang="en">${esc(en.summary)}</p>
    <div class="place-actions"><button class="btn sea" type="button" data-save="${esc(p.id)}">放进想去 Save</button><a class="btn ghost" href="/activities/?place=${esc(p.id)}">约人一起去 Plan an outing</a><a class="btn ghost" href="/city/${esc(c.id)}/">这座城的其他地方 More in this city</a></div></div>
    ${illustration(sceneForPlace(p), "插画：" + catZh(p.cat) + "氛围，不是" + p.zh + "的实拍照片。Illustration of a " + CAT_EN[p.cat] + " outing, not a photograph of " + p.en + ".", "插画示意，不是" + p.zh + " " + p.en + "的实拍照片。Illustration, not a photograph of this place.")}
    ${p.id === "stanley" ? seawallNotice() : ""}
    ${note}
    <div class="detail-layout"><article class="panel">
      <h2>去之前知道这些 <span class="alt-lang">Before you go</span></h2>
      <p lang="zh-CN">${esc(p.body)}</p>
      <p class="alt-lang" lang="en">${esc(en.body)}</p>
      <h2 style="margin-top:18px">现场提示 <span class="alt-lang">On the day</span></h2>
      <ul class="tips">${p.tips.map((t, i) => `<li><span lang="zh-CN">${esc(t)}</span>${en.tips[i] ? `<br><span class="alt-lang" lang="en">${esc(en.tips[i])}</span>` : ""}</li>`).join("")}</ul>
      ${p.web ? `<p><a href="${esc(p.web)}" rel="noopener">官方网站 Official site</a></p>` : ""}
    </article><aside class="panel"><h2>实用信息 Facts</h2><div class="facts">
      ${fact("花费 Cost", `${COST_ZH[p.cost]} / ${COST_EN[p.cost]}`)}
      ${fact("停留 Time", `${p.duration} / ${DUR_EN[p.duration] || p.duration}`)}
      ${fact("季节 Season", `${season.zh} ${season.en}`)}
      ${fact("适合 Ages", `${agesZh} / ${agesEn}`)}
      ${fact("推车 Stroller", p.stroller ? "主路可以 / Fine on the main path" : "不适合 / Not a stroller path")}
      ${fact("天气 Weather", p.indoor ? "室内能待住 / Can stay indoors" : "主要在室外 / Mostly outside")}
      ${fact("地址 Address", p.address)}
      ${fact("交通 Transit", p.transit)}
    </div><h2 style="margin-top:18px">同城附近 Nearby</h2><div class="nearby">${nearby.map((o) => `<a href="/place/${esc(o.id)}/"><span>${esc(o.zh)} ${esc(o.en)}</span><span>${esc(COST_EN[o.cost])}</span></a>`).join("")}</div></aside></div>
  </div></section>`;
}
function fact(k, v) { return `<div class="fact"><b>${esc(k)}</b><span>${esc(v)}</span></div>`; }

function routeMain(r) {
  const en = COPY.routes[r.id];
  const timeEn = { "早上": "Morning", "接着": "Next", "下午换一条溪": "Afternoon, another creek", "上午": "Morning", "中午": "Midday", "若雨还不停": "If it is still raining", "下午": "Afternoon", "中午前后": "Around noon", "上午到下午": "Morning into afternoon", "傍晚": "Evening", "白天": "Daytime", "若不想上山": "If you skip the mountain", "博物馆开放时": "When the museum is open", "备选下午": "Backup afternoon", "时间还够": "If you still have time" };
  const steps = r.steps.map((s) => {
    const p = placeBy(s.place);
    const noteEn = en.steps[s.place] || "";
    return `<li><strong>${esc(s.time)}<br><span class="alt-lang">${esc(timeEn[s.time] || s.time)}</span></strong><div><h3><a href="/place/${esc(p.id)}/"><span lang="zh-CN">${esc(p.zh)}</span> <span lang="en">${esc(p.en)}</span></a></h3><p lang="zh-CN">${esc(s.note)}</p><p class="alt-lang" lang="en">${esc(noteEn)}</p></div></li>`;
  }).join("");
  return `<section class="detail"><div class="wrap"><p class="crumb"><a href="/routes/">路线 Routes</a> / ${esc(r.zh)}</p>
    <h1 lang="zh-CN">${esc(r.zh)}</h1><p class="en" lang="en">${esc(en.title)}</p>
    <p class="lede" lang="zh-CN">${esc(r.blurb)}</p><p class="alt-lang" lang="en">${esc(en.blurb)}</p>
    ${r.id === "seawall" ? seawallNotice() : ""}
    <div class="detail-layout"><article class="panel"><h2>怎么排 The order</h2><ul class="plan-list">${steps}</ul></article>
    <aside class="panel"><h2>涉及的城 Cities</h2><div class="nearby">${r.cities.map((id) => { const c = cityBy(id); return `<a href="/city/${esc(c.id)}/"><span>${esc(c.zh)} ${esc(c.en)}</span><span>进入 Open</span></a>`; }).join("")}</div></aside></div>
  </div></section>`;
}

function rm(dir) { fs.rmSync(dir, { recursive: true, force: true }); }
rm(dist);
fs.mkdirSync(dist);

const homeDesc = "山海周末是大温家庭的出门地图，中英对照。Shanhai Weekend lists 124 family outings across 26 Greater Vancouver cities: parks, museums, farms, rainy-day stops, and ready-made day routes.";
write("index.html", page({
  title: "山海周末 Shanhai Weekend · Greater Vancouver family outings",
  description: homeDesc,
  url: SITE_URL + "/",
  nav: "home",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "山海周末 Shanhai Weekend",
    url: SITE_URL + "/",
    description: homeDesc,
    image: SITE_URL + "/images/og-share.webp",
    inLanguage: ["zh-CN", "en-CA"]
  },
  main: homeMain()
}));

SITE.cities.forEach((c) => {
  const en = COPY.cities[c.id];
  write(`city/${c.id}/index.html`, page({
    title: `${c.zh} ${c.en} 周末去处 | 山海周末`,
    description: `${c.zh}（${c.en}）家庭周末去处。${c.blurb} Family outings in ${c.en}: ${en.blurb}`,
    url: `${SITE_URL}/city/${c.id}/`,
    nav: "home",
    jsonld: { "@context": "https://schema.org", "@type": "TouristDestination", name: `${c.zh} ${c.en}`, description: `${c.blurb} ${en.blurb}`, url: `${SITE_URL}/city/${c.id}/`, inLanguage: ["zh-CN", "en-CA"] },
    main: cityMain(c)
  }));
});

SITE.places.forEach((p) => {
  const c = cityBy(p.city);
  const en = enPlace(p);
  write(`place/${p.id}/index.html`, page({
    title: `${p.zh} ${p.en} · ${c.zh} ${c.en} | 山海周末`,
    description: `${p.zh} ${p.en}，${c.zh}。${p.summary} ${en.summary}`,
    url: `${SITE_URL}/place/${p.id}/`,
    nav: "home",
    jsonld: [{
      "@context": "https://schema.org",
      "@type": "TouristAttraction",
      name: `${p.zh} ${p.en}`,
      description: `${p.summary} ${en.summary}`,
      url: `${SITE_URL}/place/${p.id}/`,
      address: p.address,
      isAccessibleForFree: p.cost === 0,
      inLanguage: ["zh-CN", "en"],
      touristType: "Family"
    }, {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "地点 Places", item: SITE_URL + "/" },
        { "@type": "ListItem", position: 2, name: `${c.zh} ${c.en}`, item: `${SITE_URL}/city/${c.id}/` },
        { "@type": "ListItem", position: 3, name: `${p.zh} ${p.en}`, item: `${SITE_URL}/place/${p.id}/` }
      ]
    }],
    main: placeMain(p)
  }));
});

write("routes/index.html", page({
  title: "周末路线 Day routes | 山海周末 Shanhai Weekend",
  description: "十二条排好的大温家庭一日路线，中英对照。Twelve ready-made Greater Vancouver family days, in Chinese and English.",
  url: SITE_URL + "/routes/",
  nav: "routes",
  jsonld: { "@context": "https://schema.org", "@type": "CollectionPage", name: "周末路线 Day routes", url: SITE_URL + "/routes/" },
  main: `<section class="section"><div class="wrap"><div class="section-head"><div><h1>排好的一天</h1><p lang="zh-CN">每条路线只做一种天气和一个方向。</p><p class="alt-lang" lang="en">Each route keeps to one kind of weather and one direction.</p></div></div><div class="routes">${SITE.routes.map(routeCard).join("")}</div></div></section>`
}));

SITE.routes.forEach((r) => {
  const en = COPY.routes[r.id];
  write(`route/${r.id}/index.html`, page({
    title: `${r.zh} ${en.title} | 山海周末`,
    description: `${r.blurb} ${en.blurb}`,
    url: `${SITE_URL}/route/${r.id}/`,
    nav: "routes",
    jsonld: { "@context": "https://schema.org", "@type": "TouristTrip", name: `${r.zh} ${en.title}`, description: `${r.blurb} ${en.blurb}`, url: `${SITE_URL}/route/${r.id}/` },
    main: routeMain(r)
  }));
});

const indoor = SITE.places.filter((p) => p.indoor);
write("rain/index.html", page({
  title: "下雨去哪 Rainy-day outings | 山海周末",
  description: "大温下雨也能出门的室内地方。Indoor and covered family places around Greater Vancouver for a rainy weekend.",
  url: SITE_URL + "/rain/",
  nav: "rain",
  jsonld: { "@context": "https://schema.org", "@type": "CollectionPage", name: "下雨去哪 Rainy-day outings", url: SITE_URL + "/rain/" },
  main: `<section class="section"><div class="wrap"><div class="section-head"><div><h1>下雨的时候</h1><p lang="zh-CN">这些地方有屋顶，或者本身就在室内。</p><p class="alt-lang" lang="en">These places have a roof, or they are indoors.</p></div></div><p class="result-line">${indoor.length} 个地方 places</p><div class="grid">${indoor.map(card).join("")}</div></div></section>`
}));

write("saved/index.html", page({
  title: "想去 Saved places | 山海周末",
  description: "保存在这台浏览器里的想去清单。Places you saved in this browser.",
  url: SITE_URL + "/saved/",
  nav: "saved",
  robots: "noindex, follow",
  jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: "想去 Saved places", url: SITE_URL + "/saved/" },
  main: `<section class="section"><div class="wrap"><div class="section-head"><div><h1>想去 Saved</h1><p lang="zh-CN">保存在这台浏览器里，不会上传。</p><p class="alt-lang" lang="en">Kept in this browser only. Nothing is uploaded.</p></div></div><div class="grid" id="saved-grid"></div><div class="empty" id="saved-empty"><h2>还没有收藏 Nothing saved yet</h2><p lang="zh-CN">在地点上点「想去」，留给下个放晴的周六。</p><p class="alt-lang" lang="en">Tap Save on a place and keep it for the next clear Saturday.</p></div></div></section>`
}));

const mapMarkers = [];
const unmapped = [];
SITE.places.forEach((p) => {
  const hit = PLACE_COORDS[p.id];
  const c = cityBy(p.city);
  if (!hit || typeof hit.lat !== "number" || typeof hit.lng !== "number") {
    unmapped.push(p);
    return;
  }
  mapMarkers.push({ id: p.id, zh: p.zh, en: p.en, lat: hit.lat, lng: hit.lng, cityZh: c.zh, cityEn: c.en });
});
const markerJson = JSON.stringify(mapMarkers).replace(/</g, "\\u003c");
const unmappedNote = unmapped.length
  ? `<p lang="zh-CN">${unmapped.length} 个地点没有查到可靠坐标，没有放上地图。</p><p class="alt-lang" lang="en">${unmapped.length} places had no reliable OpenStreetMap match, so they are not pinned.</p>`
  : "";
write("map/index.html", page({
  title: "出门地图 Map | 山海周末 Shanhai Weekend",
  description: "大温家庭出门地点的可缩放地图。标记来自 OpenStreetMap 对现有地点的检索。A zoomable map of the family outings, with markers from OpenStreetMap.",
  url: SITE_URL + "/map/",
  nav: "map",
  extraHead: '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />',
  extraFoot: '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script src="/map.js"></script>',
  jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: "出门地图 Map", url: SITE_URL + "/map/" },
  main: `<section class="section"><div class="wrap">
    <div class="section-head"><div><h1>出门地图</h1><p lang="zh-CN">可以缩放、拖动。点标记能看到中文名和英文名，再进详情。</p><p class="alt-lang" lang="en">Zoom and drag. A marker shows the Chinese and English names, then opens the place.</p></div><a href="/">全部地点 All places</a></div>
    <p id="map-status" class="map-status" hidden>地图没有加载出来。</p>
    <div id="outing-map" role="region" aria-label="出门地图 Outing map"></div>
    <script type="application/json" id="map-markers">${markerJson}</script>
    ${unmappedNote}
    <p class="result-line">${mapMarkers.length} 个标记 markers</p>
    <div class="grid" id="place-grid">${SITE.places.map(card).join("")}</div>
  </div></section>`
}));

function contactLine() {
  if (!PUBLIC.contactEmail) {
    return `<p lang="zh-CN">运营者还没有公布联系邮箱。</p><p lang="en">The operator has not published a contact email yet.</p>`;
  }
  return `<p>联系 Contact: <a href="mailto:${esc(PUBLIC.contactEmail)}">${esc(PUBLIC.contactEmail)}</a></p>`;
}
const communityFoot = '<script src="/community-rules.js"></script><script type="module" src="/community.js"></script>';
write("activities/index.html", page({
  title: "结伴出门 Activities | 山海周末",
  description: "浏览大温家庭结伴活动。不注册也可以看地点。注册后才能参加。Browse family outings. An account is required only to join.",
  url: SITE_URL + "/activities/",
  nav: "activities",
  extraFoot: communityFoot,
  jsonld: { "@context": "https://schema.org", "@type": "CollectionPage", name: "结伴出门 Activities", url: SITE_URL + "/activities/" },
  main: `<section class="section"><div class="wrap">
    ${illustration(SCENES.plan, "插画：几位朋友在公园里一起看地图，规划周末出门。不是真实会员的照片。Illustration of friends looking at a map and planning a weekend outing. Not a photograph of real members.", "插画示意，不是真实会员。Illustration, not a photograph of real members.")}
    <h1>结伴出门</h1>
    <p class="lede" lang="zh-CN">浏览地点和公开活动不需要账户。第一位参加者加入后，群聊仍然锁着。第二位不同的人确认报名后，群聊才会打开。集合点只给已报名的人看。</p>
    <p class="alt-lang" lang="en">You can browse places and public activities without an account. Chat stays locked after the first person joins. It opens when a second, different person confirms. The meeting point is shown only to people who joined.</p>
    ${ctaBand()}
    <div id="activity-list"></div>
  </div></section>`
}));
write("activities/view/index.html", page({
  title: "结伴活动 Activity | 山海周末",
  description: "查看一次结伴活动的时间、地点、参加者和群聊状态。Activity time, place, participants, and chat status.",
  url: SITE_URL + "/activities/view/",
  nav: "activities",
  robots: "noindex, follow",
  extraFoot: communityFoot,
  jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: "结伴活动 Activity", url: SITE_URL + "/activities/view/" },
  main: `<section class="section"><div class="wrap" id="activity-root"></div></section>`
}));
write("account/index.html", page({
  title: "注册账户 Account | 山海周末",
  description: "注册或登录山海周末。浏览地点不需要账户。Create or sign in to an account. Browsing places does not require one.",
  url: SITE_URL + "/account/",
  nav: "activities",
  robots: "noindex, follow",
  extraFoot: communityFoot,
  jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: "账户 Account", url: SITE_URL + "/account/" },
  main: `<section class="section"><div class="wrap">
    ${illustration(SCENES.water, "插画：朋友和家人一起在水边散步。不是真实会员的照片。Illustration of friends and family walking by the water. Not a photograph of real members.", "插画示意，不是真实会员。Illustration, not a photograph of real members.")}
    <h1>账户 Account</h1>
    <p class="lede" lang="zh-CN">看地点、地图和路线不需要注册。免费报名要等加拿大的账户服务接上之后才能用。</p>
    <p class="alt-lang" lang="en">Places, the map, and routes do not need an account. Free joining waits until the Canadian account service is connected.</p>
    ${ctaBand()}
    <div id="account-root"></div>
  </div></section>`
}));
write("privacy/index.html", page({
  title: "隐私说明 Privacy | 山海周末",
  description: "山海周末如何处理浏览记录、账户、活动和群聊信息。How Shanhai Weekend handles browsing, accounts, activities, and chat.",
  url: SITE_URL + "/privacy/",
  nav: "home",
  jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: "隐私说明 Privacy", url: SITE_URL + "/privacy/" },
  main: `<section class="section"><article class="wrap legal"><h1>隐私说明 Privacy</h1>
    <p lang="zh-CN">这份说明按不列颠哥伦比亚省《个人资料保护法》（PIPA）和加拿大联邦《个人信息保护和电子文件法》（PIPEDA）的要求来写。它不是律师意见。运营者应把法定名称和联系方式补在下面。</p>
    <p lang="en">This notice is written for British Columbia's Personal Information Protection Act and Canada's PIPEDA. It is not legal advice. The operator should add their legal name and contact details below.</p>
    <h2>只浏览 Browsing</h2>
    <p lang="zh-CN">看地点、地图和路线不需要注册。「想去」保存在你这台浏览器里，不会上传。</p>
    <p lang="en">Reading places, the map, and routes does not require an account. Saved places stay in this browser and are not uploaded.</p>
    <h2>账户与活动 Accounts and activities</h2>
    <p lang="zh-CN">注册和群聊现在没有开放。将来开放后，才会保存邮箱、显示名、报名和已解锁群聊里的消息。这些资料不会对公众公开。邮箱不会展示给其他参加者。密码由账户服务保存，网站页面不保存密码明文。</p>
    <p lang="en">Registration and chat are not open. If they open later, the account service would store an email, display name, registrations, and messages from an unlocked chat. Those records are not public. An email is not shown to other participants. The website does not keep a plaintext password.</p>
    <h2>群聊 Chat</h2>
    <p lang="zh-CN">群聊在第二位不同的参加者确认报名后才打开。只有这次活动的已报名参加者能读消息。实时连接在下一条消息时重新核对同一条规则：退出、取消活动，或已经看不到任何未屏蔽的参加者之后，新消息不再送达。两人互相屏蔽时，双方都看不到对方的消息；如果还有其他已报名的参加者，他们仍可以继续聊天。举报只交给运营者，其他参加者看不到，并应在 12 个月内删除。</p>
    <p lang="en">Chat opens after a second, different person confirms. Only confirmed participants of that activity can read messages. A live subscription is checked again on the next message. After someone leaves, the activity is cancelled, or a person has no unblocked participant left, new messages are not delivered. A block hides that pair in both directions. Other confirmed participants can keep chatting. Reports go only to the operator, are not shown to other participants, and should be deleted after 12 months.</p>
    <h2>营销邮件 Marketing email</h2>
    <p lang="zh-CN">活动通知邮件默认不发送，并且和报名是分开的。只有你另外勾选之后才会收到，并可以要求停止。网站没有把任何人同步到 GoHighLevel 或其他营销系统。这是为了符合加拿大反垃圾邮件法（CASL）。</p>
    <p lang="en">Outing emails are off unless you opt in separately from joining an activity. You can ask to stop them. The site does not synchronize anyone to GoHighLevel or another marketing system. This is meant to meet Canada's anti-spam law.</p>
    <h2>计划中的保存地点 Planned storage</h2>
    <p lang="zh-CN">账户数据库是加拿大区域（ca-central-1）的 Supabase 项目。网站还没有接上它，所以现在不会把邮箱、报名或群聊送到那里。接上之后，这些资料保存在加拿大，并且不对公众公开。这一页并不表示网站用到的每一项服务都在加拿大。地图图块来自 OpenStreetMap，字体来自 Google。这两项，以及你若同意才加载的 Google Analytics，都可能在加拿大以外处理连接信息。验证邮件由 Supabase 的邮件服务发出，该路径是否全程留在加拿大尚未核实。</p>
    <p lang="en">The account database is a Supabase project in Canada (ca-central-1). The website is not connected to it yet, so it does not send email addresses, registrations, or chat there. After it is connected, those records are stored in Canada and are not public. This page does not mean every service the website uses is in Canada. Map tiles come from OpenStreetMap and fonts come from Google. Those services, and Google Analytics if you accept it, can process connection data outside Canada. Confirmation email is sent by Supabase's mail service, and that path has not been verified to stay in Canada.</p>
    <h2>网站分析 Analytics</h2>
    <p lang="zh-CN">Google Analytics 默认不加载。只有你在这台浏览器里另外同意之后才会加载，并可以拒绝。这和账户里的活动邮件选项是两件事。</p>
    <p lang="en">Google Analytics does not load unless you accept it in this browser. You can refuse. That choice is separate from the optional outing-email checkbox on an account.</p>
    <h2>保存期限与删除 Retention and deletion</h2>
    <p lang="zh-CN">你可以在账户页申请删除。数据库处理和登录关闭是分开的两步，都会写进只有运营者能看的审计记录。登录服务那一步成功之前，删除不算完成。如果那一步失败，运营者会重试登录关闭，而不会把数据库步骤再做一遍。数据库步骤会先停用这个账户，因此报名、群聊和实时消息会在下一次核对时停掉，并删掉该账户自己的报名和群聊消息。如果这个人发起的活动还有其他人参加，活动会被取消，发起人改成最早的另一位参加者。其他人的报名和消息会留下。没有未结案的安全举报时，运营者再用 Supabase 的 Auth Admin API 删除登录并撤销刷新会话；这一步成功之后，资料档案才删除。如果未结案的安全举报涉及这个账户，显示名会被替换，资料会保持锁定，运营者再用 Auth Admin API 软删除登录，使这个人不能再登录。举报和一份只有运营者能看的消息副本会留下，其中包含用户编号和消息正文。这些仍然是个人资料。举报结案时副本会删除；未结案的副本最晚在 12 个月时随举报一起删除。已经发出的访问令牌在过期前技术上仍可能存在，但数据库会立刻拒绝被锁定的账户。网站页面不包含 service role 密钥。</p>
    <p lang="en">You can request deletion from the account page. Database removal and login closure are separate steps, and both are written to an audit record only the operator can see. Deletion is not fully completed until the login step succeeds. If that step fails, the operator retries the login closure and does not repeat the database removal. The database step blocks the account first, so registrations, chat, and Realtime stop on the next check, and it removes that account's own registrations and chat messages. If the person created an activity that someone else joined, the activity is cancelled and ownership moves to the earliest other participant. Other people's registrations and messages stay. With no open safety report, the operator then deletes the login through Supabase's Auth Admin API, which also revokes refresh sessions. The profile is removed only after that call succeeds. If an open safety report involves the account, the display name is replaced and the profile stays blocked. The operator soft-deletes the login through the Auth Admin API so the person cannot sign in. The report and a private copy of the reported message are kept, including the user id and the message text. That copy is still personal information. Only the operator can see it. The copy is deleted when the report is resolved. An unresolved copy is deleted with the report after 12 months. An access token that was already issued can remain technically valid until it expires, but the database rejects the blocked account immediately. The website does not contain the service-role key.</p>
    ${contactLine()}
  </article></section>`
}));
write("terms/index.html", page({
  title: "使用条款 Terms | 山海周末",
  description: "使用山海周末指南和结伴功能的条款。Terms for using the guide and group activities.",
  url: SITE_URL + "/terms/",
  nav: "home",
  jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: "使用条款 Terms", url: SITE_URL + "/terms/" },
  main: `<section class="section"><article class="wrap legal"><h1>使用条款 Terms</h1>
    <p lang="zh-CN">山海周末提供家庭出门信息，不卖票，也不保证公园、道路或商家当天仍然开放。出门前请核对官方页面，并按自己的经验和天气做决定。</p>
    <p lang="en">Shanhai Weekend publishes family outing information. It does not sell tickets and does not promise that a park, road, or business is open that day. Check the official page and decide based on your own experience and the weather.</p>
    <h2>账户 Accounts</h2>
    <p lang="zh-CN">注册表示你已满 18 岁，或由监护人负责这个账户。你需要使用真实邮箱完成验证。不要注册别人的邮箱，也不要重复报名同一次活动。</p>
    <p lang="en">Creating an account means you are 18 or older, or a guardian is responsible for the account. Use an email address you can verify. Do not register someone else's email, and do not join the same activity twice.</p>
    <h2>结伴与取消 Activities and cancellation</h2>
    <p lang="zh-CN">活动由用户发起。发起人可以取消活动。参加者可以取消自己的报名。取消之后，如果确认人数少于两人，群聊会重新锁上。</p>
    <p lang="en">Users create activities. The creator can cancel an activity, and a participant can cancel their own place. If fewer than two people remain confirmed, the chat locks again.</p>
    <h2>责任 Limits</h2>
    <p lang="zh-CN">见面请选公共场所。网站不核对照片或身份，也不负责参加者之间的约定、交通或安全。运营者可以删除违反社区准则的活动和消息。</p>
    <p lang="en">Meet in public places. The site does not verify identity and is not responsible for arrangements, transport, or safety between participants. The operator may remove activities and messages that break the community guidelines.</p>
    ${contactLine()}
  </article></section>`
}));
write("guidelines/index.html", page({
  title: "社区准则 Guidelines | 山海周末",
  description: "山海周末结伴活动的安全约定。Safety rules for Shanhai Weekend activities.",
  url: SITE_URL + "/guidelines/",
  nav: "home",
  jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: "社区准则 Guidelines", url: SITE_URL + "/guidelines/" },
  main: `<section class="section"><article class="wrap legal"><h1>社区准则 Guidelines</h1>
    <p lang="zh-CN">结伴是为了一起去公共的公园、馆和海滩。请对孩子和其他家庭保持尊重。</p>
    <p lang="en">Activities are for visiting public parks, museums, and beaches together. Be respectful to children and other families.</p>
    <ul>
      <li lang="zh-CN">在公共场所见面，并自己决定是否前往。不要把集合点改到私人住宅。</li>
      <li lang="en">Meet in public and decide for yourself whether to go. Do not move the meeting to a private home.</li>
      <li lang="zh-CN">孩子由自己的监护人负责。不要单独约未成年人。</li>
      <li lang="en">A child's own guardian is responsible for them. Do not arrange to meet a minor alone.</li>
      <li lang="zh-CN">不要在群聊里公布别人的电话、邮箱或住址。自己的联系方式也只在你愿意时才发。</li>
      <li lang="en">Do not post another person's phone number, email, or home address. Share your own only if you choose to.</li>
      <li lang="zh-CN">禁止骚扰、仇恨、诈骗，以及任何涉及未成年人的性内容。</li>
      <li lang="en">Harassment, hate, scams, and any sexual content involving minors are prohibited.</li>
      <li lang="zh-CN">不舒服时，使用屏蔽和举报。举报内容不会公开给其他参加者。</li>
      <li lang="en">Use block and report when something feels wrong. Reports are not shown to other participants.</li>
    </ul>
    ${contactLine()}
  </article></section>`
}));

const urls = ["/", "/map/", "/routes/", "/rain/", "/activities/", "/privacy/", "/terms/", "/guidelines/"];
SITE.cities.forEach((c) => urls.push(`/city/${c.id}/`));
SITE.places.forEach((p) => urls.push(`/place/${p.id}/`));
SITE.routes.forEach((r) => urls.push(`/route/${r.id}/`));
const today = new Date().toISOString().slice(0, 10);
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
write("places.json", JSON.stringify(SITE.places.map((p) => ({ id: p.id, zh: p.zh, en: p.en, summary: p.summary }))));

["styles.css", "favicon.svg", "enhance.js", "map.js", "community.js", "community-rules.js"].forEach((file) => {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
});
fs.cpSync(path.join(root, "images"), path.join(dist, "images"), { recursive: true });

const missing = SITE.places.filter((p) => !PLACE_EN[p.id]).map((p) => p.id);
console.log(`pages ${urls.length} missing-en ${missing.length}`);
if (missing.length) console.log(missing.join(","));
