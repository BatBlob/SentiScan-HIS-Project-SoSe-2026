import type { FilterChip } from "../../types/api";

interface FilterBarProps {
  active: FilterChip;
  onFilter: (chip: FilterChip) => void;
  excludeSarcasm: boolean;
  onToggleSarcasm: () => void;
}

const CHIPS: { id: FilterChip; label: string }[] = [
  { id: "all", label: "All entries" },
  { id: "Positive", label: "Positive" },
  { id: "Negative", label: "Negative" },
  { id: "Neutral", label: "Neutral" },
];

export function FilterBar({ active, onFilter, excludeSarcasm, onToggleSarcasm }: FilterBarProps) {
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
      <div className="toggle-wrap">
        Exclude sarcasm
        <div
          className={`toggle${excludeSarcasm ? " on" : ""}`}
          onClick={onToggleSarcasm}
          onKeyDown={(e) => e.key === "Enter" && onToggleSarcasm()}
          role="switch"
          aria-checked={excludeSarcasm}
          tabIndex={0}
        />
      </div>
    </div>
  );
}
