import { AiInsightBox } from "../AiInsightBox";
import { PanelRPipelineNotice } from "../PanelRPipelineNotice";
import type { Aggregates, EntryDocument } from "../../../types/api";

interface Props {
  aggregates: Aggregates;
  entries: EntryDocument[];
  totalEntries: number;
  rPipelineError?: string | null;
}

export function KeywordsPanel({ aggregates, entries, totalEntries, rPipelineError }: Props) {
  const hasWordCloud = aggregates.word_cloud.length > 0;
  const hasKeywords =
    aggregates.keywords_positive.length > 0 ||
    aggregates.keywords_negative.length > 0;

  // Only show the R pipeline error banner when R genuinely failed (no word cloud
  // either, and there is a recorded pipeline error). If R ran fine but produced
  // no keyword scores (e.g. dataset too small for min_support threshold), show
  // the word cloud alone with a soft notice instead.
  if (!hasWordCloud && !hasKeywords) {
    if (rPipelineError) {
      return (
        <PanelRPipelineNotice
          rPipelineError={rPipelineError}
          moduleName="Keyword scoring"
        />
      );
    }
    return (
      <div className="panel-notice panel-notice--r">
        <div className="panel-notice__icon">ℹ️</div>
        <div className="panel-notice__body">
          <strong>No keyword data for this dataset</strong>
          <p>
            The dataset did not produce enough word frequency signal to rank keywords.
            This is normal for small datasets (&lt;20 rows) or very short texts.
          </p>
        </div>
      </div>
    );
  }

  const posMax = Math.max(...aggregates.keywords_positive.map((k) => Math.abs(k.score)), 0.01);
  const negMax = Math.max(...aggregates.keywords_negative.map((k) => Math.abs(k.score)), 0.01);
  const cloudMax = Math.max(...aggregates.word_cloud.map((w) => w.weight), 1);

  return (
    <>
      <AiInsightBox theme="keywords" aggregates={aggregates} entries={entries} totalEntries={totalEntries} />
      {hasKeywords ? (
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
      ) : (
        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: "#888" }}>
            Keyword scoring requires sufficient polarity variation across documents.
            Word frequency cloud is shown below.
          </p>
        </div>
      )}
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
