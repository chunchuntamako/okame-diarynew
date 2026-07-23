const TABS = [
  { key: "home", label: "ホーム", icon: "🏠" },
  { key: "history", label: "履歴", icon: "🕒" },
  { key: "settings", label: "設定", icon: "⚙️" },
];

export default function TabBar({ active, onChange }) {
  return (
    <nav className="tab-bar">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={`tab-item ${active === tab.key ? "tab-item-active" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          <span className="tab-icon" aria-hidden="true">
            {tab.icon}
          </span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
