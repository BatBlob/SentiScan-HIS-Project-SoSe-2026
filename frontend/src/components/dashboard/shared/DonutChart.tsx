import { pct, sumValues } from "../../../utils/formatters";

interface DonutChartProps {
  distribution: Record<string, number>;
}

const ORDER = ["Very Positive", "Positive", "Neutral", "Negative", "Very Negative"];
const COLORS = ["#15803d", "#86efac", "#d1d5db", "#fca5a5", "#dc2626"];

export function DonutChart({ distribution }: DonutChartProps) {
  const total = sumValues(distribution) || 1;
  const positive =
    (distribution["Very Positive"] ?? 0) + (distribution["Positive"] ?? 0);
  const positivePct = pct(positive, total);

  let offset = -20;
  const segments = ORDER.map((key, i) => {
    const count = distribution[key] ?? 0;
    const dash = (count / total) * 364;
    const seg = { dash, offset, color: COLORS[i] };
    offset -= dash;
    return seg;
  });

  return (
    <>
      <div className="donut-wrap">
        <svg width="150" height="150" viewBox="0 0 150 150">
          <circle cx="75" cy="75" r="58" fill="none" stroke="#eee" strokeWidth="20" />
          {segments.map((s, i) => (
            <circle
              key={i}
              cx="75"
              cy="75"
              r="58"
              fill="none"
              stroke={s.color}
              strokeWidth="20"
              strokeDasharray={`${s.dash} 364`}
              strokeDashoffset={s.offset}
            />
          ))}
          <text x="75" y="70" textAnchor="middle" fontSize="20" fontWeight="bold" fontFamily="sans-serif" fill="#111">
            {positivePct}%
          </text>
          <text x="75" y="85" textAnchor="middle" fontSize="11" fontFamily="sans-serif" fill="#888">
            Positive
          </text>
        </svg>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 8 }}>
        {ORDER.map((label, i) => (
          <span key={label} style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 10, height: 10, background: COLORS[i], borderRadius: 2, display: "inline-block" }} />
            {label.replace("Very ", "V. ")}
          </span>
        ))}
      </div>
    </>
  );
}
