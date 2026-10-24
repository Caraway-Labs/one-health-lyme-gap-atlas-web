const PERCENT_SCALE = 100;
const ONE_DECIMAL = 1;

/** Display-boundary percentile. The underlying number stays on the view model. */
export function formatPercentileOneDecimal(value: number): string {
  return value.toFixed(ONE_DECIMAL);
}

/** Full 0–1 membership value. Rounding happens only in the percent display. */
export function formatFullProbability(value: number): string {
  if (Object.is(value, -0)) {
    return "0";
  }
  return value.toString();
}

/**
 * Sensible class-membership display. A non-zero value that would round to 0.0%
 * or 100.0% keeps the full 0–1 value instead of becoming a false zero or one.
 */
export function formatClassMembership(value: number): string {
  const percent = (value * PERCENT_SCALE).toFixed(ONE_DECIMAL);
  const collapsesNonZero =
    (percent === "0.0" && value !== 0) || (percent === "100.0" && value !== 1);
  if (collapsesNonZero) {
    return `${formatFullProbability(value)} on a 0–1 scale`;
  }
  return `${percent}%`;
}

/**
 * Plain-language membership. Ordinary values use one decimal place without a
 * trailing .0. Positive values that would display as 0.0% stay distinct from
 * a real zero. Full precision stays available to technical details.
 */
export function formatPlainMembershipPercent(value: number): string | null {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    return null;
  }
  if (value === 0 || Object.is(value, -0)) {
    return "0%";
  }
  if (value === 1) {
    return "100%";
  }
  const percent = (value * PERCENT_SCALE).toFixed(ONE_DECIMAL);
  if (percent === "0.0") {
    return "Less than 0.1%";
  }
  if (percent === "100.0") {
    return "Less than 100%";
  }
  const display = percent.endsWith(".0") ? percent.slice(0, -2) : percent;
  return `${display}%`;
}

export function formatPublishedGapScore(value: number): string {
  return value.toFixed(ONE_DECIMAL);
}
