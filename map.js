(function () {
  const el = document.getElementById("outing-map");
  const status = document.getElementById("map-status");
  if (!el) return;

  function say(text) {
    if (!status) return;
    status.hidden = false;
    status.textContent = text;
  }

  const dataEl = document.getElementById("map-markers");
  let markers = [];
  try {
    markers = JSON.parse(dataEl ? dataEl.textContent : "[]");
  } catch (err) {
    markers = [];
  }

  if (typeof L === "undefined") {
    say("地图没有加载出来。Map library did not load. 请刷新页面；下面的地点列表仍然可以打开。");
    el.hidden = true;
    return;
  }
  if (!markers.length) {
    say("这些地点还没有查到可靠坐标，所以地图上没有标记。没有编造位置。");
    el.hidden = true;
    return;
  }

  const icon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  const map = L.map(el, { scrollWheelZoom: true });
  window.outingMap = map;
  window.outingMarkers = {};

  const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  let tileErrors = 0;
  let tileLoads = 0;
  tiles.on("tileload", function () { tileLoads += 1; });
  tiles.on("tileerror", function () {
    tileErrors += 1;
    if (tileErrors >= 4 && tileLoads === 0) {
      say("地图瓦片没有加载出来。Map tiles failed to load. 请检查网络后刷新。");
    }
  });

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  const bounds = [];
  markers.forEach(function (m) {
    if (typeof m.lat !== "number" || typeof m.lng !== "number") return;
    const marker = L.marker([m.lat, m.lng], { icon: icon, title: m.zh + " " + m.en }).addTo(map);
    marker.bindPopup(
      '<strong lang="zh-CN">' + esc(m.zh) + '</strong><br><span lang="en">' + esc(m.en) + '</span><br><span>' +
      esc(m.cityZh) + " " + esc(m.cityEn) + '</span><br><a href="/place/' + esc(m.id) + '/">查看详情 Open</a>'
    );
    window.outingMarkers[m.id] = marker;
    bounds.push([m.lat, m.lng]);
  });

  if (!bounds.length) {
    say("这些地点还没有查到可靠坐标，所以地图上没有标记。没有编造位置。");
    el.hidden = true;
    return;
  }
  map.fitBounds(bounds, { padding: [28, 28] });
  setTimeout(function () { map.invalidateSize(); }, 150);
  window.addEventListener("resize", function () { map.invalidateSize(); });
})();
