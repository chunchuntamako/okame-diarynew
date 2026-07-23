import { CHANNEL_CONFIG, getRssUrl, CORS_PROXIES } from "../config";

// プロキシを順番に試し、最初に成功したものを使う
async function fetchViaProxies(targetUrl) {
  let lastError;
  for (const buildProxyUrl of CORS_PROXIES) {
    try {
      const response = await fetch(buildProxyUrl(targetUrl));
      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }
      const text = await response.text();
      if (!text || text.length < 20) {
        throw new Error("空のレスポンス");
      }
      return text;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error("RSSの取得に失敗しました");
}

// YouTubeのRSS(Atom)フィードを取得し、新しい順の動画配列を返す
// 戻り値: [{ videoId, title, publishedAt, thumbnailUrl, url }]
export async function fetchLatestVideos() {
  const rssUrl = getRssUrl(CHANNEL_CONFIG.channelId);
  const xmlText = await fetchViaProxies(rssUrl);

  const xml = new DOMParser().parseFromString(xmlText, "text/xml");
  const parseError = xml.querySelector("parsererror");
  if (parseError) {
    throw new Error("RSSの解析に失敗しました");
  }

  const entries = Array.from(xml.getElementsByTagName("entry"));

  const videos = entries.map((entry) => {
    const videoId =
      entry.getElementsByTagName("yt:videoId")[0]?.textContent ?? "";
    const title = entry.getElementsByTagName("title")[0]?.textContent ?? "";
    const publishedAt =
      entry.getElementsByTagName("published")[0]?.textContent ?? "";
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    return {
      videoId,
      title,
      publishedAt,
      thumbnailUrl,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  });

  videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  return videos;
}

export function isChannelConfigured() {
  return (
    !!CHANNEL_CONFIG.channelId && !CHANNEL_CONFIG.channelId.includes("XXXX")
  );
}
