import { BRAND_DOTS } from "../config";

export default function DotRow({ size = 10, gap = 8, pulsing = false }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: `${gap}px`,
        margin: "4px 0",
      }}
      aria-hidden="true"
    >
      {BRAND_DOTS.map((color, i) => (
        <span
          key={color + i}
          className={pulsing ? "dot dot-pulse" : "dot"}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: color,
            display: "inline-block",
            animationDelay: pulsing ? `${i * 0.12}s` : undefined,
          }}
        />
      ))}
    </div>
  );
}
