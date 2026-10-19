/**
 * Escape one Markdown table cell. A literal pipe would start another column,
 * a backtick would open inline code, and a newline would end the row.
 */
export function markdownTableCell(
  value: string,
  options?: { code?: boolean }
): string {
  const singleLine = value.replaceAll(/\r\n?|\n/g, " ");
  if (options?.code) {
    const fence = "`".repeat(longestBacktickRun(singleLine) + 1);
    const padded =
      singleLine.startsWith("`") || singleLine.endsWith("`")
        ? ` ${singleLine} `
        : singleLine;
    return `${fence}${escapeTablePipes(padded)}${fence}`;
  }
  return escapeTablePipes(singleLine).replaceAll("`", "\\`");
}

function escapeTablePipes(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("|", "\\|");
}

function longestBacktickRun(value: string): number {
  let longest = 0;
  let current = 0;
  for (const character of value) {
    if (character === "`") {
      current += 1;
      longest = Math.max(longest, current);
      continue;
    }
    current = 0;
  }
  return longest;
}
