interface BarRowProps {
  label: string;
  pct: number;
  fillClass: string;
}

export function BarRow({ label, pct, fillClass }: BarRowProps) {
  return (
    <div className="bar-row">
      <div className="bar-label">{label}</div>
      <div className="bar-track">
        <div className={`bar-fill ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="bar-pct">{pct}%</div>
    </div>
  );
}
