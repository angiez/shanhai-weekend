(function () {
  const SITE = window.SITE;
  const places = SITE.places;
  const COST = ["免费", "人均约 20 加元内", "人均约 20–50 加元", "人均 50 加元以上"];
  const AGE = { toddler: "幼儿", kid: "小学生", teen: "青少年" };
  const state = {
    q: "",
    cat: "",
    maxCost: "",
    stroller: false,
    openNow: false,
    saved: loadSaved()
  };

  const main = document.getElementById("main");
  const qInput = document.getElementById("q");
  const savedCount = document.getElementById("saved-count");
  const navToggle = document.getElementById("nav-toggle");
  const mobileNav = document.getElementById("mobile-nav");

  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem("shanhai-saved") || "[]");
    } catch (e) {
      return [];
    }
  }

  function persist() {
    localStorage.setItem("shanhai-saved", JSON.stringify(state.saved));
    savedCount.textContent = String(state.saved.length);
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function month() {
    return new Date().getMonth() + 1;
  }

  function monthName() {
    return ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"][month() - 1];
  }

  function openMonths(p) {
    return p.open === "all" ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : p.open;
  }

  function isOpen(p, m) {
    return openMonths(p).includes(m || month());
  }

  function isBest(p, m) {
    return (p.best || []).includes(m || month());
  }

  function cityBy(id) {
    return SITE.cities.find(function (c) { return c.id === id; });
  }

  function catBy(id) {
    return SITE.cats.find(function (c) { return c.id === id; });
  }

  function placeBy(id) {
    return places.find(function (p) { return p.id === id; });
  }

  function seasonLabel(p) {
    if (!isOpen(p)) return "这个月通常关闭";
    if (isBest(p)) return "这个月正合适";
    if (p.open === "all") return "全年可去";
    return "本月开放";
  }

  function monthsText(list) {
    return list.map(function (n) { return n; }).join("、") + " 月";
  }

  function seasonSentence(p) {
    if (p.open === "all" && !(p.best || []).length) return "全年都可以去。";
    if (p.open === "all") return "全年可去，" + monthsText(p.best) + "更合适。";
    return monthsText(p.open) + "开放。出发前再对一下当年日历。";
  }

  function parse() {
    const raw = (location.hash || "#/").replace(/^#/, "");
    return raw.split("/").filter(Boolean);
  }

  function filtered(extra) {
    const opt = extra || {};
    const q = state.q.trim().toLowerCase();
    const m = month();
    return places.filter(function (p) {
      if (opt.city && p.city !== opt.city) return false;
      if (opt.indoor && !p.indoor) return false;
      if (state.cat && p.cat !== state.cat) return false;
      if (state.stroller && !p.stroller) return false;
      if (state.openNow && !isOpen(p, m)) return false;
      if (state.maxCost !== "" && p.cost > Number(state.maxCost)) return false;
      if (q) {
        const c = cityBy(p.city);
        const blob = [p.zh, p.en, p.summary, p.body, c.zh, c.en, catBy(p.cat).zh]
          .concat(p.alias || [], p.tips || [])
          .join(" ")
          .toLowerCase();
        if (blob.indexOf(q) === -1) return false;
      }
      return true;
    }).sort(function (a, b) {
      const d = (isBest(b) ? 1 : 0) - (isBest(a) ? 1 : 0);
      if (d) return d;
      return a.zh.localeCompare(b.zh, "zh");
    });
  }

  function card(p) {
    const c = cityBy(p.city);
    const saved = state.saved.indexOf(p.id) !== -1;
    const badges = [
      '<span class="badge' + (isBest(p) ? " hot" : "") + '">' + esc(seasonLabel(p)) + "</span>",
      '<span class="badge' + (p.cost === 0 ? " free" : " dim") + '">' + esc(COST[p.cost]) + "</span>"
    ];
    if (p.indoor) badges.push('<span class="badge dim">室内</span>');
    return (
      '<article class="card">' +
      '<button class="save' + (saved ? " on" : "") + '" type="button" data-save="' + esc(p.id) + '">' +
      (saved ? "已想去" : "想去") + "</button>" +
      '<a class="card-link" href="#/p/' + esc(p.id) + '">' +
      '<div class="badges">' + badges.join("") + "</div>" +
      "<h3>" + esc(p.zh) + "</h3>" +
      '<p class="en">' + esc(p.en) + " · " + esc(c.zh) + " " + esc(c.en) + "</p>" +
      '<p class="summary">' + esc(p.summary) + "</p>" +
      '<p class="meta"><span>' + esc(catBy(p.cat).zh) + "</span><span>" + esc(p.duration) + "</span></p>" +
      "</a></article>"
    );
  }

  function horizon() {
    return (
      '<svg class="horizon-svg" viewBox="0 0 420 96" aria-hidden="true">' +
      '<rect width="420" height="96" fill="#f7f1e6"/>' +
      '<circle cx="338" cy="28" r="12" fill="#e7a23a"/>' +
      '<path d="M0 62 L48 40 L78 54 L132 24 L168 50 L214 30 L268 58 L318 34 L372 56 L420 28 L420 96 L0 96 Z" fill="#1d4e4a"/>' +
      '<path d="M0 74 C70 64 120 86 210 74 C300 62 340 84 420 70 L420 96 L0 96 Z" fill="#e25b3a"/>' +
      "</svg>"
    );
  }

  function tickets() {
    const prefer = ["hatchery", "capilano", "tynehead", "reifel", "shannon", "whiterock-pier", "stanley", "vandusen", "maplewood", "fort-langley"];
    const picks = [];
    prefer.forEach(function (id) {
      const p = placeBy(id);
      if (p && isOpen(p) && isBest(p) && picks.length < 3) picks.push(p);
    });
    places.forEach(function (p) {
      if (picks.length >= 3 || picks.indexOf(p) !== -1) return;
      if (isOpen(p) && isBest(p)) picks.push(p);
    });
    return picks.map(function (p, i) {
      const c = cityBy(p.city);
      return (
        '<a class="ticket" href="#/p/' + esc(p.id) + '">' +
        '<div class="stamp">' + esc(monthName()) + "月<br>合适</div>" +
        "<div><p class=\"when\">0" + (i + 1) + " · " + esc(c.zh) + " " + esc(c.en) + "</p>" +
        "<h3>" + esc(p.zh) + "</h3><p>" + esc(p.summary) + "</p></div>" +
        '<span class="go">去看</span></a>'
      );
    }).join("");
  }

  function cityChips(active) {
    return SITE.regions.map(function (r) {
      const list = SITE.cities.filter(function (c) { return c.region === r.id; });
      const chips = list.map(function (c) {
        const n = places.filter(function (p) { return p.city === c.id; }).length;
        const pressed = active === c.id ? ' aria-pressed="true"' : "";
        return '<a class="city-chip" href="#/c/' + esc(c.id) + '"' + pressed + "><b>" + esc(c.zh) + "</b><span>" + esc(c.en) + " · " + n + "</span></a>";
      }).join("");
      return '<section class="region"><header><h3>' + esc(r.zh) + "</h3><small>" + esc(r.en) + "</small></header><div class=\"city-row\">" + chips + "</div></section>";
    }).join("");
  }

  function filters(cityId) {
    const cats = '<button class="chip" type="button" data-cat=""' + (state.cat === "" ? ' aria-pressed="true"' : "") + ">全部玩法</button>" +
      SITE.cats.map(function (c) {
        return '<button class="chip" type="button" data-cat="' + esc(c.id) + '"' + (state.cat === c.id ? ' aria-pressed="true"' : "") + ">" + esc(c.zh) + "</button>";
      }).join("");
    const costs = [
      ["", "不限花费"],
      ["0", "只看免费"],
      ["1", "小花费以内"],
      ["2", "50 加元以内"]
    ].map(function (pair) {
      return '<button class="chip" type="button" data-cost="' + pair[0] + '"' + (String(state.maxCost) === pair[0] ? ' aria-pressed="true"' : "") + ">" + pair[1] + "</button>";
    }).join("");
    return (
      '<div class="filters" id="browse">' +
      '<div class="filter-row">' + cats + "</div>" +
      '<div class="filter-row">' + costs +
      '<button class="chip" type="button" data-toggle="stroller"' + (state.stroller ? ' aria-pressed="true"' : "") + ">推车友好</button>" +
      '<button class="chip" type="button" data-toggle="openNow"' + (state.openNow ? ' aria-pressed="true"' : "") + ">这个月开着</button>" +
      '<button class="chip" type="button" data-random="1">随机一个</button>' +
      (cityId ? '<a class="chip" href="#/">全部城市</a>' : "") +
      "</div></div>"
    );
  }

  function renderHome(cityId) {
    const city = cityId ? cityBy(cityId) : null;
    if (cityId && !city) {
      main.innerHTML = '<section class="section"><div class="wrap"><p>没有这座城。</p></div></section>';
      return;
    }
    const list = filtered({ city: cityId || "" });
    const banner = city
      ? '<section class="city-banner"><div><p class="en">' + esc(city.en) + "</p><h2>" + esc(city.zh) + "</h2><p>" + esc(city.blurb) + "</p></div><div><p><strong>怎么去</strong> " + esc(city.getting) + "</p><p><strong>吃</strong> " + esc(city.eat) + "</p></div></section>"
      : "";
    const hero = city ? "" : (
      '<section class="hero"><div class="wrap hero-grid"><div>' +
      '<p class="kicker">' + esc(monthName()) + "月 · 大温</p>" +
      "<h1>山海周末</h1>" +
      '<p class="lede">从史提夫斯顿的码头走到格罗斯山的雪线。按城市找公园、博物馆、农场和一日游，中英地名放在一起，下雨也有地方去。</p>' +
      '<div class="hero-actions"><a class="btn sea" href="#/routes">看十二条路线</a><a class="btn ghost" href="#/rain">下雨的时候</a></div>' +
      "<ul class=\"stats\"><li><strong>" + places.length + "</strong><span>个地方</span></li><li><strong>" + SITE.cities.length + "</strong><span>座城市</span></li><li><strong>" + SITE.routes.length + "</strong><span>条路线</span></li></ul>" +
      "</div><div class=\"ticket-stack\">" + horizon() + tickets() + "</div></div></section>" +
      '<section class="section"><div class="wrap"><div class="section-head"><div><h2>先选一座城</h2><p>英文地名旁边写着大家平时怎么叫它。</p></div></div><div class="regions">' + cityChips(cityId) + "</div></div></section>"
    );
    const head = city
      ? '<section class="section"><div class="wrap">' + banner + filters(cityId) + '<p class="result-line">' + list.length + " 个地方</p><div class=\"grid\">" + (list.map(card).join("") || empty()) + "</div></div></section>"
      : '<section class="section"><div class="wrap"><div class="section-head"><div><h2>全部地方</h2><p>当季的排在前面。票价和开放日出门前再确认一次。</p></div></div>' + filters("") + '<p class="result-line">' + list.length + " 个地方</p><div class=\"grid\">" + (list.map(card).join("") || empty()) + "</div></div></section>" +
        '<section class="section"><div class="wrap"><div class="section-head"><div><h2>排好的一天</h2><p>不想自己拼的时候，按这条走。</p></div><a href="#/routes">全部路线</a></div><div class="routes">' + routeCards(4) + "</div></div></section>";
    main.innerHTML = hero + head;
    markNav("home");
  }

  function empty() {
    return '<div class="empty"><h2>这组条件下面没有地方</h2><p>放宽花费，或换一座城。</p></div>';
  }

  function routeCards(limit) {
    const list = limit ? SITE.routes.slice(0, limit) : SITE.routes;
    return list.map(function (r, i) {
      const names = r.cities.map(function (id) { return cityBy(id).zh; }).join("、");
      return '<a class="route" href="#/r/' + esc(r.id) + '"><div class="num">' + String(i + 1).padStart(2, "0") + '</div><div><p>' + esc(r.days) + " · " + esc(names) + "</p><h3>" + esc(r.zh) + "</h3><p>" + esc(r.blurb) + "</p></div></a>";
    }).join("");
  }

  function renderRoutes() {
    main.innerHTML = '<section class="section"><div class="wrap"><div class="section-head"><div><h2>排好的一天</h2><p>每条路线只做一件天气和一座方向，不把吊桥、动物园和渡轮塞进同一个周六。</p></div></div><div class="routes">' + routeCards() + "</div></div></section>";
    markNav("routes");
  }

  function renderRoute(id) {
    const r = SITE.routes.find(function (item) { return item.id === id; });
    if (!r) {
      main.innerHTML = '<section class="section"><div class="wrap"><p>没有这条路线。</p></div></section>';
      return;
    }
    const steps = r.steps.map(function (s) {
      const p = placeBy(s.place);
      const title = p ? '<a href="#/p/' + esc(p.id) + '">' + esc(p.zh) + "</a>" : esc(s.place);
      return "<li><strong>" + esc(s.time) + "</strong><div><h3>" + title + "</h3><p>" + esc(s.note) + "</p></div></li>";
    }).join("");
    main.innerHTML =
      '<section class="detail"><div class="wrap"><p class="crumb"><a href="#/routes">路线</a> / ' + esc(r.zh) + "</p>" +
      "<h1>" + esc(r.zh) + "</h1><p class=\"en\">" + esc(r.days) + "</p><p class=\"lede\">" + esc(r.blurb) + "</p>" +
      '<div class="detail-layout"><article class="panel"><h2>怎么排</h2><ul class="plan-list">' + steps + "</ul></article>" +
      '<aside class="panel"><h2>涉及的城</h2><div class="nearby">' +
      r.cities.map(function (cid) {
        const c = cityBy(cid);
        return '<a href="#/c/' + esc(c.id) + '"><span>' + esc(c.zh) + " " + esc(c.en) + "</span><span>进入</span></a>";
      }).join("") +
      "</div></aside></div></div></section>";
    markNav("routes");
  }

  function renderPlace(id) {
    const p = placeBy(id);
    if (!p) {
      main.innerHTML = '<section class="section"><div class="wrap"><p>没有找到这个地方。</p></div></section>';
      return;
    }
    const c = cityBy(p.city);
    const saved = state.saved.indexOf(p.id) !== -1;
    const ages = (p.ages || []).map(function (a) { return AGE[a] || a; }).join("、");
    const nearby = places.filter(function (o) { return o.city === p.city && o.id !== p.id; }).slice(0, 4);
    const web = p.web ? '<p><a href="' + esc(p.web) + '" target="_blank" rel="noopener">官方网站</a></p>' : "";
    const note = !isOpen(p)
      ? '<div class="note">这个月通常不开放。页面留着，是为了你规划下一季。</div>'
      : (isBest(p) ? '<div class="note">以现在的月份，这里正是值得出门的时候。</div>' : "");
    main.innerHTML =
      '<section class="detail"><div class="wrap"><p class="crumb"><a href="#/">地图</a> / <a href="#/c/' + esc(c.id) + '">' + esc(c.zh) + "</a> / " + esc(p.zh) + "</p>" +
      '<div class="detail-hero"><p class="kicker">' + esc(catBy(p.cat).zh) + " · " + esc(c.zh) + " " + esc(c.en) + "</p><h1>" + esc(p.zh) + "</h1><p class=\"en\">" + esc(p.en) + "</p><p class=\"lede\">" + esc(p.summary) + "</p>" +
      '<div class="place-actions"><button class="btn sea" type="button" data-save="' + esc(p.id) + '">' + (saved ? "已放进想去" : "放进想去") + '</button><a class="btn ghost" href="#/c/' + esc(c.id) + '">这座城的其他地方</a></div></div>' +
      note +
      '<div class="detail-layout"><article class="panel"><h2>去之前知道这些</h2><p>' + esc(p.body) + "</p><h2 style=\"margin-top:18px\">现场提示</h2><ul class=\"tips\">" +
      p.tips.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
      "</ul>" + web + "</article><aside class=\"panel\"><h2>实用信息</h2><div class=\"facts\">" +
      fact("花费", COST[p.cost]) +
      fact("停留", p.duration) +
      fact("季节", seasonSentence(p)) +
      fact("适合", ages || "全家") +
      fact("推车", p.stroller ? "主路可以" : "不适合") +
      fact("天气", p.indoor ? "室内能待住" : "主要在室外") +
      fact("地址", p.address) +
      fact("交通", p.transit) +
      "</div><h2 style=\"margin-top:18px\">同城附近</h2><div class=\"nearby\">" +
      nearby.map(function (o) {
        return '<a href="#/p/' + esc(o.id) + '"><span>' + esc(o.zh) + "</span><span>" + esc(COST[o.cost]) + "</span></a>";
      }).join("") +
      "</div></aside></div></div></section>";
    markNav("home");
  }

  function fact(k, v) {
    return '<div class="fact"><b>' + esc(k) + "</b><span>" + esc(v) + "</span></div>";
  }

  function renderRain() {
    const list = filtered({ indoor: true }).filter(function (p) { return p.indoor; });
    main.innerHTML =
      '<section class="section"><div class="wrap"><div class="section-head"><div><h2>下雨的时候</h2><p>大温的雨是默认天气。这些地方有屋顶，或者本身就在室内。</p></div></div>' +
      '<p class="result-line">' + list.length + " 个地方</p><div class=\"grid\">" + list.map(card).join("") + "</div></div></section>";
    markNav("rain");
  }

  function renderSaved() {
    const list = state.saved.map(placeBy).filter(Boolean);
    main.innerHTML =
      '<section class="section"><div class="wrap"><div class="section-head"><div><h2>想去</h2><p>保存在这台浏览器里，不会上传。</p></div></div>' +
      (list.length ? '<div class="grid">' + list.map(card).join("") + "</div>" : '<div class="empty"><h2>还没有收藏</h2><p>在卡片上点「想去」，留给下个放晴的周六。</p></div>') +
      "</div></section>";
    markNav("saved");
  }

  function markNav(name) {
    document.querySelectorAll(".nav a").forEach(function (a) {
      if (a.dataset.nav === name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    savedCount.textContent = String(state.saved.length);
  }

  function render() {
    const parts = parse();
    const head = parts[0] || "";
    if (head === "p") renderPlace(parts[1]);
    else if (head === "c") renderHome(parts[1]);
    else if (head === "routes") renderRoutes();
    else if (head === "r") renderRoute(parts[1]);
    else if (head === "rain") renderRain();
    else if (head === "saved") renderSaved();
    else renderHome("");
  }

  function toggleSave(id) {
    const i = state.saved.indexOf(id);
    if (i === -1) state.saved.push(id);
    else state.saved.splice(i, 1);
    persist();
    render();
  }

  document.getElementById("search-form").addEventListener("submit", function (e) {
    e.preventDefault();
  });

  qInput.addEventListener("input", function () {
    state.q = qInput.value;
    const head = parse()[0] || "";
    if (head === "p" || head === "r" || head === "routes" || head === "saved" || head === "rain") {
      location.hash = "#/";
    } else {
      render();
      qInput.focus();
    }
  });

  main.addEventListener("click", function (e) {
    const save = e.target.closest("[data-save]");
    if (save) {
      e.preventDefault();
      e.stopPropagation();
      toggleSave(save.dataset.save);
      return;
    }
    const cat = e.target.closest("[data-cat]");
    if (cat) {
      state.cat = cat.dataset.cat;
      render();
      return;
    }
    const cost = e.target.closest("[data-cost]");
    if (cost) {
      state.maxCost = cost.dataset.cost;
      render();
      return;
    }
    const toggle = e.target.closest("[data-toggle]");
    if (toggle) {
      state[toggle.dataset.toggle] = !state[toggle.dataset.toggle];
      render();
      return;
    }
    const random = e.target.closest("[data-random]");
    if (random) {
      const city = parse()[0] === "c" ? parse()[1] : "";
      const list = filtered({ city: city });
      if (!list.length) return;
      const pick = list[Math.floor(Math.random() * list.length)];
      location.hash = "#/p/" + pick.id;
    }
  });

  navToggle.addEventListener("click", function () {
    const open = mobileNav.hasAttribute("hidden");
    if (open) mobileNav.removeAttribute("hidden");
    else mobileNav.setAttribute("hidden", "");
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  mobileNav.addEventListener("click", function () {
    mobileNav.setAttribute("hidden", "");
    navToggle.setAttribute("aria-expanded", "false");
  });

  window.addEventListener("hashchange", function () {
    render();
    window.scrollTo(0, 0);
  });
  persist();
  render();
})();
