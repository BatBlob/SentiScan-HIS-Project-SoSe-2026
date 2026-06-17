import { THEMES } from "../../constants/themes";
import type { ThemeId } from "../../types/api";

interface ThemeSidebarProps {
  active: ThemeId;
  onSelect: (id: ThemeId) => void;
}

export function ThemeSidebar({ active, onSelect }: ThemeSidebarProps) {
  return (
    <div className="theme-sidebar">
      <div className="sidebar-label">Analysis Themes</div>
      {THEMES.map((theme) => (
        <div
          key={theme.id}
          className={`theme-item${active === theme.id ? " active" : ""}`}
          onClick={() => onSelect(theme.id)}
          onKeyDown={(e) => e.key === "Enter" && onSelect(theme.id)}
          role="button"
          tabIndex={0}
        >
          <div className="theme-icon" style={{ background: theme.bg }}>
            {theme.icon}
          </div>
          <div>
            <div className="theme-num">{theme.num}</div>
            <div className="theme-name">{theme.name}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
