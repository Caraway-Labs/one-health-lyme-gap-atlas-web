function calendarParts(
  now: Date,
  timeZone: string
): { day: number; month: number; year: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return {
    day: Number(parts.day),
    month: Number(parts.month),
    year: Number(parts.year),
  };
}

/** Calendar subtraction in UTC so a DST transition cannot shift the date. */
export function shiftCalendarDate(
  year: number,
  month: number,
  day: number,
  daysBack: number
): string {
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() - daysBack);
  const shiftedYear = String(shifted.getUTCFullYear()).padStart(4, "0");
  const shiftedMonth = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const shiftedDay = String(shifted.getUTCDate()).padStart(2, "0");
  return `${shiftedYear}-${shiftedMonth}-${shiftedDay}`;
}

/**
 * Local calendar date `daysBack` before `now`. `timeZone` defaults to the
 * runtime local zone. Callers compute this when a request is built.
 */
export function localCalendarDaysBefore(
  daysBack: number,
  now: Date,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
): string {
  const { day, month, year } = calendarParts(now, timeZone);
  return shiftCalendarDate(year, month, day, daysBack);
}
