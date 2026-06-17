import { AiInsightBox } from "../AiInsightBox";
import { BarRow } from "../shared/BarRow";
import type { Aggregates, EntryDocument } from "../../../types/api";
import { formatIntent } from "../../../utils/formatters";

interface Props {
  aggregates: Aggregates;
  entries: EntryDocument[];
  totalEntries: number;
}

const INTENT_CONFIG = [
  { key: "complaint", label: "Complaint", cls: "bar-comp", bg: "#fee2e2", icon: "⚠" },
  { key: "suggestion", label: "Suggestion", cls: "bar-sug", bg: "#dbeafe", icon: "💡" },
  { key: "compliment", label: "Compliment", cls: "bar-compl", bg: "#dcfce7", icon: "👍" },
  { key: "inquiry", label: "Inquiry", cls: "bar-inq", bg: "#fef9c3", icon: "❓" },
  { key: "statement", label: "General", cls: "bar-gen", bg: "#f3f4f6", icon: "📝" },
];

export function IntentPanel({ aggregates, entries, totalEntries }: Props) {
  const dist = aggregates.intent_distribution;
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || totalEntries || 1;

  return (
    <>
      <AiInsightBox theme="intent" aggregates={aggregates} entries={entries} totalEntries={totalEntries} />
      <div className="two-col">
        <div className="card">
          <h3>Intent Distribution</h3>
          {INTENT_CONFIG.map(({ key, label, cls }) => (
            <BarRow key={key} label={label} pct={Math.round(((dist[key] ?? 0) / total) * 100)} fillClass={cls} />
          ))}
        </div>
        <div className="card">
          <h3>Action Summary</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "#555", lineHeight: 1.8 }}>
            {INTENT_CONFIG.map(({ key, bg, icon }) => (
              <div key={key} style={{ padding: 8, borderRadius: 4, background: bg }}>
                {icon} <strong>{dist[key] ?? 0} {formatIntent(key).toLowerCase()}s</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
