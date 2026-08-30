import type { SVGProps } from "react";

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export const TrophyIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
  </svg>
);

export const RosterIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M9 9v11M15 9v11" />
  </svg>
);

export const PalmIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 21c0-6 1-10 3-13" />
    <path d="M15 8c-3-3-7-2-9 1 3-1 6 0 9-1Z" />
    <path d="M15 8c3-3 7-2 9 1-3-1-6 0-9-1Z" />
    <path d="M15 8c-1-4 1-6 4-6-1 2-1 4-4 6Z" />
    <path d="M15 8c1-4-1-6-4-6 1 2 1 4 4 6Z" />
    <path d="M5 21c2-2 4-2 6-1" />
  </svg>
);

export const TvIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M8 2l4 4 4-4" />
  </svg>
);

export const ScrollIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 3h11a3 3 0 0 1 3 3v1h-4" />
    <path d="M6 3a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h11a3 3 0 0 0 3-3v-1H9" />
    <path d="M8 8h6M8 12h6" />
  </svg>
);

export const ChevronIcon = ({ open, ...p }: SVGProps<SVGSVGElement> & { open?: boolean }) => (
  <svg {...base(p)} style={{ transition: "transform .2s", transform: open ? "rotate(180deg)" : undefined, ...p.style }}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const FlameIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9Z" />
  </svg>
);
