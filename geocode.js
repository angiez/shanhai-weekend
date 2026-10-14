const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = __dirname;
const ctx = { window: {} };
vm.createContext(ctx);
["data.js", "places1.js", "places2.js", "places3.js"].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), ctx);
});
const SITE = ctx.window.SITE;
const outFile = path.join(root, "place-coords.json");

function cityEn(id) {
  return SITE.cities.find((c) => c.id === id).en;
}

function inRegion(lat, lng) {
  return lat >= 48.3 && lat <= 50.35 && lng >= -123.65 && lng <= -121.15;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function search(q) {
  const url = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams({
    format: "jsonv2",
    limit: "5",
    q
  });
  const res = await fetch(url, {
    headers: {
      "User-Agent": "ShanhaiWeekend/1.0 (https://weekend.bchomehub.com)",
      "Accept-Language": "en"
    }
  });
  if (res.status === 429 || res.status === 503) {
    await sleep(4000);
    return search(q);
  }
  if (!res.ok) throw new Error(res.status + " " + q);
  return res.json();
}

function tokens(name) {
  return name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !["park", "lake", "beach", "regional", "museum", "trail", "river", "creek", "falls", "point", "village", "centre", "center", "market", "island"].includes(w));
}

function score(place, city, hit) {
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!inRegion(lat, lng)) return -1;
  const label = (hit.display_name || "").toLowerCase();
  const name = place.en.toLowerCase();
  let s = 0;
  if (label.includes(name)) s += 5;
  const words = tokens(place.en);
  const hitWords = words.filter((w) => label.includes(w));
  s += hitWords.length * 2;
  if (label.includes(city.toLowerCase())) s += 2;
  if (label.includes("british columbia") || label.includes("washington")) s += 1;
  return s;
}

(async () => {
  const coords = {};
  const missed = [];
  for (const place of SITE.places) {
    const city = cityEn(place.city);
    const region = place.city === "bellingham" ? "Washington, USA" : "British Columbia, Canada";
    const q = `${place.en}, ${city}, ${region}`;
    const hits = await search(q);
    const ranked = hits
      .map((hit) => ({ hit, s: score(place, city, hit) }))
      .filter((row) => row.s >= 4)
      .sort((a, b) => b.s - a.s);
    if (!ranked.length) {
      missed.push(place.id + " | " + q + " | " + (hits[0] ? hits[0].display_name : "none"));
    } else {
      const hit = ranked[0].hit;
      coords[place.id] = {
        lat: Number(hit.lat),
        lng: Number(hit.lon),
        source: "nominatim",
        osm: `${hit.osm_type}/${hit.osm_id}`,
        label: hit.display_name,
        query: q
      };
    }
    await sleep(1100);
  }
  fs.writeFileSync(outFile, JSON.stringify(coords, null, 2));
  console.log("mapped", Object.keys(coords).length, "missed", missed.length);
  missed.forEach((line) => console.log("MISS", line));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
