// ==========================================================
// とも通知（ブラウザ版） - 基本設定
// ==========================================================

export const CHANNEL_CONFIG = {
  channelName: "ともちゃんねる",
  channelId: "UCXW2I00RgWYxmEAcQHKr9pQ",
};

export const getRssUrl = (channelId) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

// ブラウザから直接RSSを取得するとCORSでブロックされるため、
// 無料の公開プロキシ経由で取得する（1つ目がダメなら2つ目を試す）
export const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];

// 自動更新の間隔（ミリ秒）：タブを開いている間だけ有効
export const AUTO_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10分

export const STORAGE_KEYS = {
  VIDEO_HISTORY: "tomo_notify_web_history",
  SETTINGS: "tomo_notify_web_settings",
  LAST_SEEN_VIDEO_ID: "tomo_notify_web_last_seen_id",
};

export const DEFAULT_SETTINGS = {
  notificationsEnabled: false, // ブラウザ通知（タブを開いている間のみ有効）
  autoRefreshEnabled: true,
};

// ロゴの配色から抽出したブランドトークン
export const THEME = {
  background: "#FFFDF6",
  cardBackground: "#FFFFFF",
  charcoal: "#3B3730",
  yellow: "#F3DE55",
  yellowDark: "#E0C930",
  orange: "#E8863A",
  blue: "#3FA9DA",
  pink: "#F7C9D4",
  subText: "#8A8378",
  danger: "#D96C6C",
};

// ロゴ下部のドット列と同じ並び（signatureモチーフとして再利用）
export const BRAND_DOTS = ["#E0533D", "#E8D23A", "#3FA9DA", "#3B3730", "#5BAE5B", "#B07FC7"];
