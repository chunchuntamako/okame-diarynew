function formatPublishedAt(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");

  return isToday
    ? `今日 ${hh}:${mm}`
    : `${date.getMonth() + 1}月${date.getDate()}日 ${hh}:${mm}`;
}

export default function VideoCard({ video, big = false }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`video-card ${big ? "video-card-big" : ""}`}
    >
      <img
        src={video.thumbnailUrl}
        alt=""
        className={big ? "thumb-big" : "thumb-small"}
        loading="lazy"
      />
      <div className="video-card-text">
        <p className={big ? "title-big" : "title-small"}>{video.title}</p>
        <p className="video-date">{formatPublishedAt(video.publishedAt)}</p>
      </div>
    </a>
  );
}
