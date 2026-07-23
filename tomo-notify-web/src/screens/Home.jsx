import { useCallback, useEffect, useState } from "react";
import { CHANNEL_CONFIG } from "../config";
import { checkForNewVideos } from "../services/checkService";
import { isChannelConfigured } from "../services/rssService";
import VideoCard from "../components/VideoCard";
import BigButton from "../components/BigButton";
import DotRow from "../components/DotRow";

function isPublishedToday(isoString) {
  if (!isoString) return false;
  const date = new Date(isoString);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [videos, setVideos] = useState([]);
  const [error, setError] = useState(null);

  const runCheck = useCallback(async () => {
    const result = await checkForNewVideos();
    if (result.error) {
      setError(result.error);
    } else {
      setError(null);
      setVideos(result.videos);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await runCheck();
      setLoading(false);
    })();
  }, [runCheck]);

  const onRefreshClick = async () => {
    setRefreshing(true);
    await runCheck();
    setRefreshing(false);
  };

  if (!isChannelConfigured()) {
    return (
      <div className="screen-center">
        <p className="empty-text">
          チャンネルIDが設定されていません。
          <br />
          src/config.js を確認してください。
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="screen-center">
        <DotRow pulsing size={14} gap={10} />
      </div>
    );
  }

  const latestVideo = videos[0];
  const hasTodayVideo = latestVideo && isPublishedToday(latestVideo.publishedAt);

  return (
    <div className="screen-content">
      <h1 className="channel-name">{CHANNEL_CONFIG.channelName}</h1>
      <DotRow />

      {error && (
        <p className="error-text">
          動画の取得に失敗しました。もう一度更新してみてね。
        </p>
      )}

      {!error && (!latestVideo || !hasTodayVideo) && (
        <div className="empty-box">
          <p className="empty-text">今日はまだ新しい動画はありません😊</p>
        </div>
      )}

      {!error && latestVideo && (
        <>
          <VideoCard video={latestVideo} big />
          <BigButton
            label="見る ▶️"
            onClick={() => window.open(latestVideo.url, "_blank")}
          />
        </>
      )}

      <button
        className="refresh-link"
        onClick={onRefreshClick}
        disabled={refreshing}
      >
        {refreshing ? "更新中…" : "今すぐ更新する"}
      </button>
    </div>
  );
}
