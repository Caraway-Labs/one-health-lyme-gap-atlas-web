/**
 * Deterministic uncompressed PDF for transport tests.
 * Opening it proves the downloaded bytes. It is not a Typst report,
 * and it does not show that any measure is published in production.
 */

export const ADAMS_COUNTY_PDF_TEXT =
  "Adams County, Colorado. Test fixture only. Not a production report.";

export const BOULDER_COUNTY_PDF_TEXT =
  "Boulder County, Colorado. Test fixture only. Not a production report.";

export type OpenedPdfFixture = {
  objectCount: number;
  text: string;
  version: string;
};

const XREF_ENTRY = /^(?<offset>\d{10}) (?<generation>\d{5}) (?<use>[nf]) $/;

function assertAsciiLiteral(text: string): void {
  const unsafe = /[()\\]/u.test(text);
  const nonAscii = [...text].some((character) => {
    const point = character.codePointAt(0) ?? 0;
    return point > 127;
  });
  if (unsafe || nonAscii) {
    throw new Error("PDF fixture text must be ASCII without parentheses.");
  }
}

function pageStream(text: string): string {
  const content = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  return `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
}

export function buildPdfFixture(text: string): Uint8Array {
  assertAsciiLiteral(text);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    pageStream(text),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let source = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(source.length);
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefAt = source.length;
  source += `xref\n0 ${objects.length + 1}\n`;
  source += "0000000000 65535 f \n";
  for (const offset of offsets) {
    source += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  source += `startxref\n${xrefAt}\n%%EOF\n`;
  return new TextEncoder().encode(source);
}

export const adamsCountyPdfFixture = buildPdfFixture(ADAMS_COUNTY_PDF_TEXT);
export const boulderCountyPdfFixture = buildPdfFixture(BOULDER_COUNTY_PDF_TEXT);

export function openPdfFixture(bytes: Uint8Array): OpenedPdfFixture {
  const source = new TextDecoder("latin1").decode(bytes);
  const version = /^%PDF-(?<version>\d+\.\d+)\n/u.exec(source)?.groups?.version;
  if (!version) {
    throw new Error("PDF header is missing.");
  }
  const start = /startxref\n(?<offset>\d+)\n%%EOF\n$/u.exec(source);
  const xrefAt = Number(start?.groups?.offset);
  if (
    !(
      start &&
      Number.isInteger(xrefAt) &&
      source.startsWith("xref\n", xrefAt) &&
      source.includes("/Root 1 0 R")
    )
  ) {
    throw new Error("PDF xref is missing.");
  }
  const lines = source.slice(xrefAt).split("\n");
  const subsection = /^(?<start>\d+) (?<count>\d+)$/u.exec(lines[1] ?? "");
  const startObject = Number(subsection?.groups?.start);
  const count = Number(subsection?.groups?.count);
  if (
    !(
      subsection &&
      Number.isInteger(startObject) &&
      Number.isInteger(count) &&
      count >= 2
    )
  ) {
    throw new Error("PDF xref subsection is missing.");
  }
  const entryLines = lines.slice(2, 2 + count);
  if (entryLines.length !== count) {
    throw new Error("PDF xref entries are missing.");
  }
  let objectCount = 0;
  let objectNumber = startObject;
  for (const line of entryLines) {
    const entry = XREF_ENTRY.exec(line);
    if (!entry?.groups) {
      throw new Error(`PDF xref entry ${objectNumber} is malformed.`);
    }
    if (entry.groups.use === "n") {
      const offset = Number(entry.groups.offset);
      const header = `${objectNumber} 0 obj\n`;
      if (!source.startsWith(header, offset)) {
        throw new Error(
          `PDF object ${objectNumber} is not at its xref offset.`
        );
      }
      objectCount += 1;
    }
    objectNumber += 1;
  }
  const text = [...source.matchAll(/\((?<literal>[^)\\]*)\) Tj/gu)]
    .map((match) => match.groups?.literal ?? "")
    .join("");
  if (!(text && objectCount > 0)) {
    throw new Error("PDF fixture has no readable text.");
  }
  return { objectCount, text, version };
}

export async function concatChunks(
  chunks: AsyncIterable<Uint8Array | string>
): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  for await (const chunk of chunks) {
    parts.push(
      typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk
    );
  }
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes;
}
