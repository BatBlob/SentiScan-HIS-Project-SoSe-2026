interface ExportBarProps {
  onCsv: () => void;
  onPdf: () => void;
}

export function ExportBar({ onCsv, onPdf }: ExportBarProps) {
  return (
    <div className="export-bar">
      <div>Results include: sentiment · emotion · intent · confidence · sarcasm flags</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn" onClick={onCsv}>
          Download CSV
        </button>
        <button type="button" className="btn btn-dark" onClick={onPdf}>
          Download PDF Report
        </button>
      </div>
    </div>
  );
}
