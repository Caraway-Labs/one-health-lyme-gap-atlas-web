import { UserRound } from "lucide-react";

const ICON_PROPS = {
  "aria-hidden": true,
  fill: "none",
  focusable: false,
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 1.7,
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
} as const;

function TickIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M10.5 5V3M13.5 5V3M8 8 5 6 4 3M8 11 4 10 2 8M8 14 4 15 2 18M9 17 6 19 5 22M16 8 19 6 20 3M16 11 20 10 22 8M16 14 20 15 22 18M15 17 18 19 19 22" />
      <ellipse
        className="front-porch-tick-body"
        cx="12"
        cy="12"
        rx="4.3"
        ry="6"
      />
    </svg>
  );
}

function CommunityIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="6.5" r="2.8" />
      <circle cx="4.5" cy="8.5" r="2.1" />
      <circle cx="19.5" cy="8.5" r="2.1" />
      <path d="M7 21v-3.5a5 5 0 0 1 10 0V21M1.5 19v-3a3 3 0 0 1 4.3-2.7M22.5 19v-3a3 3 0 0 0-4.3-2.7" />
    </svg>
  );
}

export function FrontPorchEvidenceIcon({ index }: { index: number }) {
  if (index === 0) {
    return <UserRound aria-hidden="true" size={16} strokeWidth={1.7} />;
  }
  if (index === 1) {
    return <TickIcon />;
  }
  return <CommunityIcon />;
}
