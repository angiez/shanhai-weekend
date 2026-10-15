const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");

function jwt(role) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ role: role })).toString("base64url");
  return header + "." + payload + ".sig";
}

function build(env) {
  const result = spawnSync(process.execPath, ["build.js"], {
    cwd: root,
    env: Object.assign({}, process.env, env),
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test("public pages keep canonical URLs, sitemap entries, and bilingual markup", function () {
  const serviceKey = jwt("service_role");
  build({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: serviceKey,
    GA_MEASUREMENT_ID: "not-a-ga-id",
    GOOGLE_SITE_VERIFICATION: "bad token"
  });
  const blocked = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  assert.equal(blocked.includes(serviceKey), false);
  assert.equal(blocked.includes("not-a-ga-id"), false);
  assert.equal(blocked.includes("google-site-verification"), false);

  const anonKey = jwt("anon");
  build({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_REGION: "ca-central-1",
    SUPABASE_ANON_KEY: "sb_secret_not_for_browsers"
  });
  const secretBlocked = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  assert.equal(secretBlocked.includes("sb_secret_not_for_browsers"), false);

  build({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_REGION: "ca-central-1",
    SUPABASE_ANON_KEY: "sb_publishable_example"
  });
  const publishable = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  assert.match(publishable, /sb_publishable_example/);
  build({
    SUPABASE_URL: "https://cuheydevtbwmfzvvdxaw.supabase.co",
    SUPABASE_REGION: "ca-central-1",
    SUPABASE_ANON_KEY: anonKey
  });
  const unitedStates = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  assert.equal(unitedStates.includes("cuheydevtbwmfzvvdxaw"), false);
  assert.equal(unitedStates.includes(anonKey), false);

  build({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: anonKey,
    GA_MEASUREMENT_ID: "G-TEST1234",
    GOOGLE_SITE_VERIFICATION: "verifyToken123",
    CONTACT_EMAIL: ""
  });
  const withoutRegion = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  assert.equal(withoutRegion.includes(anonKey), false);
  assert.match(withoutRegion, /"supabaseRegion":""/);

  build({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_REGION: "ca-central-1",
    SUPABASE_ANON_KEY: anonKey,
    GA_MEASUREMENT_ID: "G-TEST1234",
    GOOGLE_SITE_VERIFICATION: "verifyToken123",
    CONTACT_EMAIL: ""
  });

  const home = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  assert.match(home, /<html lang="zh-CN">/);
  assert.match(home, /rel="canonical" href="https:\/\/weekend\.bchomehub\.com\/"/);
  assert.match(home, /inLanguage":\["zh-CN","en-CA"\]/);
  assert.match(home, /media="print"/);
  assert.match(home, /google-site-verification" content="verifyToken123"/);
  assert.match(home, /"gaId":"G-TEST1234"/);
  assert.doesNotMatch(home, /googletagmanager\.com/);
  assert.match(home, /"supabaseRegion":"ca-central-1"/);
  assert.match(home, new RegExp(anonKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const stanley = fs.readFileSync(path.join(dist, "place", "stanley", "index.html"), "utf8");
  assert.match(stanley, /rel="canonical" href="https:\/\/weekend\.bchomehub\.com\/place\/stanley\/"/);
  assert.match(stanley, /TouristAttraction/);
  assert.match(stanley, /BreadcrumbList/);
  assert.match(stanley, /lang="en"/);
  assert.match(stanley, /<h1[\s>]/);

  const richmond = fs.readFileSync(path.join(dist, "city", "richmond", "index.html"), "utf8");
  assert.match(richmond, /id="city-guide"/);
  assert.match(richmond, /怎么去/);
  assert.match(richmond, /Getting there/);

  const account = fs.readFileSync(path.join(dist, "account", "index.html"), "utf8");
  assert.match(account, /noindex, follow/);
  const view = fs.readFileSync(path.join(dist, "activities", "view", "index.html"), "utf8");
  assert.match(view, /noindex, follow/);

  const robots = fs.readFileSync(path.join(dist, "robots.txt"), "utf8");
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/weekend\.bchomehub\.com\/sitemap\.xml/);
  const sitemap = fs.readFileSync(path.join(dist, "sitemap.xml"), "utf8");
  assert.match(sitemap, /https:\/\/weekend\.bchomehub\.com\/map\/</);
  assert.match(sitemap, /https:\/\/weekend\.bchomehub\.com\/place\/stanley\/</);
  assert.doesNotMatch(sitemap, /\/account\//);
  assert.doesNotMatch(sitemap, /\/activities\/view\//);
  assert.equal((sitemap.match(/<loc>/g) || []).length > 100, true);

  const guidelines = fs.readFileSync(path.join(dist, "guidelines", "index.html"), "utf8");
  assert.match(guidelines, /私人住宅/);
  assert.match(guidelines, /未成年人/);
  const privacy = fs.readFileSync(path.join(dist, "privacy", "index.html"), "utf8");
  assert.match(privacy, /ca-central-1/);
  assert.match(privacy, /GoHighLevel/);
  assert.match(privacy, /OpenStreetMap/);
  assert.match(privacy, /does not mean every service/);
  assert.doesNotMatch(privacy, /us-east-1/);
  assert.doesNotMatch(privacy, /cuheydevtbwmfzvvdxaw/);
  assert.match(privacy, /Google Analytics/);
  const client = fs.readFileSync(path.join(dist, "community.js"), "utf8");
  assert.equal(client.includes('.from("reports").select'), false);
  assert.match(client, /只有已报名的参加者可以进入群聊/);
});
