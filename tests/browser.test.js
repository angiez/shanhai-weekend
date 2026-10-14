const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const puppeteer = require("C:/Users/Angie Zhang/AppData/Local/Temp/pwcheck/node_modules/puppeteer-core");

const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const base = process.env.SITE_BASE || "http://127.0.0.1:8878";
const root = path.join(__dirname, "..");

test("schema keeps chat and reports private", function () {
  const sql = fs.readFileSync(path.join(root, "supabase", "schema.sql"), "utf8");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /chat_open/);
  assert.match(sql, /confirmed_count\(aid\) >= 2/);
  assert.match(sql, /primary key \(activity_id, user_id\)/);
  assert.doesNotMatch(sql, /grant select on public\.reports/i);
  assert.match(sql, /reports_insert/);
});

test("built pages expose the map, legal pages, and account gate", async function () {
  const browser = await puppeteer.launch({ executablePath: edge, headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", function (err) { errors.push(String(err)); });
  await page.setViewport({ width: 1280, height: 900 });

  await page.goto(base + "/", { waitUntil: "networkidle0" });
  await page.click('nav a[href="/map/"]');
  await page.waitForSelector(".leaflet-tile-loaded");
  assert.ok(page.url().endsWith("/map/"));
  assert.equal(await page.$eval("#outing-map", function (el) { return el.clientHeight > 300; }), true);

  await page.goto(base + "/city/richmond/", { waitUntil: "domcontentloaded" });
  const guide = await page.$eval("#city-guide", function (el) { return el.innerText; });
  assert.match(guide, /怎么去/);
  assert.match(guide, /Getting there/);
  assert.match(guide, /吃/);

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.$eval("#q", function (el) {
    el.value = "三文鱼";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const shown = await page.$eval("#result-line", function (el) { return el.textContent; });
  assert.match(shown, /^[1-9]/);

  await page.click('[data-cost="0"]');
  const costs = await page.$$eval(".card:not([hidden])", function (els) { return els.map(function (el) { return el.dataset.cost; }); });
  assert.ok(costs.length > 0 && costs.every(function (cost) { return cost === "0"; }));

  await page.goto(base + "/activities/", { waitUntil: "domcontentloaded" });
  const activities = await page.$eval("#activity-list", function (el) { return el.innerText; });
  assert.match(activities, /不注册也可以/);
  assert.match(activities, /Supabase/);

  await page.goto(base + "/account/", { waitUntil: "domcontentloaded" });
  const account = await page.$eval("#account-root", function (el) { return el.innerText; });
  assert.match(account, /浏览地点不需要注册/);

  await page.goto(base + "/privacy/", { waitUntil: "domcontentloaded" });
  const privacy = await page.$eval("article", function (el) { return el.innerText; });
  assert.match(privacy, /PIPA/);
  assert.match(privacy, /PIPEDA/);
  assert.match(privacy, /CASL/);

  await page.goto(base + "/place/stanley/", { waitUntil: "domcontentloaded" });
  const ld = await page.$$eval('script[type="application/ld+json"]', function (els) { return els.map(function (el) { return el.textContent; }).join("\n"); });
  assert.match(ld, /BreadcrumbList/);
  assert.match(ld, /TouristAttraction/);
  const closure = await page.$eval("main", function (el) { return el.innerText; });
  assert.match(closure, /11月7日/);

  await page.setViewport({ width: 390, height: 844 });
  await page.goto(base + "/map/", { waitUntil: "networkidle0" });
  await page.waitForSelector(".leaflet-tile-loaded");
  const overflow = await page.evaluate(function () { return document.documentElement.scrollWidth - document.documentElement.clientWidth; });
  assert.ok(overflow <= 1, "overflow " + overflow);
  await page.click("#nav-toggle");
  const menu = await page.$eval("#mobile-nav", function (el) { return el.innerText; });
  assert.match(menu, /地图/);
  assert.match(menu, /结伴/);

  const blocking = errors.filter(function (err) { return !/favicon/i.test(err); });
  assert.deepEqual(blocking, []);
  await browser.close();
});
