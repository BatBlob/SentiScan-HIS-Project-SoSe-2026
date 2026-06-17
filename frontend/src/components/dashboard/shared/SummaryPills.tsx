interface SummaryPillsProps {
  items: { label: string; value: string | number }[];
}

export function SummaryPills({ items }: SummaryPillsProps) {
  return (
    <div className="summary-pills">
      {items.map((item) => (
        <div className="pill" key={item.label}>
          <strong>{item.value}</strong>
          {item.label}
        </div>
      ))}
    </div>
  );
}
