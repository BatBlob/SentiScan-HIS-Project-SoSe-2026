import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  exportCsv,
  exportPdf,
  getEntries,
  getSummary,
  loadSessionMeta,
  updateSettings,
} from "../api/client";
import { ExportBar } from "../components/dashboard/ExportBar";
import { FilterBar } from "../components/dashboard/FilterBar";
import { ThemeSidebar } from "../components/dashboard/ThemeSidebar";
import { AspectPanel } from "../components/dashboard/themes/AspectPanel";
import { ConfidencePanel } from "../components/dashboard/themes/ConfidencePanel";
import { EmotionPanel } from "../components/dashboard/themes/EmotionPanel";
import { FineGrainedPanel } from "../components/dashboard/themes/FineGrainedPanel";
import { IntentPanel } from "../components/dashboard/themes/IntentPanel";
import { KeywordsPanel } from "../components/dashboard/themes/KeywordsPanel";
import { SarcasmPanel } from "../components/dashboard/themes/SarcasmPanel";
import { TopicsPanel } from "../components/dashboard/themes/TopicsPanel";
import { TrendPanel } from "../components/dashboard/themes/TrendPanel";
import { THEMES, themeLabel } from "../constants/themes";
import type {
  Aggregates,
  EntryDocument,
  FilterChip,
  SummaryResponse,
  ThemeId,
} from "../types/api";

export function DashboardPage() {
  const { jobId = "" } = useParams();
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [entries, setEntries] = useState<EntryDocument[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [theme, setTheme] = useState<ThemeId>("finegrained");
  const [filter, setFilter] = useState<FilterChip>("all");
  const [excludeSarcasm, setExcludeSarcasm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const meta = loadSessionMeta(jobId);

  const fetchEntries = useCallback(
    async (chip: FilterChip) => {
      const params: Record<string, string | number | boolean> = { limit: 100, page: 1 };
      if (chip === "Positive") params.polarity = "Positive";
      else if (chip === "Negative") params.polarity = "Negative";
      else if (chip === "Neutral") params.polarity = "Neutral";
      const res = await getEntries(jobId, params);
      setEntries(res.entries);
      setTotalEntries(res.total);
    },
    [jobId],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sum, entAll, entSarc] = await Promise.all([
        getSummary(jobId),
        getEntries(jobId, { limit: 100 }),
        getEntries(jobId, { sarcasm: true, limit: 100 }),
      ]);
      setSummary(sum);
      setExcludeSarcasm(!sum.include_sarcasm_in_aggregates);
      setEntries(entAll.entries);
      setTotalEntries(entAll.total);
      if (entSarc.entries.length) {
        const merged = [...entAll.entries];
        entSarc.entries.forEach((e) => {
          if (!merged.find((m) => m.row_index === e.row_index)) merged.push(e);
        });
        setEntries(merged);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleFilter = async (chip: FilterChip) => {
    setFilter(chip);
    try {
      await fetchEntries(chip);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Filter failed");
    }
  };

  const handleSarcasmToggle = async () => {
    const next = !excludeSarcasm;
    try {
      await updateSettings(jobId, !next);
      setExcludeSarcasm(next);
      const sum = await getSummary(jobId);
      setSummary(sum);
      setToast(next ? "Sarcasm excluded from aggregates" : "Sarcasm included in aggregates");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settings update failed");
    }
  };

  const handleCsv = async () => {
    try {
      const blob = await exportCsv(jobId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sentiscan_${jobId.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Export failed");
    }
  };

  const handlePdf = async () => {
    try {
      await exportPdf(jobId);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "PDF export failed");
    }
  };

  const themeIndex = THEMES.findIndex((t) => t.id === theme);
  const prevTheme = THEMES[Math.max(0, themeIndex - 1)]?.id;
  const nextTheme = THEMES[Math.min(THEMES.length - 1, themeIndex + 1)]?.id;

  if (loading) {
    return (
      <div className="app">
        <div className="loading-screen">Loading analysis results...</div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="app">
        <div className="loading-screen">
          {error || "No data"}
          <br />
          <Link to="/" style={{ marginTop: 12, display: "inline-block" }}>Back to upload</Link>
        </div>
      </div>
    );
  }

  const aggregates: Aggregates = summary.aggregates;
  const panelProps = { aggregates, entries, totalEntries };

  return (
    <div className="app">
      <div className="app-bar">
        <div className="app-logo">SentiScan</div>
        <div className="app-bar-meta">
          {meta?.filename ?? "Dataset"} · {meta?.row_count ?? totalEntries} entries
        </div>
        <div className="app-bar-actions">
          <button type="button" className="btn" onClick={handleCsv}>Export CSV</button>
          <button type="button" className="btn btn-dark" onClick={handlePdf}>Export PDF</button>
        </div>
      </div>

      <div className="dash-shell">
        <ThemeSidebar active={theme} onSelect={setTheme} />
        <div className="theme-main">
          <div className="main-topbar">
            <div className="theme-breadcrumb">
              Results → <strong>{themeIndex + 1}. {themeLabel(theme)}</strong>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn" disabled={themeIndex === 0} onClick={() => prevTheme && setTheme(prevTheme)}>
                ← Previous
              </button>
              <button type="button" className="btn" disabled={themeIndex === THEMES.length - 1} onClick={() => nextTheme && setTheme(nextTheme)}>
                Next →
              </button>
            </div>
          </div>

          <FilterBar
            active={filter}
            onFilter={handleFilter}
            excludeSarcasm={excludeSarcasm}
            onToggleSarcasm={handleSarcasmToggle}
          />

          <div className={`theme-panel active`}>
            {theme === "finegrained" && <FineGrainedPanel {...panelProps} />}
            {theme === "aspect" && <AspectPanel {...panelProps} />}
            {theme === "emotion" && <EmotionPanel {...panelProps} />}
            {theme === "intent" && <IntentPanel {...panelProps} />}
            {theme === "sarcasm" && (
              <SarcasmPanel
                {...panelProps}
                excludeSarcasm={excludeSarcasm}
                onExcludeToggle={handleSarcasmToggle}
              />
            )}
            {theme === "keywords" && <KeywordsPanel {...panelProps} />}
            {theme === "topics" && <TopicsPanel {...panelProps} />}
            {theme === "trend" && <TrendPanel {...panelProps} />}
            {theme === "confidence" && <ConfidencePanel {...panelProps} />}
          </div>

          <ExportBar onCsv={handleCsv} onPdf={handlePdf} />
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 20, right: 20, background: "#111", color: "#fff", padding: "10px 16px", borderRadius: 6, fontSize: 12 }}>
          {toast}
          <button type="button" style={{ marginLeft: 10, background: "none", border: "none", color: "#aaa", cursor: "pointer" }} onClick={() => setToast("")}>×</button>
        </div>
      )}
    </div>
  );
}
