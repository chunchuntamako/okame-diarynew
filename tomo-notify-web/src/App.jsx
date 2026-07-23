import { useEffect, useState } from "react";
import TabBar from "./components/TabBar";
import Home from "./screens/Home";
import History from "./screens/History";
import Settings from "./screens/Settings";
import { checkForNewVideos } from "./services/checkService";
import { getSettings } from "./services/storageService";
import { AUTO_REFRESH_INTERVAL_MS } from "./config";

export default function App() {
  const [tab, setTab] = useState("home");

  // タブを開いている間だけ、設定に応じて定期的に新着チェックする
  useEffect(() => {
    const timer = setInterval(async () => {
      const settings = getSettings();
      if (settings.autoRefreshEnabled) {
        await checkForNewVideos();
      }
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="app-shell">
      <main className="app-main">
        {tab === "home" && <Home />}
        {tab === "history" && <History />}
        {tab === "settings" && <Settings />}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
