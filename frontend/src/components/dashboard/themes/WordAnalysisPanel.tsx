import { useState } from "react";
import { AiInsightBox } from "../AiInsightBox";
import type { Aggregates, EntryDocument } from "../../../types/api";

interface Props {
  aggregates: Aggregates;
  entries: EntryDocument[];
  totalEntries: number;
}

// Simple linear scale from smallest -> largest count to a font-size range,
// same visual idea as the word cloud already used in Keyword Scoring.
function weightToSize(weight: number, min: number, max: number): number {
  if (max === min) return 20;
  const t = (weight - min) / (max - min);
  return Math.round(14 + t * 26); // 14px .. 40px
}

export function WordAnalysisPanel({ aggregates, entries, totalEntries }: Props) {
  const [tab, setTab] = useState<"words" | "bigrams">("words");

  const words = aggregates.word_cloud ?? [];
  const bigrams = aggregates.top_bigrams ?? [];

  const weights = words.map((w) => w.weight);
  const minW = weights.length ? Math.min(...weights) : 0;
  const maxW = weights.length ? Math.max(...weights) : 1;

  const maxBigramCount = bigrams.length ? Math.max(...bigrams.map((b) => b.count)) : 1;

  return (
    <>
      <AiInsightBox theme="wordanalysis" aggregates={aggregates} entries={entries} totalEntries={totalEntries} />

      <div className="card">
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button
            type="button"
            className="btn"
            style={{ background: tab === "words" ? "#000" : undefined, color: tab === "words" ? "#fff" : undefined }}
            onClick={() => setTab("words")}
          >
            Top Words
          </button>
          <button
            type="button"
            className="btn"
            style={{ background: tab === "bigrams" ? "#000" : undefined, color: tab === "bigrams" ? "#fff" : undefined }}
            onClick={() => setTab("bigrams")}
          >
            Top Bigrams
          </button>
        </div>

        {tab === "words" && (
          <>
            {words.length === 0 ? (
              <p style={{ color: "#888" }}>No word frequency data available for this dataset.</p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px 18px",
                  padding: "20px 8px",
                  lineHeight: 1.4,
                }}
              >
                {words.map((w) => (
                  <span
                    key={w.word}
                    className="badge"
                    style={{
                      fontSize: weightToSize(w.weight, minW, maxW),
                      fontWeight: w.weight > (minW + maxW) / 2 ? 700 : 500,
                    }}
                    title={`${w.word}: ${w.weight} occurrences`}
                  >
                    {w.word}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "bigrams" && (
          <>
            {bigrams.length === 0 ? (
              <p style={{ color: "#888" }}>No bigram data available for this dataset.</p>
            ) : (
              <table className="conf-table">
                <thead>
                  <tr>
                    <th>Bigram</th>
                    <th>Count</th>
                    <th style={{ width: "40%" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {bigrams.map((b) => (
                    <tr key={b.bigram}>
                      <td>{b.bigram}</td>
                      <td style={{ color: "#555" }}>{b.count}</td>
                      <td>
                        <div className="mini-track">
                          <div
                            className="mini-fill"
                            style={{
                              width: `${Math.round((b.count / maxBigramCount) * 100)}%`,
                              background: "#555",
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </>
  );
}