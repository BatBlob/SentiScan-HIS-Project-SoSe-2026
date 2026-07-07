import type { FilterChip } from "../../types/api";

interface FilterBarProps {
  active: FilterChip;
  onFilter: (chip: FilterChip) => void;
}

const CHIPS: { id: FilterChip; label: string }[] = [
  { id: "all", label: "All entries" },
  { id: "Positive", label: "Positive" },
  { id: "Negative", label: "Negative" },
  { id: "Neutral", label: "Neutral" },
];

export function FilterBar({ active, onFilter }: FilterBarProps) {
  return (
    <div className="filter-bar">
      <span className="filter-label">Filter:</span>
      {CHIPS.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className={`chip${active === chip.id ? " on" : ""}`}
          onClick={() => onFilter(chip.id)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
