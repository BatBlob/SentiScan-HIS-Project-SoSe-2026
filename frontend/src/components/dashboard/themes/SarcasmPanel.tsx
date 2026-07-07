import { AiInsightBox } from "../AiInsightBox";
import { PanelRPipelineNotice } from "../PanelRPipelineNotice";
import type { Aggregates, EntryDocument } from "../../../types/api";
import { polarityBadgeClass, truncate } from "../../../utils/formatters";

interface Props {
  aggregates: Aggregates;
  entries: EntryDocument[];
  totalEntries: number;
  onExcludeToggle: () => void;
  excludeSarcasm: boolean;
  rPipelineError?: string | null;
}

export function SarcasmPanel({
  aggregates,
  entries,
  totalEntries,
  onExcludeToggle,
  excludeSarcasm,
  rPipelineError,
}: Props) {
  const flagged = entries.filter((e) => e.sarcasm_flag);
  const sarcasmCount = aggregates.sarcasm_count ?? flagged.length;
  const hasData = sarcasmCount > 0 || flagged.length > 0;

  if (!hasData && rPipelineError) {
    return (
      <PanelRPipelineNotice
        rPipelineError={rPipelineError}
        moduleName="Sarcasm detection"
      />
    );
  }

  const pct = totalEntries > 0 ? Math.round((sarcasmCount / totalEntries) * 100) : 0;
  const avgConf =
    flagged.length > 0
      ? Math.round(
          (flagged.reduce((s, e) => s + e.sarcasm_confidence, 0) / flagged.length) * 100,
        )
      : 0;

  return (
    <>
      <AiInsightBox theme="sarcasm" aggregates={aggregates} entries={entries} totalEntries={totalEntries} />

      {/* Disclaimer */}
      <div style={{
        background: "#fffbeb", border: "1px solid #fde68a",
        borderRadius: 6, padding: "8px 14px", fontSize: 11,
        color: "#92400e", marginBottom: 12, display: "flex", gap: 8, alignItems: "flex-start",
      }}>
        <span>⚠️</span>
        <span>
          Sarcasm detection uses a heuristic rule-based approach (sentiment incongruency, punctuation
          density, positive-word-in-negative-context, and phrase matching). Results are indicative —
          expect 60–70% accuracy. Treat flagged entries as candidates for manual review.
        </span>
      </div>

      {/* Summary pills */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { label: "flagged entries", value: sarcasmCount },
          { label: "of total dataset", value: `${pct}%` },
          { label: "avg confidence", value: `${avgConf}%` },
          { label: "excluded from aggregates", value: excludeSarcasm ? "Yes" : "No" },
        ].map((p) => (
          <div key={p.label} className="pill">
            <strong>{p.value}</strong> {p.label}
          </div>
        ))}
        <button
          type="button"
          className="btn"
          style={{ marginLeft: "auto" }}
          onClick={onExcludeToggle}
        >
          {excludeSarcasm ? "Include sarcasm in aggregates" : "Exclude sarcasm from aggregates"}
        </button>
      </div>

      {!hasData ? (
        <div className="card">
          <p style={{ fontSize: 12, color: "#888" }}>
            No sarcasm was detected in this dataset. This may indicate a straightforward dataset
            or that entries are too short for the heuristics to trigger.
          </p>
        </div>
      ) : (
        <div className="card">
          <h3>Flagged Entries</h3>
          <table className="conf-table">
            <thead>
              <tr>
                <th>Text</th>
                <th>Sentiment</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {flagged.slice(0, 50).map((entry) => {
                const conf = Math.round(entry.sarcasm_confidence * 100);
                const confColor = conf >= 70 ? "#dc2626" : conf >= 50 ? "#d97706" : "#6b7280";
                return (
                  <tr key={entry.row_index}>
                    <td style={{ color: "#555", maxWidth: 280 }}>
                      &quot;{truncate(entry.original_text, 80)}&quot;
                    </td>
                    <td>
                      <span className={polarityBadgeClass(entry.polarity)}>{entry.polarity}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div className="mini-track">
                          <div
                            className="mini-fill"
                            style={{ width: `${conf}%`, background: confColor }}
                          />
                        </div>
                        <span style={{ fontSize: 11, color: confColor, minWidth: 30 }}>
                          {conf}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {flagged.length > 50 && (
            <p style={{ fontSize: 11, color: "#888", marginTop: 8 }}>
              Showing 50 of {flagged.length} flagged entries.
            </p>
          )}
        </div>
      )}
    </>
  );
}
