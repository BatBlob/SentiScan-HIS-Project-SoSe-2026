import type { Aggregates, EntryDocument, SummaryResponse } from "../types/api";

function pct(n: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

function polarityBar(key: string, count: number, total: number): string {
  const colors: Record<string, string> = {
    "Very Positive": "#16a34a",
    "Positive": "#4ade80",
    "Neutral": "#9ca3af",
    "Negative": "#f87171",
    "Very Negative": "#dc2626",
  };
  const fill = colors[key] ?? "#888";
  const width = total ? Math.round((count / total) * 100) : 0;
  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
      <div style="width:120px;font-size:12px;color:#444;">${key}</div>
      <div style="flex:1;background:#f0f0f0;border-radius:4px;overflow:hidden;height:14px;">
        <div style="width:${width}%;background:${fill};height:100%;"></div>
      </div>
      <div style="width:60px;text-align:right;font-size:12px;color:#444;">${count} (${pct(count, total)})</div>
    </div>`;
}

function emotionRow(label: string, value: number): string {
  const w = Math.round(value * 100);
  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
      <div style="width:90px;font-size:12px;color:#444;">${label}</div>
      <div style="flex:1;background:#f0f0f0;border-radius:4px;overflow:hidden;height:10px;">
        <div style="width:${w}%;background:#6366f1;height:100%;"></div>
      </div>
      <div style="width:36px;text-align:right;font-size:12px;color:#444;">${w}%</div>
    </div>`;
}

function intentRow(label: string, count: number, total: number): string {
  const w = total ? Math.round((count / total) * 100) : 0;
  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
      <div style="width:90px;font-size:12px;color:#444;text-transform:capitalize;">${label}</div>
      <div style="flex:1;background:#f0f0f0;border-radius:4px;overflow:hidden;height:10px;">
        <div style="width:${w}%;background:#a78bfa;height:100%;"></div>
      </div>
      <div style="width:50px;text-align:right;font-size:12px;color:#444;">${count} (${pct(count, total)})</div>
    </div>`;
}

function section(title: string, content: string): string {
  return `
    <div style="margin-bottom:24px;">
      <div style="font-size:13px;font-weight:700;color:#111;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin-bottom:12px;">${title}</div>
      ${content}
    </div>`;
}

export function openPdfReport(
  summary: SummaryResponse,
  entries: EntryDocument[],
  meta: { filename?: string; row_count?: number } | null,
): void {
  const agg: Aggregates = summary.aggregates;
  const now = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const filename = meta?.filename ?? "Dataset";
  const rowCount = meta?.row_count ?? entries.length;

  // ── Polarity distribution ──────────────────────────────────────────────────
  const polarityOrder = ["Very Positive", "Positive", "Neutral", "Negative", "Very Negative"];
  const totalPol = Object.values(agg.polarity_distribution).reduce((a, b) => a + b, 0) || rowCount || 1;
  const polarityHTML = polarityOrder
    .map((k) => polarityBar(k, agg.polarity_distribution[k] ?? 0, totalPol))
    .join("");

  // ── Emotion distribution ───────────────────────────────────────────────────
  const emoOrder = ["happiness", "sadness", "anger", "surprise", "fear", "disgust"];
  const emoLabels: Record<string, string> = {
    happiness: "Joy", sadness: "Sadness", anger: "Anger",
    surprise: "Surprise", fear: "Fear", disgust: "Disgust",
  };
  const emoHTML = Object.keys(agg.emotion_distribution).length
    ? emoOrder
        .filter((k) => agg.emotion_distribution[k] !== undefined)
        .map((k) => emotionRow(emoLabels[k] ?? k, agg.emotion_distribution[k]))
        .join("")
    : "<p style='font-size:12px;color:#888;'>No emotion data available.</p>";

  // ── Intent distribution ────────────────────────────────────────────────────
  const intentTotal = Object.values(agg.intent_distribution).reduce((a, b) => a + b, 0);
  const intentHTML = intentTotal
    ? Object.entries(agg.intent_distribution)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => intentRow(k, v, intentTotal))
        .join("")
    : "<p style='font-size:12px;color:#888;'>No intent data available.</p>";

  // ── Top aspects ────────────────────────────────────────────────────────────
  const aspectHTML = agg.aspect_sentiment.length
    ? agg.aspect_sentiment
        .slice(0, 10)
        .map((a) => {
          const dom =
            a.positive >= a.negative && a.positive >= a.neutral ? "Positive"
            : a.negative >= a.positive && a.negative >= a.neutral ? "Negative"
            : "Neutral";
          const color = dom === "Positive" ? "#16a34a" : dom === "Negative" ? "#dc2626" : "#888";
          return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
            <div style="width:110px;font-size:12px;font-weight:600;text-transform:capitalize;">${a.term}</div>
            <span style="background:${color};color:#fff;padding:1px 8px;border-radius:4px;font-size:11px;">${dom}</span>
            <span style="font-size:11px;color:#888;">${a.total} mention${a.total !== 1 ? "s" : ""}</span>
            <span style="font-size:11px;color:#16a34a;">+${a.positive}</span>
            <span style="font-size:11px;color:#888;">~${a.neutral}</span>
            <span style="font-size:11px;color:#dc2626;">−${a.negative}</span>
          </div>`;
        })
        .join("")
    : "<p style='font-size:12px;color:#888;'>No aspect data available.</p>";

  // ── Topics ─────────────────────────────────────────────────────────────────
  const topicsHTML = agg.topics.length
    ? agg.topics
        .map((t) => `<div style="margin-bottom:6px;font-size:12px;">
          <span style="font-weight:700;">Topic ${String(t.id).padStart(2, "0")} — ${t.label}:</span>
          <span style="color:#555;"> ${t.keywords.join(", ")}</span>
        </div>`)
        .join("")
    : "<p style='font-size:12px;color:#888;'>No topic data available.</p>";

  // ── Temporal trend ─────────────────────────────────────────────────────────
  const trendHTML = agg.temporal_trend.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr>
          <th style="text-align:left;padding:4px 8px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">Period</th>
          <th style="text-align:right;padding:4px 8px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">Avg Polarity</th>
          <th style="padding:4px 8px;background:#f9fafb;border-bottom:1px solid #e5e7eb;"></th>
        </tr></thead>
        <tbody>
        ${agg.temporal_trend
          .map((p) => {
            const bar = Math.max(0, Math.min(100, Math.round((p.avg_polarity + 1) * 50)));
            const col = p.avg_polarity >= 0 ? "#16a34a" : "#dc2626";
            return `<tr>
              <td style="padding:4px 8px;">${p.period}</td>
              <td style="text-align:right;padding:4px 8px;">${p.avg_polarity.toFixed(3)}</td>
              <td style="padding:4px 8px;width:120px;">
                <div style="background:#f0f0f0;border-radius:3px;overflow:hidden;height:8px;">
                  <div style="width:${bar}%;background:${col};height:100%;"></div>
                </div>
              </td>
            </tr>`;
          })
          .join("")}
        </tbody>
      </table>`
    : "<p style='font-size:12px;color:#888;'>No temporal trend data (no timestamp column).</p>";

  // ── Top keywords ───────────────────────────────────────────────────────────
  const kwHTML = agg.keywords_positive.length || agg.keywords_negative.length
    ? `<div style="display:flex;gap:24px;">
        <div style="flex:1;">
          <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:6px;">Positive-driving</div>
          ${agg.keywords_positive.slice(0, 8).map((k) =>
            `<div style="font-size:12px;margin-bottom:3px;">${k.word} <span style="color:#888;">${k.score.toFixed(2)}</span></div>`
          ).join("")}
        </div>
        <div style="flex:1;">
          <div style="font-size:11px;font-weight:700;color:#dc2626;margin-bottom:6px;">Negative-driving</div>
          ${agg.keywords_negative.slice(0, 8).map((k) =>
            `<div style="font-size:12px;margin-bottom:3px;">${k.word} <span style="color:#888;">${k.score.toFixed(2)}</span></div>`
          ).join("")}
        </div>
      </div>`
    : "<p style='font-size:12px;color:#888;'>No keyword scoring data available.</p>";

  const pos = (agg.polarity_distribution["Positive"] ?? 0) + (agg.polarity_distribution["Very Positive"] ?? 0);
  const neg = (agg.polarity_distribution["Negative"] ?? 0) + (agg.polarity_distribution["Very Negative"] ?? 0);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SentiScan Report — ${filename}</title>
  <style>
    @page { margin: 20mm 18mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; margin: 0; padding: 0; }
    * { box-sizing: border-box; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div style="max-width:680px;margin:0 auto;padding:32px 0;">

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:28px;border-bottom:2px solid #111;padding-bottom:12px;">
      <div>
        <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">SentiScan</div>
        <div style="font-size:13px;color:#555;margin-top:2px;">Sentiment Analysis Report</div>
      </div>
      <div style="text-align:right;font-size:12px;color:#888;">
        <div>${filename}</div>
        <div>${rowCount} entries · ${now}</div>
      </div>
    </div>

    <!-- Overview pills -->
    <div style="display:flex;gap:12px;margin-bottom:28px;flex-wrap:wrap;">
      ${[
        { label: "Total entries", value: rowCount },
        { label: "Positive or above", value: pct(pos, totalPol) },
        { label: "Negative or below", value: pct(neg, totalPol) },
        { label: "Neutral", value: pct(agg.polarity_distribution["Neutral"] ?? 0, totalPol) },
      ].map((p) => `
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 16px;min-width:120px;">
          <div style="font-size:18px;font-weight:700;">${p.value}</div>
          <div style="font-size:11px;color:#888;margin-top:2px;">${p.label}</div>
        </div>`).join("")}
    </div>

    ${section("01. Polarity Distribution", polarityHTML)}
    ${section("02. Emotion Detection", emoHTML)}
    ${section("03. Intent Classification", intentHTML)}
    ${section("04. Aspect-Based Sentiment (Top 10)", aspectHTML)}
    ${section("05. High-Value Keywords", kwHTML)}
    ${section("06. Topic Modelling", topicsHTML)}
    ${section("07. Temporal Trend", trendHTML)}

    <!-- Footer -->
    <div style="font-size:10px;color:#bbb;border-top:1px solid #e5e7eb;padding-top:10px;margin-top:8px;">
      Generated by SentiScan · ${now}
    </div>
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Pop-up was blocked. Please allow pop-ups for this site to export PDF.");
    return;
  }
  win.document.write(html);
  win.document.close();
}
