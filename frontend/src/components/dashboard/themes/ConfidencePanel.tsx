import { useState } from "react";
import { AiInsightBox } from "../AiInsightBox";
import type { Aggregates, EntryDocument } from "../../../types/api";
import { dominantEmotion, formatIntent, polarityBadgeClass, truncate } from "../../../utils/formatters";

interface Props {
  aggregates: Aggregates;
  entries: EntryDocument[];
  totalEntries: number;
}

export function ConfidencePanel({ aggregates, entries, totalEntries }: Props) {
  const [lowOnly, setLowOnly] = useState(false);
  const avg =
    entries.reduce((s, e) => s + e.polarity_confidence, 0) / (entries.length || 1);
  const lowCount = entries.filter((e) => e.polarity_confidence < 0.6).length;
  const shown = lowOnly ? entries.filter((e) => e.polarity_confidence < 0.6) : entries.slice(0, 20);

  return (
    <>
      <AiInsightBox theme="confidence" aggregates={aggregates} entries={entries} totalEntries={totalEntries} />
      <div className="card">
        <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <div className="pill">
            <strong>{Math.round(avg * 100)}%</strong>
            avg confidence
          </div>
          <div className="pill">
            <strong>{lowCount} entries</strong>
            below 60%
          </div>
          <button type="button" className="btn" style={{ marginLeft: "auto" }} onClick={() => setLowOnly((v) => !v)}>
            {lowOnly ? "Show all entries" : "Show low-confidence only"}
          </button>
        </div>
        <table className="conf-table">
          <thead>
            <tr>
              <th>Entry</th>
              <th>Sentiment</th>
              <th>Emotion</th>
              <th>Intent</th>
              <th>Confidence</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((entry) => {
              const conf = Math.round(entry.polarity_confidence * 100);
              const low = entry.polarity_confidence < 0.6;
              return (
                <tr key={entry.row_index}>
                  <td style={{ color: "#555", maxWidth: 180 }}>&quot;{truncate(entry.original_text)}&quot;</td>
                  <td><span className={polarityBadgeClass(entry.polarity)}>{entry.polarity}</span></td>
                  <td><span className="badge">{dominantEmotion(entry.emotions)}</span></td>
                  <td><span className="badge">{formatIntent(entry.intent)}</span></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div className="mini-track">
                        <div
                          className="mini-fill"
                          style={{
                            width: `${conf}%`,
                            background: low ? "#ef4444" : "#555",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 11, color: low ? "#ef4444" : undefined }}>
                        {conf}%{low ? " ⚠" : ""}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontSize: 11, color: entry.sarcasm_flag ? undefined : "#aaa" }}>
                    {entry.sarcasm_flag ? <span className="badge badge-sarc">Sarcasm</span> : low ? "Low" : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
