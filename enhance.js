(function () {
  const hash = location.hash || "";
  if (hash.indexOf("#/") === 0) {
    const parts = hash.slice(2).split("/").filter(Boolean);
    const head = parts[0];
    const id = parts[1];
    const dest = head === "p" && id ? "/place/" + id + "/"
      : head === "c" && id ? "/city/" + id + "/"
      : head === "r" && id ? "/route/" + id + "/"
      : head === "routes" ? "/routes/"
      : head === "rain" ? "/rain/"
      : head === "saved" ? "/saved/"
      : "";
    if (dest) {
      location.replace(dest);
      return;
    }
  }
  document.querySelectorAll("[data-until]").forEach(function (el) {
    const until = new Date(el.getAttribute("data-until") + "T23:59:59-08:00");
    if (!isNaN(until.getTime()) && Date.now() > until.getTime()) el.remove();
  });
  const key = "shanhai-saved";
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) { saved = []; }
  const count = document.getElementById("saved-count");
  const grid = document.getElementById("place-grid");
  const result = document.getElementById("result-line");
  const qInput = document.getElementById("q");

  function persist() {
    localStorage.setItem(key, JSON.stringify(saved));
    if (count) count.textContent = String(saved.length);
    document.querySelectorAll("[data-save]").forEach(function (btn) {
      const on = saved.indexOf(btn.dataset.save) !== -1;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      if (btn.classList.contains("save")) btn.textContent = on ? "已想去 Saved" : "想去 Save";
      if (btn.classList.contains("btn")) btn.textContent = on ? "已放进想去 Saved" : "放进想去 Save";
    });
  }

  function cards() {
    return grid ? Array.from(grid.querySelectorAll(".card")) : [];
  }

  function apply() {
    if (!grid) return;
    const q = (qInput && qInput.value || "").trim().toLowerCase();
    const cat = document.querySelector("[data-cat][aria-pressed='true']");
    const cost = document.querySelector("[data-cost][aria-pressed='true']");
    const stroller = document.querySelector("[data-toggle='stroller'][aria-pressed='true']");
    const openNow = document.querySelector("[data-toggle='openNow'][aria-pressed='true']");
    const catId = cat ? cat.dataset.cat : "";
    const maxCost = cost && cost.dataset.cost !== "" ? Number(cost.dataset.cost) : null;
    let shown = 0;
    cards().forEach(function (card) {
      let ok = true;
      if (catId && card.dataset.cat !== catId) ok = false;
      if (maxCost !== null && Number(card.dataset.cost) > maxCost) ok = false;
      if (stroller && card.dataset.stroller !== "1") ok = false;
      if (openNow && card.dataset.open !== "1") ok = false;
      if (q && card.dataset.blob.indexOf(q) === -1) ok = false;
      card.hidden = !ok;
      if (ok) shown += 1;
    });
    if (result) result.textContent = shown + " 个地方 places";
  }

  document.addEventListener("click", function (e) {
    const save = e.target.closest("[data-save]");
    if (save) {
      e.preventDefault();
      const id = save.dataset.save;
      const i = saved.indexOf(id);
      if (i === -1) saved.push(id); else saved.splice(i, 1);
      persist();
      if (location.pathname.indexOf("/saved") === 0) renderSaved();
      return;
    }
    const cat = e.target.closest("[data-cat]");
    if (cat) {
      document.querySelectorAll("[data-cat]").forEach(function (el) { el.removeAttribute("aria-pressed"); });
      cat.setAttribute("aria-pressed", "true");
      apply();
      return;
    }
    const cost = e.target.closest("[data-cost]");
    if (cost) {
      document.querySelectorAll("[data-cost]").forEach(function (el) { el.removeAttribute("aria-pressed"); });
      cost.setAttribute("aria-pressed", "true");
      apply();
      return;
    }
    const toggle = e.target.closest("[data-toggle]");
    if (toggle) {
      if (toggle.getAttribute("aria-pressed") === "true") toggle.removeAttribute("aria-pressed");
      else toggle.setAttribute("aria-pressed", "true");
      apply();
      return;
    }
    const random = e.target.closest("[data-random]");
    if (random) {
      const visible = cards().filter(function (card) { return !card.hidden; });
      if (!visible.length) return;
      const pick = visible[Math.floor(Math.random() * visible.length)];
      const link = pick.querySelector("a");
      if (link) location.href = link.getAttribute("href");
    }
  });

  const navToggle = document.getElementById("nav-toggle");
  const mobileNav = document.getElementById("mobile-nav");
  if (navToggle && mobileNav) {
    navToggle.addEventListener("click", function () {
      const open = mobileNav.hasAttribute("hidden");
      if (open) mobileNav.removeAttribute("hidden");
      else mobileNav.setAttribute("hidden", "");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  const form = document.querySelector(".search");
  if (form && qInput) {
    const params = new URLSearchParams(location.search);
    if (params.get("q")) qInput.value = params.get("q");
    form.addEventListener("submit", function (e) {
      if (!grid) return;
      e.preventDefault();
      const url = new URL(location.href);
      if (qInput.value.trim()) url.searchParams.set("q", qInput.value.trim());
      else url.searchParams.delete("q");
      history.replaceState(null, "", url.pathname + url.search);
      apply();
    });
    qInput.addEventListener("input", function () {
      if (grid) apply();
    });
  }

  function renderSaved() {
    const box = document.getElementById("saved-grid");
    const empty = document.getElementById("saved-empty");
    if (!box) return;
    fetch("/places.json").then(function (r) { return r.json(); }).then(function (list) {
      const chosen = saved.map(function (id) { return list.find(function (p) { return p.id === id; }); }).filter(Boolean);
      box.innerHTML = chosen.map(function (p) {
        return '<article class="card"><a class="card-link" href="/place/' + p.id + '/"><h3 lang="zh-CN">' + p.zh + '</h3><p class="en" lang="en">' + p.en + "</p><p>" + p.summary + '</p></a></article>';
      }).join("");
      if (empty) empty.hidden = chosen.length > 0;
    });
  }

  persist();
  apply();
  renderSaved();
})();
