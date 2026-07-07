import { useRef, useState } from "react";
import type { RowRange } from "../../types/api";
import { DIMENSION_CONFIG, type DimensionId } from "../../constants/themes";

interface UploadZoneProps {
  onFile: (file: File) => void;
  filename?: string;
  error?: string;
  disabled?: boolean;
}

export function UploadZone({ onFile, filename, error, disabled }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file || disabled) return;
    onFile(file);
  };

  return (
    <>
      <div
        className="upload-zone"
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!disabled) handleFile(e.dataTransfer.files[0]);
        }}
      >
        <div style={{ fontSize: 26, color: "#bbb", marginBottom: 10 }}>⬆</div>
        <div className="upload-title">Upload your document</div>
        <div className="upload-sub">.csv · Max 10,000 rows</div>
        {filename ? (
          <div style={{ fontSize: 12, color: "#16a34a", marginBottom: 12 }}>Selected: {filename}</div>
        ) : null}
        <button type="button" className="btn" disabled={disabled} onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
          Browse Files
        </button>
      </div>
      <input
        ref={inputRef}
        className="hidden-input"
        type="file"
        accept=".csv"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error ? <div className="error-msg">{error}</div> : null}
    </>
  );
}

interface RowRangeSelectorProps {
  rowCount: number;
  ranges: RowRange[];
  onChange: (ranges: RowRange[]) => void;
}

export function RowRangeSelector({ rowCount, ranges, onChange }: RowRangeSelectorProps) {
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const [err, setErr] = useState("");

  const addRange = () => {
    const s = parseInt(draftStart, 10);
    const e = parseInt(draftEnd, 10);
    if (Number.isNaN(s) || Number.isNaN(e)) { setErr("Enter valid numbers."); return; }
    if (s < 1) { setErr("Start must be ≥ 1."); return; }
    if (e < s) { setErr("End must be ≥ start."); return; }
    if (rowCount > 0 && s > rowCount) { setErr(`Start exceeds dataset size (${rowCount} rows).`); return; }
    setErr("");
    onChange([...ranges, { start: s, end: Math.min(e, rowCount || e) }]);
    setDraftStart("");
    setDraftEnd("");
  };

  const removeRange = (idx: number) => onChange(ranges.filter((_, i) => i !== idx));

  return (
    <div style={{ marginTop: 10 }}>
      <div className="field-label">Row ranges to include (optional)</div>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>
        Leave empty to use all rows. Add multiple ranges, e.g. 1–100 and 250–350.
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="number"
          className="field-select"
          style={{ width: 90 }}
          placeholder="Start"
          min={1}
          value={draftStart}
          onChange={(e) => setDraftStart(e.target.value)}
        />
        <span style={{ fontSize: 12, color: "#555" }}>–</span>
        <input
          type="number"
          className="field-select"
          style={{ width: 90 }}
          placeholder="End"
          min={1}
          value={draftEnd}
          onChange={(e) => setDraftEnd(e.target.value)}
        />
        <button type="button" className="btn" style={{ padding: "4px 12px", fontSize: 12 }} onClick={addRange}>
          + Add
        </button>
      </div>
      {err && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{err}</div>}
      {ranges.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {ranges.map((r, i) => (
            <span
              key={i}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "#f0fdf4", border: "1px solid #bbf7d0",
                borderRadius: 4, padding: "2px 8px", fontSize: 12,
              }}
            >
              rows {r.start}–{r.end}
              <button
                type="button"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#888", padding: 0, lineHeight: 1 }}
                onClick={() => removeRange(i)}
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            style={{ fontSize: 11, color: "#888", background: "none", border: "none", cursor: "pointer" }}
            onClick={() => onChange([])}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}


interface ConfigGridProps {
  columns: string[];
  rowCount: number;
  textColumn: string;
  timestampColumn: string;
  hasTimestamp: boolean;
  rowRanges: RowRange[];
  enabledDimensions: DimensionId[];
  onTextColumn: (v: string) => void;
  onTimestampColumn: (v: string) => void;
  onHasTimestamp: (v: boolean) => void;
  onRowRanges: (ranges: RowRange[]) => void;
  onEnabledDimensions: (ids: DimensionId[]) => void;
}

export function ConfigGrid({
  columns,
  rowCount,
  textColumn,
  timestampColumn,
  hasTimestamp,
  rowRanges,
  enabledDimensions,
  onTextColumn,
  onTimestampColumn,
  onHasTimestamp,
  onRowRanges,
  onEnabledDimensions,
}: ConfigGridProps) {
  const toggle = (id: DimensionId) => {
    if (enabledDimensions.includes(id)) {
      onEnabledDimensions(enabledDimensions.filter((d) => d !== id));
    } else {
      onEnabledDimensions([...enabledDimensions, id]);
    }
  };
  return (
    <div className="config-grid">
      <div className="config-box">
        <h3>Dataset Configuration</h3>
        <div className="field-label">Which column contains the text?</div>
        <select className="field-select" value={textColumn} onChange={(e) => onTextColumn(e.target.value)}>
          <option value="">Select column...</option>
          {columns.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <div className="field-label">Does your dataset include timestamps?</div>
        <label className="checkbox-row">
          <input type="checkbox" checked={hasTimestamp} onChange={(e) => onHasTimestamp(e.target.checked)} />
          Yes — enable temporal trend analysis
        </label>
        {hasTimestamp && (
          <>
            <div className="field-label" style={{ marginTop: 6 }}>Timestamp column</div>
            <select className="field-select" style={{ marginBottom: 0 }} value={timestampColumn} onChange={(e) => onTimestampColumn(e.target.value)}>
              <option value="">Select column...</option>
              {columns.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </>
        )}
        <RowRangeSelector rowCount={rowCount} ranges={rowRanges} onChange={onRowRanges} />
      </div>
      <div className="config-box">
        <h3>Analysis Dimensions</h3>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>
          Uncheck dimensions you don't need to speed up the analysis.
        </div>
        {DIMENSION_CONFIG.map((d) => {
          const checked = enabledDimensions.includes(d.id as DimensionId);
          return (
            <label
              key={d.id}
              className="checkbox-row"
              style={{ cursor: d.locked ? "default" : "pointer", color: d.locked ? "#9ca3af" : "#374151" }}
            >
              <input
                type="checkbox"
                checked={d.locked ? true : checked}
                disabled={d.locked}
                onChange={() => { if (!d.locked) toggle(d.id as DimensionId); }}
              />
              {d.num}. {d.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

interface StepsRowProps {
  step: 1 | 2 | 3;
}

export function StepsRow({ step }: StepsRowProps) {
  const steps = [
    { n: 1, label: "Upload Document" },
    { n: 2, label: "Configure" },
    { n: 3, label: "Run Analysis" },
  ];
  return (
    <div className="steps-row">
      {steps.map((s, i) => (
        <span key={s.n} style={{ display: "contents" }}>
          <div className={`step${step >= s.n ? " active" : ""}`}>
            <div className="step-num">{s.n}</div>
            {s.label}
          </div>
          {i < steps.length - 1 && <div className="step-divider" />}
        </span>
      ))}
    </div>
  );
}
