/**
 * Navy tick outline for the tick-and-pathogen model slot.
 * The icon identifies the model, not the county's result.
 */
export function TickOutlineIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 3.75v2.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.75"
      />
      <ellipse
        cx="12"
        cy="13.4"
        rx="3.15"
        ry="5.35"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M9.15 9.7 5.2 6.6M8.7 12.2 4.4 12M9 15.1 5.1 17.4M9.5 17.6 6.5 20.6M14.85 9.7 18.8 6.6M15.3 12.2 19.6 12M15 15.1 18.9 17.4M14.5 17.6 17.5 20.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}
