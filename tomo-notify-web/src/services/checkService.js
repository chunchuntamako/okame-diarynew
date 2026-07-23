import { fetchLatestVideos, isChannelConfigured } from "./rssService";
import {
  saveVideoHistory,
  getLastSeenVideoId,
  setLastSeenVideoId,
  getSettings,
} from "./storageService";
import { CHANNEL_CONFIG } from "../config";

// 新着動画をチェックする。videos[0]が前回と違えば「新着あり」。
// 戻り値: { videos, hasNew, error? }
export async function checkForNewVideos() {
  if (!isChannelConfigured()) {
    return { videos: [], hasNew: false, error: "not_configured" };
  }

  try {
    const videos = await fetchLatestVideos();
    if (videos.length === 0) {
      return { videos: [], hasNew: false };
    }

    const lastSeenId = getLastSeenVideoId();
    const latest = videos[0];
    const isFirstRun = !lastSeenId;
    const hasNew = !isFirstRun && latest.videoId !== lastSeenId;

    if (hasNew) {
      const settings = getSettings();
      if (
        settings.notificationsEnabled &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        const n = new Notification(CHANNEL_CONFIG.channelName, {
          body: "新しい動画が公開されたよ！",
          // 一部ブラウザはsubtitle非対応のためbodyに含める
        });
        n.onclick = () => {
          window.open(latest.url, "_blank");
          window.focus();
        };
      }
    }

    setLastSeenVideoId(latest.videoId);
    const top5 = saveVideoHistory(videos);
    return { videos: top5, hasNew };
  } catch (e) {
    console.error("checkForNewVideos error", e);
    return { videos: [], hasNew: false, error: e.message };
  }
}
