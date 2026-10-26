import {
  API_PLAYGROUND_OPERATIONS,
  playgroundProxyPath,
} from "@/features/docs/api-playground-operations";
import { displayGeometryCurl } from "@/features/docs/display-geometry-example";
import {
  type HttpClientBody,
  type HttpClientExamples,
  type HttpClientRequest,
  HTTP_CLIENT_LANGUAGES,
  httpClientExamples,
  httpClientPaginationExamples,
  resolveHttpClientRequests,
} from "@/features/docs/http-client-examples";
import { ATLAS_INTERPRETATION_GUARDRAILS } from "@/features/docs/interpretation-guardrails";
import {
  observationCurl,
  publishedGetCurl,
} from "@/features/docs/observation-query-example";
import {
  observationNullSemantics,
  provenanceCitationPaths,
  provenanceNameRows,
} from "@/features/docs/provenance-evidence-model";
import {
  PENDING_DELIVERY_BADGE_LABEL,
  PENDING_DELIVERY_NOTE,
} from "@/lib/endpoint-delivery";
import { markdownTableCell } from "@/lib/markdown-table";
import {
  readAndLoadPublicOpenApiContract,
  renderPinnedOperationMarkdown,
  type LoadedPublicOpenApiContract,
} from "@/lib/public-openapi-reference";
import { PRODUCTION_API_ORIGIN } from "@/lib/public-origins";

const SELF_CLOSING_COMPONENT =
  /<(?<name>[A-Z][A-Za-z0-9]*)(?<attributes>\s[^>]*?)?\/>/g;
const OPENAPI_COMPONENT = /<OpenAPIPage\b(?<attributes>[^>]*?)\/>/g;

type ComponentAttributes = Record<string, unknown>;

let pinnedContract: LoadedPublicOpenApiContract | undefined;

function contract(): LoadedPublicOpenApiContract {
  pinnedContract ??= readAndLoadPublicOpenApiContract(process.cwd());
  return pinnedContract;
}

/**
 * Replace component tags in processed Markdown with the text those components
 * render, using the pinned OpenAPI contract and the shared docs data.
 * Operation pages keep that content in an MDX layout export, which the
 * processed stringifier drops, so those operations are read from the raw page.
 */
export function expandDocsComponents(processed: string, raw: string): string {
  const renderedOperations = new Set<string>();
  const expanded = processed.replace(
    SELF_CLOSING_COMPONENT,
    (match, name: string, attributeSource: string | undefined) => {
      if (name === "OpenAPIPage") {
        return renderOpenApiTags(match, renderedOperations);
      }
      return renderKnownComponent(name, parseAttributes(attributeSource ?? ""));
    }
  );
  const operations = renderOpenApiTags(raw, renderedOperations);
  const withOperations =
    operations.length > 0 ? `${expanded.trimEnd()}\n\n${operations}` : expanded;
  return unwrapStructuralTags(withOperations).replaceAll(/\n{3,}/g, "\n\n");
}

function renderOpenApiTags(source: string, rendered: Set<string>): string {
  const sections: string[] = [];
  for (const match of source.matchAll(OPENAPI_COMPONENT)) {
    const attributes = parseAttributes(match[1] ?? "");
    const operations = attributes.operations;
    if (!Array.isArray(operations)) {
      throw new TypeError("OpenAPIPage requires an operations list.");
    }
    for (const operation of operations) {
      if (
        !isRecord(operation) ||
        typeof operation.method !== "string" ||
        typeof operation.path !== "string"
      ) {
        throw new Error("OpenAPIPage operation requires a method and path.");
      }
      const key = `${operation.method.toUpperCase()} ${operation.path}`;
      if (rendered.has(key)) continue;
      rendered.add(key);
      sections.push(
        renderPinnedOperationMarkdown(
          contract(),
          operation.method,
          operation.path
        )
      );
    }
  }
  return sections.join("\n\n");
}

function renderKnownComponent(
  name: string,
  attributes: ComponentAttributes
): string {
  switch (name) {
    case "Card": {
      return cardMarkdown(attributes);
    }
    case "ApiPlayground": {
      const operation = API_PLAYGROUND_OPERATIONS[0];
      const example = operation?.examples[0];
      if (!operation || !example) {
        throw new Error("API playground operations are missing.");
      }
      const requestPath = playgroundProxyPath(
        operation,
        example.values
      ).replace(/^\/api\/proxy/, PRODUCTION_API_ORIGIN);
      return `Anonymous read-only playground. One example request:\n\n${codeFence(`GET ${requestPath}`)}`;
    }
    case "DisplayGeometryCurl": {
      return codeFence(displayGeometryCurl());
    }
    case "EndpointDeliveryBadge": {
      return `${PENDING_DELIVERY_BADGE_LABEL} ${PENDING_DELIVERY_NOTE}`;
    }
    case "HttpClientPagination": {
      return clientExampleMarkdown(
        httpClientPaginationExamples({
          path: requiredString(attributes, "path"),
          query: requiredString(attributes, "query"),
        })
      );
    }
    case "HttpClientTabs": {
      return clientExampleMarkdown(
        httpClientExamples(
          resolveHttpClientRequests({
            body: httpBody(attributes.body),
            path: optionalString(attributes.path),
            query: optionalString(attributes.query),
            requests: httpRequests(attributes.requests),
          })
        )
      );
    }
    case "InterpretationGuardrailCopy": {
      return `#### Interpret with care\n\n${codeFence(ATLAS_INTERPRETATION_GUARDRAILS, "text")}`;
    }
    case "ObservationCurl": {
      return codeFence(observationCurl(requiredString(attributes, "query")));
    }
    case "ProvenanceCitationSteps": {
      return citationStepsMarkdown();
    }
    case "ProvenanceFieldNames": {
      return provenanceFieldMarkdown();
    }
    case "ValueStateNullTable": {
      return nullSemanticsMarkdown();
    }
    default: {
      throw new Error(
        `Docs Markdown export cannot render <${name} /> from the current docs source.`
      );
    }
  }
}

function clientExampleMarkdown(examples: HttpClientExamples): string {
  return HTTP_CLIENT_LANGUAGES.map(
    (language) => `#### ${language}\n\n${codeFence(examples[language])}`
  ).join("\n\n");
}

function citationStepsMarkdown(): string {
  return [
    "### Discover",
    codeFence(publishedGetCurl(provenanceCitationPaths.discoverSources)),
    codeFence(publishedGetCurl(provenanceCitationPaths.discoverMeasure)),
    "### Observe",
    codeFence(publishedGetCurl(provenanceCitationPaths.observeGap)),
    "### Resolve",
    codeFence(publishedGetCurl(provenanceCitationPaths.resolveSource)),
    codeFence(publishedGetCurl(provenanceCitationPaths.resolveMethodology)),
  ].join("\n\n");
}

function nullSemanticsMarkdown(): string {
  const rows = Object.entries(observationNullSemantics).map(([name, field]) =>
    markdownTableRow([
      markdownTableCell(name, { code: true }),
      markdownTableCell(field.type),
      markdownTableCell(field.required ? "yes" : "no"),
      markdownTableCell(field.description),
    ])
  );
  return [
    markdownTableRow(["Field", "Type", "Required", "Description"]),
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

function provenanceFieldMarkdown(): string {
  const rows = provenanceNameRows.map((row) =>
    markdownTableRow([
      markdownTableCell(row.name, { code: true }),
      markdownTableCell(row.schema),
      markdownTableCell(row.type),
      markdownTableCell(row.required ? "yes" : "no"),
      markdownTableCell(row.description),
    ])
  );
  return [
    markdownTableRow(["Field", "Schema", "Type", "Required", "Description"]),
    "| --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

export { markdownTableCell } from "@/lib/markdown-table";

function markdownTableRow(cells: readonly string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function cardMarkdown(attributes: ComponentAttributes): string {
  const title = requiredString(attributes, "title");
  const href = optionalString(attributes.href);
  const description = optionalString(attributes.description);
  const heading = href ? `[${title}](${href})` : title;
  return description ? `${heading}\n\n${description}` : heading;
}

function titledBlock(attributeSource: string, fallback: string): string {
  const title = parseAttributes(attributeSource).title;
  const heading = typeof title === "string" ? title : fallback;
  return `\n\n#### ${heading}\n\n`;
}

function unwrapStructuralTags(markdown: string): string {
  return markdown
    .replaceAll(/<Tabs\b[^>]*>/g, "")
    .replaceAll("</Tabs>", "")
    .replaceAll(
      /<Tab\b(?<attributes>[^>]*)>/g,
      (_match, attributeSource: string) => {
        const value = parseAttributes(attributeSource).value;
        const heading = typeof value === "string" ? value : "Section";
        return `\n\n### ${heading}\n\n`;
      }
    )
    .replaceAll("</Tab>", "")
    .replaceAll(
      /<Callout\b(?<attributes>[^>]*)>/g,
      (_match, attributeSource: string) => titledBlock(attributeSource, "Note")
    )
    .replaceAll("</Callout>", "")
    .replaceAll(/<Accordions\b[^>]*>/g, "")
    .replaceAll("</Accordions>", "")
    .replaceAll(
      /<Accordion\b(?<attributes>[^>]*)>/g,
      (_match, attributeSource: string) =>
        titledBlock(attributeSource, "Details")
    )
    .replaceAll("</Accordion>", "")
    .replaceAll(/<Cards\b[^>]*>/g, "")
    .replaceAll("</Cards>", "")
    .replaceAll(/<Steps\b[^>]*>/g, "")
    .replaceAll("</Steps>", "")
    .replaceAll(/<Step\b[^>]*>/g, "")
    .replaceAll("</Step>", "");
}

function codeFence(code: string, language = ""): string {
  return `\`\`\`${language}\n${code}\n\`\`\``;
}

function parseAttributes(source: string): ComponentAttributes {
  const attributes: ComponentAttributes = {};
  let index = 0;
  const text = source.trim();
  while (index < text.length) {
    while (index < text.length && /\s/u.test(text[index] ?? "")) index += 1;
    if (index >= text.length) break;
    const name = /^[A-Za-z_][A-Za-z0-9_]*/u.exec(text.slice(index));
    if (!name) {
      throw new Error(
        `Unsupported JSX attribute syntax near ${text.slice(index, index + 24)}`
      );
    }
    index += name[0].length;
    while (index < text.length && /\s/u.test(text[index] ?? "")) index += 1;
    if (text[index] !== "=") {
      attributes[name[0]] = true;
      continue;
    }
    index += 1;
    while (index < text.length && /\s/u.test(text[index] ?? "")) index += 1;
    const start = text[index];
    if (start === '"' || start === "'") {
      const end = text.indexOf(start, index + 1);
      if (end === -1) throw new Error(`Unclosed JSX attribute ${name[0]}`);
      attributes[name[0]] = interpretAttribute(text.slice(index + 1, end));
      index = end + 1;
      continue;
    }
    if (start === "{") {
      const expression = readBalanced(text, index);
      attributes[name[0]] = interpretAttribute(expression.slice(1, -1));
      index += expression.length;
      continue;
    }
    throw new Error(`Unsupported JSX attribute ${name[0]}`);
  }
  return attributes;
}

function interpretAttribute(value: string): unknown {
  const decoded = decodeHtml(value.trim());
  if (decoded.startsWith("[") || decoded.startsWith("{")) {
    return parseLooseJson(decoded);
  }
  return decoded;
}

function parseLooseJson(value: string): unknown {
  const quoted = value
    .replaceAll(
      /(?<prefix>[{,]\s*)(?<key>[A-Za-z_][A-Za-z0-9_]*)(?<colon>\s*:)/g,
      '$<prefix>"$<key>"$<colon>'
    )
    .replaceAll(/,(?<tail>\s*[\]}])/g, "$<tail>");
  return JSON.parse(quoted) as unknown;
}

function decodeHtml(value: string): string {
  return value
    .replaceAll(/&#x(?<hex>[0-9a-fA-F]+);/g, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replaceAll(/&#(?<digits>\d+);/g, (_match, digits: string) =>
      String.fromCodePoint(Number.parseInt(digits, 10))
    )
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function readBalanced(text: string, start: number): string {
  let depth = 0;
  let quote: string | undefined;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === "\\") {
        index += 1;
        continue;
      }
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "{" || character === "[" || character === "(") depth += 1;
    if (character === "}" || character === "]" || character === ")") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  throw new Error("Unbalanced JSX expression");
}

function httpBody(value: unknown): HttpClientBody | undefined {
  if (value === undefined) return undefined;
  if (value === "bytes" || value === "json") return value;
  throw new Error(`Unsupported HTTP client body ${String(value)}`);
}

function httpRequests(value: unknown): HttpClientRequest[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new TypeError("HTTP client requests must be an array.");
  }
  return value.map((item) => {
    if (!isRecord(item) || typeof item.path !== "string") {
      throw new Error("HTTP client request requires a path.");
    }
    return {
      body: httpBody(item.body),
      path: item.path,
      query: optionalString(item.query),
    };
  });
}

function requiredString(attributes: ComponentAttributes, name: string): string {
  const value = attributes[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Docs component requires ${name}.`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
