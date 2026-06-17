import { AiInsightBox } from "../AiInsightBox";
import type { Aggregates, EntryDocument } from "../../../types/api";

interface Props {
  aggregates: Aggregates;
  entries: EntryDocument[];
  totalEntries: number;
}

export function TrendPanel({ aggregates, entries, totalEntries }: Props) {
  const trend = aggregates.temporal_trend;

  if (!trend.length) {
    return (
      <>
        <AiInsightBox theme="trend" aggregates={aggregates} entries={entries} totalEntries={totalEntries} />
        <div className="card">
          <h3>Sentiment Over Time</h3>
          <p style={{ fontSize: 12, color: "#888" }}>No temporal data — upload a dataset with a timestamp column to enable this view.</p>
        </div>
      </>
    );
  }

  const width = 820;
  const height = 120;
  const padX = 40;
  const padY = 20;
  const chartH = height - padY - 25;
  const step = (width - padX * 2) / Math.max(trend.length - 1, 1);

  const toY = (v: number) => padY + chartH / 2 - v * (chartH / 2);

  const points = trend
    .map((p, i) => `${padX + i * step},${toY(p.avg_polarity)}`)
    .join(" ");

  const minIdx = trend.reduce(
    (min, p, i, arr) => (p.avg_polarity < arr[min].avg_polarity ? i : min),
    0,
  );
  const spikeX = padX + minIdx * step;
  const spikeY = toY(trend[minIdx].avg_polarity);

  return (
    <>
      <AiInsightBox theme="trend" aggregates={aggregates} entries={entries} totalEntries={totalEntries} />
      <div className="card">
        <h3>Sentiment Over Time</h3>
        <svg className="trend" viewBox={`0 0 ${width} ${height}`} height={130}>
          <line x1="0" y1="20" x2={width} y2="20" stroke="#f0f0f0" strokeWidth="1" />
          <line x1="0" y1="55" x2={width} y2="55" stroke="#f0f0f0" strokeWidth="1" />
          <line x1="0" y1="90" x2={width} y2="90" stroke="#f0f0f0" strokeWidth="1" />
          <text x="0" y="23" fontSize="9" fill="#bbb" fontFamily="sans-serif">High</text>
          <text x="0" y="58" fontSize="9" fill="#bbb" fontFamily="sans-serif">Mid</text>
          <text x="0" y="93" fontSize="9" fill="#bbb" fontFamily="sans-serif">Low</text>
          <polyline points={points} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" />
          {trend[minIdx].avg_polarity < 0 && (
            <>
              <circle cx={spikeX} cy={spikeY} r="5" fill="#ef4444" />
              <rect x={spikeX - 50} y={spikeY - 25} width="100" height="16" rx="3" fill="#fee2e2" />
              <text x={spikeX - 45} y={spikeY - 14} fontSize="9" fill="#991b1b" fontFamily="sans-serif">
                Low point
              </text>
            </>
          )}
          {trend.map((p, i) => (
            <text key={p.period} x={padX + i * step - 15} y="115" fontSize="9" fill="#bbb" fontFamily="sans-serif">
              {p.period}
            </text>
          ))}
        </svg>
        <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 11, color: "#888" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 14, height: 2, background: "#22c55e", display: "inline-block" }} /> Avg polarity
          </span>
        </div>
      </div>
    </>
  );
}
