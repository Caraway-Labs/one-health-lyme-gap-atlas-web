import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const report = JSON.parse(await readFile(process.argv[2], "utf-8"));
const directory = "design-references/front-porch/review";
await mkdir(directory, { recursive: true });
const ratios = [];
async function visit(suite) {
  for (const spec of suite.specs ?? []) {
    const width = spec.title.match(/composition (?<width>\d+)/)?.groups?.width;
    if (!width) {
      continue;
    }
    const result = spec.tests[0].results.at(-1);
    for (const attachment of result.attachments ?? []) {
      const body = attachment.path
        ? await readFile(attachment.path)
        : Buffer.from(attachment.body, "base64");
      if (attachment.contentType === "image/png") {
        await writeFile(
          path.join(directory, `${attachment.name}-${width}.png`),
          body
        );
      }
      if (attachment.name === "diff-ratio") {
        ratios.push(JSON.parse(body.toString()));
      }
    }
  }
  for (const child of suite.suites ?? []) {
    await visit(child);
  }
}
for (const suite of report.suites) {
  await visit(suite);
}
await writeFile(
  path.join(directory, "ratios.json"),
  `${JSON.stringify(ratios, null, 2)}\n`
);
const panels = [
  ["approved-original", "Original approved prototype (older copy)"],
  ["baseline", "Production before this correction"],
  ["implementation-page", "New React implementation"],
  ["approved-with-final-copy", "Reference with finalized copy"],
  ["highlighted-reference-diff", "Highlighted direct comparison"],
];
const sections = [1440, 1280, 390, 320]
  .map(
    (width) =>
      `<section><h2>${width}px</h2><div class="grid">${panels.map(([file, label]) => `<figure><figcaption>${label}</figcaption><a href="${file}-${width}.png"><img src="${file}-${width}.png" alt="${label} at ${width}px"></a></figure>`).join("")}</div></section>`
  )
  .join("");
await writeFile(
  path.join(directory, "index.html"),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Web 483 visual review</title><style>body{font:16px system-ui;margin:24px;background:#f6f7f2;color:#133841}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}figure{margin:0}figcaption{padding:12px 0}img{width:100%;height:auto}section{margin-bottom:48px}</style><h1>Web #483 — product-owner visual review</h1><p>Original prototype, production baseline, candidate and highlighted comparison. Click an image for full resolution. Copy changes follow #475; the provisional county is omitted. At 320px header and callout padding prevent clipping. Qualitative scenes 2–6 remain interim.</p><p>Direct hero comparison: ${ratios.map((result) => `${result.viewport.width}px: ${(result.mismatchRatio * 100).toFixed(3)}%`).join("; ")}. Maximum 2%; RGB channel delta tolerance 51/255. No masking.</p>${sections}</html>`
);
console.log(JSON.stringify({ stats: report.stats, ratios }));
