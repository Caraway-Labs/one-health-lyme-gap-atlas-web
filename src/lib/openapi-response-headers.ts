export type OpenApiResponseHeader = {
  description: string;
  name: string;
  required: boolean;
  schema: string;
};

type ResolveNode = (node: unknown) => unknown;

export function responseHeaders(
  headers: unknown,
  resolve: ResolveNode = (node) => node
): OpenApiResponseHeader[] {
  if (!isRecord(headers)) return [];
  const views: OpenApiResponseHeader[] = [];
  for (const [name, value] of Object.entries(headers)) {
    const header = resolve(value);
    if (!isRecord(header)) continue;
    views.push({
      description: text(header.description),
      name,
      required: header.required === true,
      schema: headerSchema(header, resolve),
    });
  }
  return views;
}

function headerSchema(
  header: Record<string, unknown>,
  resolve: ResolveNode
): string {
  if (header.schema !== undefined) return schemaText(resolve(header.schema));
  if (!isRecord(header.content)) return "";
  const media: string[] = [];
  for (const [mediaType, value] of Object.entries(header.content)) {
    const body = resolve(value);
    const schema = isRecord(body) ? schemaText(resolve(body.schema)) : "";
    media.push(schema ? `${mediaType}: ${schema}` : mediaType);
  }
  return media.join("; ");
}

function schemaText(schema: unknown): string {
  if (!isRecord(schema)) return "";
  if (typeof schema.$ref === "string") return schema.$ref;
  const typeName = typeText(schema.type);
  if (schema.type === "array") {
    const items = schemaText(schema.items);
    return items ? `array<${items}>` : "array";
  }
  const properties = propertyNames(schema.properties);
  if (properties) return typeName ? `${typeName}: ${properties}` : properties;
  const enumeration =
    Array.isArray(schema.enum) && schema.enum.length > 0
      ? schema.enum.map((value) => JSON.stringify(value)).join(" | ")
      : "";
  if (typeName && enumeration) return `${typeName} (${enumeration})`;
  if (enumeration) return enumeration;
  const format = text(schema.format);
  if (typeName && format) return `${typeName} (${format})`;
  return typeName;
}

function typeText(type: unknown): string {
  if (typeof type === "string") return type;
  if (!Array.isArray(type)) return "";
  return type.filter((item) => typeof item === "string").join(" | ");
}

function propertyNames(properties: unknown): string {
  if (!isRecord(properties)) return "";
  return Object.keys(properties).join(", ");
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
