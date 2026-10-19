import type {
  InlineCode,
  Node,
  Parent,
  Table,
  TableCell,
  TableRow,
  Text,
} from "mdast";
import { remark } from "remark";
import remarkGfm from "remark-gfm";

import {
  observationNullSemantics,
  provenanceNameRows,
} from "../src/features/docs/provenance-evidence-model";

const NULL_SEMANTICS_HEADER = ["Field", "Type", "Required", "Description"];
const PROVENANCE_NAME_HEADER = [
  "Field",
  "Schema",
  "Type",
  "Required",
  "Description",
];

function isParent(node: Node): node is Parent {
  return "children" in node;
}

function isLiteral(node: Node): node is InlineCode | Text {
  return node.type === "text" || node.type === "inlineCode";
}

function cellText(cell: TableCell): string {
  const parts: string[] = [];
  const walk = (node: Node): void => {
    if (isLiteral(node)) {
      parts.push(node.value);
      return;
    }
    if (!isParent(node)) return;
    for (const child of node.children) walk(child);
  };
  walk(cell);
  return parts.join("");
}

export function gfmTables(markdown: string): string[][][] {
  const tree = remark().use(remarkGfm).parse(markdown);
  const tables: string[][][] = [];
  const walk = (node: Node): void => {
    if (node.type === "table") {
      const table = node as Table;
      tables.push(
        table.children.map((row: TableRow) => row.children.map(cellText))
      );
      return;
    }
    if (!isParent(node)) return;
    for (const child of node.children) walk(child);
  };
  walk(tree);
  return tables;
}

function tableByHeader(
  tables: readonly string[][][],
  header: readonly string[]
): string[][] {
  const table = tables.find(
    (candidate) =>
      candidate[0]?.length === header.length &&
      header.every((cell, index) => candidate[0]?.[index] === cell)
  );
  if (!table) throw new Error(`Missing table ${header.join(", ")}`);
  return table;
}

export function provenanceUnionRows(markdown: string): {
  fiveTimestamps: string[][];
  fourTimestamps: string[][];
  value: string[];
} {
  const tables = gfmTables(markdown);
  const fourColumn = tableByHeader(tables, NULL_SEMANTICS_HEADER);
  const fiveColumn = tableByHeader(tables, PROVENANCE_NAME_HEADER);
  const value = fourColumn.find((row) => row[0] === "value");
  if (!value) throw new Error("Missing value row");
  return {
    fiveTimestamps: provenanceNameRows
      .filter((row) => row.type === "date-time | null")
      .map((row) => {
        const parsed = fiveColumn.find(
          (candidate) => candidate[0] === row.name
        );
        if (!parsed) throw new Error(`Missing five-column row ${row.name}`);
        return parsed;
      }),
    fourTimestamps: Object.entries(observationNullSemantics)
      .filter(([, field]) => field.type === "date-time | null")
      .map(([name]) => {
        const parsed = fourColumn.find((row) => row[0] === name);
        if (!parsed) throw new Error(`Missing four-column row ${name}`);
        return parsed;
      }),
    value,
  };
}
