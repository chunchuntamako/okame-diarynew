import { useEffect, useState } from "react";
import { getVideoHistory } from "../services/storageService";
import VideoCard from "../components/VideoCard";

export default function History() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    setVideos(getVideoHistory());
  }, []);

  return (
    <div className="screen-content">
      <h1 className="screen-title">履歴（最新5件）</h1>
      {videos.length === 0 ? (
        <div className="screen-center">
          <p className="empty-text">まだ動画がありません</p>
        </div>
      ) : (
        <div className="history-list">
          {videos.map((video) => (
            <VideoCard key={video.videoId} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
