import { AiInsightBox } from "../AiInsightBox";
import type { Aggregates, EntryDocument } from "../../../types/api";
import { pct } from "../../../utils/formatters";

interface Props {
  aggregates: Aggregates;
  entries: EntryDocument[];
  totalEntries: number;
  onExcludeToggle: () => void;
  excludeSarcasm: boolean;
}

export function SarcasmPanel({
  aggregates,
  entries,
  totalEntries,
  onExcludeToggle,
  excludeSarcasm,
}: Props) {
  const sarcastic = entries.filter((e) => e.sarcasm_flag);

  return (
    <>
      <AiInsightBox theme="sarcasm" aggregates={aggregates} entries={entries} totalEntries={totalEntries} />
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14, padding: 12, background: "#fafafa", border: "1px solid #eee", borderRadius: 6 }}>
          <div style={{ fontSize: 24, fontWeight: "bold" }}>{aggregates.sarcasm_count}</div>
          <div style={{ fontSize: 12, color: "#777" }}>
            sarcastic entries flagged · {pct(aggregates.sarcasm_count, totalEntries)}% of dataset
          </div>
          <button type="button" className="btn" style={{ marginLeft: "auto" }} onClick={onExcludeToggle}>
            {excludeSarcasm ? "Include in calculations" : "Exclude from calculations"}
          </button>
        </div>
        {sarcastic.length === 0 ? (
          <p style={{ fontSize: 12, color: "#888" }}>No sarcastic entries detected.</p>
        ) : (
          sarcastic.slice(0, 10).map((entry) => (
            <div className="sarc-card" key={entry.row_index}>
              <div className="sarc-text">&quot;{entry.original_text}&quot;</div>
              <div className="sarc-meta">
                <span>Confidence: {Math.round(entry.sarcasm_confidence * 100)}%</span>
                <span>Polarity: {entry.polarity}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
