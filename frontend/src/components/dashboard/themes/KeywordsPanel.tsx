import { AiInsightBox } from "../AiInsightBox";
import type { Aggregates, EntryDocument } from "../../../types/api";

interface Props {
  aggregates: Aggregates;
  entries: EntryDocument[];
  totalEntries: number;
}

export function KeywordsPanel({ aggregates, entries, totalEntries }: Props) {
  const posMax = Math.max(...aggregates.keywords_positive.map((k) => Math.abs(k.score)), 0.01);
  const negMax = Math.max(...aggregates.keywords_negative.map((k) => Math.abs(k.score)), 0.01);
  const cloudMax = Math.max(...aggregates.word_cloud.map((w) => w.weight), 1);

  return (
    <>
      <AiInsightBox theme="keywords" aggregates={aggregates} entries={entries} totalEntries={totalEntries} />
      <div className="two-col">
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: "bold", color: "#16a34a", marginBottom: 10 }}>Positive-driving keywords</div>
          {aggregates.keywords_positive.map((kw) => (
            <div className="kw-row" key={kw.word}>
              <span className="kw-word">{kw.word}</span>
              <div className="kw-track">
                <div className="kw-fill-pos" style={{ width: `${(Math.abs(kw.score) / posMax) * 100}%` }} />
              </div>
              <span className="kw-pct">{kw.score.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: "bold", color: "#dc2626", marginBottom: 10 }}>Negative-driving keywords</div>
          {aggregates.keywords_negative.map((kw) => (
            <div className="kw-row" key={kw.word}>
              <span className="kw-word">{kw.word}</span>
              <div className="kw-track">
                <div className="kw-fill-neg" style={{ width: `${(Math.abs(kw.score) / negMax) * 100}%` }} />
              </div>
              <span className="kw-pct">{kw.score.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="word-cloud">
        {aggregates.word_cloud.map((w) => {
          const size = 12 + (w.weight / cloudMax) * 12;
          const isPos = aggregates.keywords_positive.some((k) => k.word === w.word);
          return (
            <span
              className="wc-word"
              key={w.word}
              style={{
                fontSize: size,
                color: isPos ? "#16a34a" : "#555",
                fontWeight: size > 20 ? "bold" : "normal",
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </>
  );
}
