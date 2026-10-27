import { markdownTableCell } from "./markdown-table";

/**
 * Marker for a contract description that is still missing.
 * Keep this phrase exact so maintainers can count it.
 */
export const SCHEMA_DESCRIPTION_GAP = "No description yet";

const SCHEMA_REF_PREFIX = "#/components/schemas/";
const MAX_TYPE_DEPTH = 8;
const TYPE_OR_SEPARATOR = " \\| ";
const ENUM_BULLET = /^-\s+`(?<value>[^`]+)`:\s*(?<meaning>.*?)\s*$/;
const LEADING_MEANING_PUNCTUATION = /^[\s:.,;\-–—]+/;
const LEADING_MEANS = /^(?:means|is)\s+/i;
const TRAILING_CONJUNCTION = /\s+(?:and|or)\s*$/i;
const TRAILING_PUNCTUATION = /[\s.;,]+$/;
const LIST_CONTINUATION = /^(?:,|;|\bor\b|\band\b)/i;
const NEW_SENTENCE = /^[.!?]/;
const SENTENCE_BOUNDARY = /[.!?](?=\s+[`A-Z]|\s*$)/;

type JsonRecord = Record<string, unknown>;

export type SchemaTagGroup = {
  name: string;
  tags: string[];
};

export type SchemaCatalogOperation = {
  folder: string;
  method: string;
  operationId: string;
  path: string;
  schemaNames: string[];
  summary: string;
  tag: string;
};

type AnchorMap = ReadonlyMap<string, string>;

type ReadableType = {
  enumValues: string[];
  markdown: string;
};

type SchemaField = {
  description: string;
  enumValues: string[];
  example: string | undefined;
  meaningSchema: JsonRecord;
  name: string;
  required: boolean;
  typeMarkdown: string;
};

type MergedObject = {
  properties: Record<string, unknown>;
  required: string[];
};

export function schemaTagGroups(
  document: JsonRecord,
  fallbackTags: readonly string[]
): SchemaTagGroup[] {
  const declared = declaredTagGroups(document["x-tagGroups"]);
  if (declared.length > 0) return declared;
  return fallbackTags.map((tag) => ({ name: tag, tags: [tag] }));
}

export function componentSchemaNames(
  nodes: readonly unknown[],
  schemas: JsonRecord
): string[] {
  const names = new Set<string>();
  const queue: string[] = [];
  for (const node of nodes) collectSchemaRefs(node, queue, new Set());
  for (const name of queue) {
    if (Object.hasOwn(schemas, name)) names.add(name);
  }
  const pending = [...names];
  while (pending.length > 0) {
    const name = pending.pop();
    if (!name) continue;
    const nested: string[] = [];
    collectSchemaRefs(schemas[name], nested, new Set());
    for (const child of nested) {
      if (!names.has(child) && Object.hasOwn(schemas, child)) {
        names.add(child);
        pending.push(child);
      }
    }
  }
  return [...names].sort((left, right) => left.localeCompare(right, "en"));
}

export function renderOperationSchemaLine(
  names: readonly string[],
  anchors: AnchorMap
): string {
  if (names.length === 0) return "";
  const links = names.map((name) => {
    const anchor = anchors.get(schemaRef(name));
    const label = inlineProse(name);
    return anchor
      ? `[${label}](/docs/api-reference/schemas#${anchor})`
      : `\`${label}\``;
  });
  return `Schemas: ${links.join(", ")}.`;
}

export function renderSchemaCatalog(input: {
  anchors: AnchorMap;
  groups: readonly SchemaTagGroup[];
  operations: readonly SchemaCatalogOperation[];
  schemas: JsonRecord;
}): string {
  const names = Object.keys(input.schemas);
  const tagsBySchema = tagsUsingSchemas(input.operations);
  const lines = [
    frontmatter(
      "Schemas",
      "Component schemas from the pinned public Atlas OpenAPI contract, with field types, required flags, descriptions, examples, and the operations that use them."
    ),
    "Read each field before writing a parser. A field row lists the name, the type, whether the field is required, the contract description, and an example when the contract includes one. `null` stays in the type when a value can be null. A linked type names another schema in the reference. Enum values are listed with the meaning stated in the contract. The operations under a schema return or accept that schema.",
    "",
    "## Schema index",
    "",
  ];
  if (names.length === 0) {
    lines.push("This contract does not declare component schemas.", "");
    return `${lines.join("\n").trim()}\n`;
  }
  lines.push(
    ...indexLines(names, input.groups, input.anchors, tagsBySchema),
    ""
  );
  const ordered = [...names].sort((left, right) =>
    compareSchemas(left, right, input.groups, tagsBySchema)
  );
  for (const name of ordered) {
    lines.push(
      ...schemaSection(
        name,
        input.schemas[name],
        input.schemas,
        input.anchors,
        input.operations,
        input.groups
      ),
      ""
    );
  }
  return `${lines.join("\n").trim()}\n`;
}

function declaredTagGroups(value: unknown): SchemaTagGroup[] {
  if (!Array.isArray(value)) return [];
  const groups: SchemaTagGroup[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.name !== "string") continue;
    const name = entry.name.trim();
    if (!name) continue;
    const tags = Array.isArray(entry.tags)
      ? entry.tags.filter(
          (tag): tag is string => typeof tag === "string" && tag !== ""
        )
      : [];
    groups.push({ name, tags });
  }
  return groups;
}

function tagsUsingSchemas(
  operations: readonly SchemaCatalogOperation[]
): Map<string, Set<string>> {
  const tagsBySchema = new Map<string, Set<string>>();
  for (const operation of operations) {
    for (const name of operation.schemaNames) {
      const tags = tagsBySchema.get(name) ?? new Set<string>();
      tags.add(operation.tag);
      tagsBySchema.set(name, tags);
    }
  }
  return tagsBySchema;
}

function indexLines(
  names: readonly string[],
  groups: readonly SchemaTagGroup[],
  anchors: AnchorMap,
  tagsBySchema: Map<string, Set<string>>
): string[] {
  const lines: string[] = [];
  const listed = new Set<string>();
  for (const group of groups) {
    const members = names
      .filter((name) => schemaInGroup(name, group, tagsBySchema))
      .sort((left, right) => left.localeCompare(right, "en"));
    if (members.length === 0) continue;
    lines.push(`### ${inlineProse(group.name)}`, "");
    for (const name of members) {
      listed.add(name);
      lines.push(`- ${schemaLink(name, anchors)}`);
    }
    lines.push("");
  }
  const others = names
    .filter((name) => !listed.has(name))
    .sort((left, right) => left.localeCompare(right, "en"));
  if (others.length > 0) {
    lines.push("### Other schemas", "");
    for (const name of others) lines.push(`- ${schemaLink(name, anchors)}`);
    lines.push("");
  }
  return lines;
}

function schemaInGroup(
  name: string,
  group: SchemaTagGroup,
  tagsBySchema: Map<string, Set<string>>
): boolean {
  const tags = tagsBySchema.get(name);
  if (!tags) return false;
  return group.tags.some((tag) => tags.has(tag));
}

function compareSchemas(
  left: string,
  right: string,
  groups: readonly SchemaTagGroup[],
  tagsBySchema: Map<string, Set<string>>
): number {
  const groupDiff =
    primaryGroupIndex(left, groups, tagsBySchema) -
    primaryGroupIndex(right, groups, tagsBySchema);
  if (groupDiff !== 0) return groupDiff;
  return left.localeCompare(right, "en");
}

function primaryGroupIndex(
  name: string,
  groups: readonly SchemaTagGroup[],
  tagsBySchema: Map<string, Set<string>>
): number {
  const tags = tagsBySchema.get(name);
  if (!tags) return groups.length;
  const index = groups.findIndex((group) =>
    group.tags.some((tag) => tags.has(tag))
  );
  return index === -1 ? groups.length : index;
}

function schemaSection(
  name: string,
  schema: unknown,
  schemas: JsonRecord,
  anchors: AnchorMap,
  operations: readonly SchemaCatalogOperation[],
  groups: readonly SchemaTagGroup[]
): string[] {
  const anchor = anchors.get(schemaRef(name));
  if (!anchor) {
    throw new Error(`Component schema ${name} is missing a stable heading.`);
  }
  const description = descriptionText(schema);
  const lines = [`## ${inlineProse(name)} [#${anchor}]`, ""];
  lines.push(description ? mdxProse(description) : SCHEMA_DESCRIPTION_GAP, "");
  lines.push(...operationLines(name, operations, groups), "");
  const type = readableType(schema, anchors, 0);
  lines.push(`Type: ${type.markdown}`, "");
  const fields = fieldsOf(schema, schemas, anchors);
  if (fields.length > 0) {
    lines.push(...fieldTable(fields), "");
    lines.push(...additionalPropertiesLine(schema, anchors));
    for (const field of fields) {
      if (field.enumValues.length === 0) continue;
      lines.push(
        ...enumSection(
          `### \`${inlineCode(field.name)}\` values`,
          field.enumValues,
          descriptionText(field.meaningSchema),
          field.meaningSchema
        ),
        ""
      );
    }
    return lines;
  }
  if (type.enumValues.length > 0 && isRecord(schema)) {
    lines.push(
      ...enumSection("### Values", type.enumValues, description, schema),
      ""
    );
  }
  return lines;
}

function operationLines(
  name: string,
  operations: readonly SchemaCatalogOperation[],
  groups: readonly SchemaTagGroup[]
): string[] {
  const matches = operations.filter((operation) =>
    operation.schemaNames.includes(name)
  );
  const lines = ["### Operations", ""];
  if (matches.length === 0) {
    lines.push("No operation returns or accepts it.");
    return lines;
  }
  const ordered = [...matches].sort(
    (left, right) =>
      groupRank(left.tag, groups) - groupRank(right.tag, groups) ||
      left.operationId.localeCompare(right.operationId, "en")
  );
  for (const operation of ordered) {
    lines.push(
      `- [\`${operation.method} ${operation.path}\`](/docs/api-reference/${operation.folder}/${operation.operationId}) — ${inlineProse(operation.summary)}`
    );
  }
  return lines;
}

function groupRank(tag: string, groups: readonly SchemaTagGroup[]): number {
  const index = groups.findIndex((group) => group.tags.includes(tag));
  return index === -1 ? groups.length : index;
}

function fieldTable(fields: readonly SchemaField[]): string[] {
  const includeExample = fields.some((field) => field.example !== undefined);
  // "Name" stays distinct from the provenance null-semantics table, whose
  // header is "Field | Type | Required | Description". The Markdown export
  // finds that table by header.
  const header = includeExample
    ? "| Name | Type | Required | Description | Example |"
    : "| Name | Type | Required | Description |";
  const divider = includeExample
    ? "| --- | --- | --- | --- | --- |"
    : "| --- | --- | --- | --- |";
  const lines = [header, divider];
  for (const field of fields) {
    const cells = [
      markdownTableCell(field.name, { code: true }),
      field.typeMarkdown,
      field.required ? "required" : "optional",
      mdxTableProse(field.description),
    ];
    if (includeExample) {
      cells.push(
        field.example === undefined
          ? "—"
          : markdownTableCell(field.example, { code: true })
      );
    }
    lines.push(`| ${cells.join(" | ")} |`);
  }
  return lines;
}

function enumSection(
  heading: string,
  values: readonly string[],
  description: string,
  schema: JsonRecord
): string[] {
  const meanings = enumMeanings(values, description, schema);
  const lines = [heading, "", "| Value | Meaning |", "| --- | --- |"];
  for (const value of values) {
    lines.push(
      `| ${markdownTableCell(value, { code: true })} | ${mdxTableProse(meanings.get(value) ?? SCHEMA_DESCRIPTION_GAP)} |`
    );
  }
  return lines;
}

function additionalPropertiesLine(
  schema: unknown,
  anchors: AnchorMap
): string[] {
  if (!isRecord(schema) || !isRecord(schema.properties)) return [];
  if (schema.additionalProperties === true) {
    return ["Additional properties are allowed.", ""];
  }
  if (isRecord(schema.additionalProperties)) {
    const inner = readableType(schema.additionalProperties, anchors, 0);
    return [`Additional properties: ${inner.markdown}.`, ""];
  }
  return [];
}

function fieldsOf(
  schema: unknown,
  schemas: JsonRecord,
  anchors: AnchorMap
): SchemaField[] {
  const merged = mergeObject(schema, schemas, new Set());
  const required = new Set(merged.required);
  const fields: SchemaField[] = [];
  for (const [name, property] of Object.entries(merged.properties)) {
    const type = readableType(property, anchors, 0);
    const example = exampleText(property);
    fields.push({
      description: descriptionText(property) || SCHEMA_DESCRIPTION_GAP,
      enumValues: type.enumValues,
      example,
      meaningSchema: isRecord(property) ? property : {},
      name,
      required: required.has(name),
      typeMarkdown: type.markdown,
    });
  }
  return fields;
}

function mergeObject(
  schema: unknown,
  schemas: JsonRecord,
  seen: Set<string>
): MergedObject {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  collectMerged(schema, schemas, seen, properties, required);
  return { properties, required };
}

function collectMerged(
  schema: unknown,
  schemas: JsonRecord,
  seen: Set<string>,
  properties: Record<string, unknown>,
  required: string[]
): void {
  if (!isRecord(schema)) return;
  const ref = typeof schema.$ref === "string" ? schema.$ref : undefined;
  if (ref !== undefined) {
    if (seen.has(ref)) return;
    const name = schemaNameFromRef(ref);
    if (!name || !isRecord(schemas[name])) return;
    seen.add(ref);
    collectMerged(schemas[name], schemas, seen, properties, required);
    return;
  }
  if (Array.isArray(schema.allOf)) {
    for (const branch of schema.allOf) {
      collectMerged(branch, schemas, seen, properties, required);
    }
  }
  if (isRecord(schema.properties)) {
    for (const [name, property] of Object.entries(schema.properties)) {
      properties[name] = property;
    }
  }
  if (!Array.isArray(schema.required)) return;
  for (const name of schema.required) {
    if (typeof name === "string") required.push(name);
  }
}

function readableType(
  schema: unknown,
  anchors: AnchorMap,
  depth: number
): ReadableType {
  if (!isRecord(schema) || depth > MAX_TYPE_DEPTH) return unknownType();
  const combined = combinerType(schema, anchors, depth);
  if (combined) return combined;
  const reference = refType(schema, anchors);
  if (reference) return reference;
  if (hasArrayShape(schema)) return arrayType(schema, anchors, depth);
  const enumeration = enumType(schema);
  if (enumeration) return enumeration;
  const literal = constType(schema);
  if (literal) return literal;
  if (hasObjectShape(schema)) return objectType(schema, anchors, depth);
  return primitiveType(schema);
}

function combinerType(
  schema: JsonRecord,
  anchors: AnchorMap,
  depth: number
): ReadableType | undefined {
  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return joinTypes(schema.allOf, " & ", anchors, depth);
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return joinTypes(schema.anyOf, TYPE_OR_SEPARATOR, anchors, depth);
  }
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return joinTypes(schema.oneOf, TYPE_OR_SEPARATOR, anchors, depth);
  }
  return undefined;
}

function joinTypes(
  branches: readonly unknown[],
  separator: string,
  anchors: AnchorMap,
  depth: number
): ReadableType {
  const parts: string[] = [];
  const enumValues: string[] = [];
  for (const branch of branches) {
    if (isNullSchema(branch)) {
      parts.push(code("null"));
      continue;
    }
    const readable = readableType(branch, anchors, depth + 1);
    parts.push(readable.markdown);
    for (const value of readable.enumValues) enumValues.push(value);
  }
  if (parts.length === 0) return unknownType();
  return { enumValues, markdown: parts.join(separator) };
}

function refType(
  schema: JsonRecord,
  anchors: AnchorMap
): ReadableType | undefined {
  if (typeof schema.$ref !== "string") return undefined;
  const name = schemaNameFromRef(schema.$ref);
  if (!name) return unknownType();
  const link = schemaLink(name, anchors);
  return {
    enumValues: [],
    markdown:
      schema.nullable === true
        ? `${link}${TYPE_OR_SEPARATOR}${code("null")}`
        : link,
  };
}

function arrayType(
  schema: JsonRecord,
  anchors: AnchorMap,
  depth: number
): ReadableType {
  const items = readableType(schema.items, anchors, depth + 1);
  const markdown = `array of ${items.markdown}`;
  return {
    enumValues: items.enumValues,
    markdown: withNull(markdown, declaredTypes(schema).nullable),
  };
}

function enumType(schema: JsonRecord): ReadableType | undefined {
  if (!Array.isArray(schema.enum)) return undefined;
  const values = schema.enum.filter(
    (value): value is string | number =>
      typeof value === "string" || typeof value === "number"
  );
  const nullable = declaredTypes(schema).nullable || schema.enum.includes(null);
  if (values.length === 0) return { enumValues: [], markdown: code("null") };
  const label = `${values.join(" | ")}${nullable ? " | null" : ""}`;
  return { enumValues: values.map(String), markdown: code(label) };
}

function constType(schema: JsonRecord): ReadableType | undefined {
  if (!("const" in schema)) return undefined;
  const literal =
    typeof schema.const === "string"
      ? schema.const
      : JSON.stringify(schema.const);
  return {
    enumValues: [],
    markdown: withNull(code(literal ?? "null"), declaredTypes(schema).nullable),
  };
}

function objectType(
  schema: JsonRecord,
  anchors: AnchorMap,
  depth: number
): ReadableType {
  const nullable = declaredTypes(schema).nullable;
  if (isRecord(schema.properties)) {
    return { enumValues: [], markdown: withNull(code("object"), nullable) };
  }
  const additional = schema.additionalProperties;
  if (isRecord(additional)) {
    const inner = readableType(additional, anchors, depth + 1);
    return {
      enumValues: [],
      markdown: withNull(`object of ${inner.markdown}`, nullable),
    };
  }
  return { enumValues: [], markdown: withNull(code("object"), nullable) };
}

function primitiveType(schema: JsonRecord): ReadableType {
  const { nullable, types } = declaredTypes(schema);
  const concrete = types.filter((type) => type !== "null");
  let label = concrete.join(" | ");
  if (label === "") label = nullable ? "null" : "unknown";
  else if (
    concrete.length === 1 &&
    typeof schema.format === "string" &&
    schema.format
  ) {
    label = `${label} (${schema.format})`;
  }
  if (nullable && label !== "null") label = `${label} | null`;
  return { enumValues: [], markdown: code(label) };
}

function hasArrayShape(schema: JsonRecord): boolean {
  const { types } = declaredTypes(schema);
  if (types.includes("array")) return true;
  return schema.items !== undefined && !isRecord(schema.properties);
}

function hasObjectShape(schema: JsonRecord): boolean {
  const { types } = declaredTypes(schema);
  return (
    types.includes("object") ||
    isRecord(schema.properties) ||
    schema.additionalProperties !== undefined
  );
}

function declaredTypes(schema: JsonRecord): {
  nullable: boolean;
  types: string[];
} {
  const types: string[] = [];
  let nullable = schema.nullable === true;
  const raw = schema.type;
  if (typeof raw === "string") {
    if (raw === "null") nullable = true;
    else types.push(raw);
  } else if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (entry === "null") nullable = true;
      else if (typeof entry === "string") types.push(entry);
    }
  }
  return { nullable, types };
}

function isNullSchema(schema: unknown): boolean {
  if (!isRecord(schema)) return false;
  if (schema.type === "null") return true;
  if (
    Array.isArray(schema.type) &&
    schema.type.length === 1 &&
    schema.type[0] === "null"
  ) {
    return true;
  }
  return (
    Array.isArray(schema.enum) &&
    schema.enum.length === 1 &&
    schema.enum[0] === null
  );
}

function withNull(markdown: string, nullable: boolean): string {
  return nullable ? `${markdown}${TYPE_OR_SEPARATOR}${code("null")}` : markdown;
}

function unknownType(): ReadableType {
  return { enumValues: [], markdown: code("unknown") };
}

function enumMeanings(
  values: readonly string[],
  description: string,
  schema: JsonRecord
): Map<string, string> {
  const explicit = explicitEnumMeanings(schema);
  const meanings = new Map<string, string>();
  if (explicit) {
    for (const value of values) {
      meanings.set(value, explicit.get(value) ?? SCHEMA_DESCRIPTION_GAP);
    }
    return meanings;
  }
  for (const line of description.split(/\r?\n/)) {
    const match = ENUM_BULLET.exec(line.trim());
    const value = match?.groups?.value;
    const meaning = match?.groups?.meaning?.trim();
    if (value && meaning && values.includes(value) && !meanings.has(value)) {
      meanings.set(value, meaning);
    }
  }
  const mentions: { end: number; index: number; value: string }[] = [];
  for (const value of values) {
    if (meanings.has(value)) continue;
    const needle = `\`${value}\``;
    let from = 0;
    while (from < description.length) {
      const index = description.indexOf(needle, from);
      if (index === -1) break;
      mentions.push({ end: index + needle.length, index, value });
      from = index + needle.length;
    }
  }
  mentions.sort((left, right) => left.index - right.index);
  for (let index = 0; index < mentions.length; index += 1) {
    const current = mentions[index];
    if (!current || meanings.has(current.value)) continue;
    const next = mentions[index + 1];
    const text = definedInlineMeaning(
      description.slice(current.end, next?.index ?? description.length)
    );
    if (text) meanings.set(current.value, text);
  }
  for (const value of values) {
    if (!meanings.has(value)) meanings.set(value, SCHEMA_DESCRIPTION_GAP);
  }
  return meanings;
}

function explicitEnumMeanings(
  schema: JsonRecord
): Map<string, string> | undefined {
  const descriptions =
    schema["x-enumDescriptions"] ?? schema["x-enum-descriptions"];
  if (Array.isArray(descriptions) && Array.isArray(schema.enum)) {
    const meanings = new Map<string, string>();
    for (let index = 0; index < schema.enum.length; index += 1) {
      const value = schema.enum[index];
      const meaning = descriptions[index];
      if (
        typeof value === "string" &&
        typeof meaning === "string" &&
        meaning.trim()
      ) {
        meanings.set(value, meaning.trim());
      }
    }
    return meanings;
  }
  if (!isRecord(descriptions)) return undefined;
  const meanings = new Map<string, string>();
  for (const [value, meaning] of Object.entries(descriptions)) {
    if (typeof meaning === "string" && meaning.trim()) {
      meanings.set(value, meaning.trim());
    }
  }
  return meanings;
}

function definedInlineMeaning(value: string): string {
  const trimmed = value.trimStart();
  // A comma list or a later sentence names the value without defining it.
  // "`A`, `B`, or `C`. `null` when ..." must not describe `C`.
  if (
    !trimmed ||
    LIST_CONTINUATION.test(trimmed) ||
    NEW_SENTENCE.test(trimmed)
  ) {
    return "";
  }
  return inlineMeaning(firstSentence(trimmed));
}

function firstSentence(value: string): string {
  const boundary = SENTENCE_BOUNDARY.exec(value);
  if (!boundary) return value;
  return value.slice(0, boundary.index + 1);
}

function inlineMeaning(value: string): string {
  const text = value
    .replace(LEADING_MEANING_PUNCTUATION, "")
    .replace(LEADING_MEANS, "")
    .replace(TRAILING_CONJUNCTION, "")
    .replace(TRAILING_PUNCTUATION, "")
    .replaceAll(/\s+/g, " ")
    .trim();
  // A fragment such as "not" drops the sentence it was cut from. Keep the
  // full description on the field and leave the value unmarked instead.
  if (text.length < 12 || !text.includes(" ")) return "";
  return text;
}

function exampleText(schema: unknown): string | undefined {
  if (!isRecord(schema)) return undefined;
  if ("example" in schema) return jsonText(schema.example);
  // JSON Schema `examples` is an array. OpenAPI media examples are a map.
  if (Array.isArray(schema.examples)) {
    const entry = schema.examples[0];
    return entry === undefined ? undefined : jsonText(entry);
  }
  if (!isRecord(schema.examples)) return undefined;
  const entry = Object.values(schema.examples)[0];
  if (entry === undefined) return undefined;
  if (isRecord(entry) && "value" in entry) return jsonText(entry.value);
  return jsonText(entry);
}

function jsonText(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? "null";
}

function descriptionText(schema: unknown): string {
  if (!isRecord(schema) || typeof schema.description !== "string") return "";
  return schema.description.trim();
}

function collectSchemaRefs(
  node: unknown,
  names: string[],
  seen: Set<unknown>
): void {
  if (Array.isArray(node)) {
    for (const child of node) collectSchemaRefs(child, names, seen);
    return;
  }
  if (!isRecord(node) || seen.has(node)) return;
  seen.add(node);
  if (typeof node.$ref === "string") {
    const name = schemaNameFromRef(node.$ref);
    if (name) names.push(name);
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === "object")
      collectSchemaRefs(value, names, seen);
  }
}

function schemaNameFromRef(ref: string): string | undefined {
  if (!ref.startsWith(SCHEMA_REF_PREFIX)) return undefined;
  const name = ref
    .slice(SCHEMA_REF_PREFIX.length)
    .replaceAll("~1", "/")
    .replaceAll("~0", "~");
  return name || undefined;
}

function schemaRef(name: string): string {
  return `${SCHEMA_REF_PREFIX}${name}`;
}

function schemaLink(name: string, anchors: AnchorMap): string {
  const anchor = anchors.get(schemaRef(name));
  const label = inlineProse(name);
  return anchor ? `[${label}](#${anchor})` : `\`${label}\``;
}

function code(value: string): string {
  return markdownTableCell(value, { code: true });
}

function inlineCode(value: string): string {
  return value.replaceAll("`", "");
}

function frontmatter(title: string, description: string): string {
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\n---`;
}

function inlineProse(value: string): string {
  return mdxProse(value).replaceAll(/\s+/g, " ").trim();
}

function mdxProse(value: string): string {
  return escapeOutsideCode(value, false);
}

function mdxTableProse(value: string): string {
  return escapeOutsideCode(value.replaceAll(/\r\n?|\n/g, " "), true).trim();
}

function escapeOutsideCode(value: string, escapePipes: boolean): string {
  let result = "";
  let index = 0;
  while (index < value.length) {
    if (value[index] !== "`") {
      const next = value.indexOf("`", index);
      const end = next === -1 ? value.length : next;
      result += escapeLoose(value.slice(index, end), escapePipes);
      index = end;
      continue;
    }
    const runLength = backtickRunLength(value, index);
    const run = "`".repeat(runLength);
    const close = value.indexOf(run, index + runLength);
    if (close === -1) {
      result += escapeLoose(value.slice(index), escapePipes);
      break;
    }
    const span = value.slice(index, close + run.length);
    result += escapePipes ? span.replaceAll("|", "\\|") : span;
    index = close + run.length;
  }
  return result;
}

function backtickRunLength(value: string, index: number): number {
  let length = 0;
  while (value[index + length] === "`") length += 1;
  return length;
}

function escapeLoose(value: string, escapePipes: boolean): string {
  const escaped = value
    .replaceAll("\\", "\\\\")
    .replaceAll("{", "\\{")
    .replaceAll("<", "\\<");
  return escapePipes ? escaped.replaceAll("|", "\\|") : escaped;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
