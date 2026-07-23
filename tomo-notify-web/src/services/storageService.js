import { STORAGE_KEYS, DEFAULT_SETTINGS } from "../config";

export function getVideoHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VIDEO_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveVideoHistory(videos) {
  const top5 = videos.slice(0, 5);
  try {
    localStorage.setItem(STORAGE_KEYS.VIDEO_HISTORY, JSON.stringify(top5));
  } catch {
    // ストレージが使えない環境（プライベートモード等）は静かに諦める
  }
  return top5;
}

export function getSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch {
    // noop
  }
}

export function getLastSeenVideoId() {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_SEEN_VIDEO_ID);
  } catch {
    return null;
  }
}

export function setLastSeenVideoId(id) {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_SEEN_VIDEO_ID, id);
  } catch {
    // noop
  }
}
