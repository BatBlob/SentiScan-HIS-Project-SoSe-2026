import { useRef } from "react";
import { DIMENSIONS } from "../../constants/themes";

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

interface ConfigGridProps {
  columns: string[];
  textColumn: string;
  timestampColumn: string;
  hasTimestamp: boolean;
  onTextColumn: (v: string) => void;
  onTimestampColumn: (v: string) => void;
  onHasTimestamp: (v: boolean) => void;
}

export function ConfigGrid({
  columns,
  textColumn,
  timestampColumn,
  hasTimestamp,
  onTextColumn,
  onTimestampColumn,
  onHasTimestamp,
}: ConfigGridProps) {
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
      </div>
      <div className="config-box">
        <h3>Analysis Dimensions</h3>
        {DIMENSIONS.map((d) => (
          <label className="checkbox-row" key={d}>
            <input type="checkbox" checked disabled readOnly /> {d}
          </label>
        ))}
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
