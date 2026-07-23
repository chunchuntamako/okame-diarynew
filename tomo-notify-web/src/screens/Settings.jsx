import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "../services/storageService";
import { DEFAULT_SETTINGS } from "../config";

export default function Settings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [permissionState, setPermissionState] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  useEffect(() => {
    setSettings(getSettings());
  }, []);

  const update = async (key, value) => {
    if (key === "notificationsEnabled" && value) {
      if (typeof Notification === "undefined") {
        alert("このブラウザは通知に対応していません。");
        return;
      }
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      if (permission !== "granted") {
        return; // 許可されなければONにしない
      }
    }
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
  };

  return (
    <div className="screen-content">
      <h1 className="screen-title">設定</h1>

      <label className="setting-row">
        <span>通知</span>
        <input
          type="checkbox"
          checked={settings.notificationsEnabled}
          onChange={(e) => update("notificationsEnabled", e.target.checked)}
        />
      </label>

      <label className="setting-row">
        <span>自動更新</span>
        <input
          type="checkbox"
          checked={settings.autoRefreshEnabled}
          onChange={(e) => update("autoRefreshEnabled", e.target.checked)}
        />
      </label>

      <p className="setting-note">
        ※このアプリはブラウザ版のため、タブ（画面）を開いている間だけ自動更新・通知が働きます。
        アプリを閉じている間の通知は届きません。開くたびに最新状態を確認します。
      </p>
      {permissionState === "denied" && (
        <p className="setting-note">
          ブラウザの通知がブロックされています。ONにするには、ブラウザの設定からこのサイトの通知を許可してください。
        </p>
      )}
    </div>
  );
}
