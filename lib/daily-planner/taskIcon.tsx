import type { TaskColorKey } from "./taskColor";

/**
 * Small line-icon per task category — mirrors Structured's "island with an
 * icon" look, where the icon badge itself doubles as the done-toggle.
 */
export function CategoryIcon({
  category,
  size = 12,
  className,
}: {
  category: TaskColorKey;
  size?: number;
  className?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true as const,
  };

  switch (category) {
    case "prayer":
      return (
        <svg {...common}>
          <path d="M12 3l1.9 5.8H20l-5 3.6 1.9 5.8L12 14.6l-4.9 3.6 1.9-5.8-5-3.6h6.1z" />
        </svg>
      );
    case "sleep":
      return (
        <svg {...common}>
          <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
        </svg>
      );
    case "work":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
        </svg>
      );
    case "exercise":
      return (
        <svg {...common}>
          <path d="M4 9v6M20 9v6M2 10.5v3M22 10.5v3M7 12h10" />
          <rect x="4" y="9" width="3" height="6" rx="1" />
          <rect x="17" y="9" width="3" height="6" rx="1" />
        </svg>
      );
    case "food":
      return (
        <svg {...common}>
          <path d="M7 2v6a2 2 0 0 0 2 2v12M7 2v20M11 2v10M17 2c-1.1 0-2 1.8-2 4s.9 4 2 4 2-1.8 2-4-.9-4-2-4zM17 10v12" />
        </svg>
      );
    case "family":
      return (
        <svg {...common}>
          <path d="M20.8 4.6a4.5 4.5 0 0 0-6.4 0L12 7l-2.4-2.4a4.5 4.5 0 1 0-6.4 6.4L12 19.6l8.8-8.6a4.5 4.5 0 0 0 0-6.4z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
