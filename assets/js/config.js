(() => {
  window.App = window.App || {};

  const DATA_CSV_URL =
    "https://static.hamamatsu.odpf.net/opendata/v01/221309_infants_attending_kindergarten/221309_infants_attending_kindergarten.csv";
  const DATASET_PAGE_URL = "https://opendata.pref.shizuoka.jp/dataset/11896.html";

  const TILE_URL =
    new URLSearchParams(window.location.search).get("tiles") ||
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> (ODbL)';

  const DATASET_ATTRIBUTION = [
    '<span class="attribution-block">データ(CC BY):',
    `<a href="${DATASET_PAGE_URL}" target="_blank" rel="noopener">乳児等通園支援事業</a>`,
    "</span>",
    '<span class="attribution-block">提供: <a href="https://opendata.pref.shizuoka.jp/" target="_blank" rel="noopener">静岡県オープンデータポータル</a> / <a href="https://www.city.hamamatsu.shizuoka.jp/opendata/index.html" target="_blank" rel="noopener">浜松市オープンデータ</a></span>',
  ].join(" ");

  const MARKER_STYLE_DEFAULT = { color: "#9ca3af", fillColor: "#ffffff" };
  const MARKER_STYLE_FULL = { color: "#dc2626", fillColor: "#f87171" };
  const MARKER_STYLE_AVAILABLE = { color: "#16a34a", fillColor: "#4ade80" };

  const WEEKDAYS = ["月", "火", "水", "木", "金", "土"];

  window.App.config = {
    DATA_CSV_URL,
    DATASET_PAGE_URL,
    TILE_URL,
    TILE_ATTRIBUTION,
    DATASET_ATTRIBUTION,
    MARKER_STYLE_DEFAULT,
    MARKER_STYLE_FULL,
    MARKER_STYLE_AVAILABLE,
    WEEKDAYS,
  };
})();
