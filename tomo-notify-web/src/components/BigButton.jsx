export default function BigButton({ label, onClick, variant = "primary", disabled }) {
  return (
    <button
      className={`big-button big-button-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
