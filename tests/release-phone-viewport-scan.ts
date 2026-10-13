import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import {
  desktopRetainedNarrowWidths,
  feedbackPhoneViewport,
  frontPorchBoundaryWidths,
  frontPorchCompositionViewports,
  phoneReleaseWidths,
  publicTrustViewports,
} from "./e2e/release-phone-viewport";

export interface ViewportCall {
  file: string;
  guarded: boolean;
  line: number;
  width: number;
}

const helperWidths: Record<string, number[]> = {
  desktopRetainedNarrowWidths: [...desktopRetainedNarrowWidths],
  feedbackPhoneViewport: [feedbackPhoneViewport.width],
  frontPorchBoundaryWidths: [...frontPorchBoundaryWidths],
  frontPorchCompositionViewports: frontPorchCompositionViewports.map(
    (viewport) => viewport.width
  ),
  phoneReleaseWidths: [...phoneReleaseWidths],
  publicTrustViewports: publicTrustViewports.map((viewport) => viewport.width),
};

function specFiles(): string[] {
  return ["tests/e2e", "tests/storybook"].flatMap((root) =>
    readdirSync(root, { encoding: "utf-8", recursive: true })
      .filter((name) => name.endsWith(".spec.ts"))
      .map((name) => path.join(root, name))
  );
}

function hasPhoneGuard(text: string): boolean {
  return (
    text.includes("releaseViewportRuns(") ||
    text.includes("!isMobileProject") ||
    text.includes('project.name !== "mobile"')
  );
}

function choosesMobileWidth(text: string): boolean {
  return (
    text.includes('includes("mobile")') || text.includes("isMobileProject")
  );
}

function expressionWidths(
  expression: ts.Expression,
  sourceFile: ts.SourceFile
): number[] {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return expressionWidths(expression.expression, sourceFile);
  }
  if (ts.isNumericLiteral(expression)) {
    return [Number(expression.text)];
  }
  if (ts.isIdentifier(expression)) {
    return identifierWidths(expression, sourceFile);
  }
  if (
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === "width"
  ) {
    return expressionWidths(expression.expression, sourceFile);
  }
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.SlashToken &&
    ts.isNumericLiteral(expression.right)
  ) {
    const divisor = Number(expression.right.text);
    return expressionWidths(expression.left, sourceFile).map(
      (width) => width / divisor
    );
  }
  if (ts.isObjectLiteralExpression(expression)) {
    return objectWidth(expression, sourceFile);
  }
  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.flatMap((element) =>
      ts.isExpression(element) ? expressionWidths(element, sourceFile) : []
    );
  }
  if (ts.isConditionalExpression(expression)) {
    return [
      ...expressionWidths(expression.whenTrue, sourceFile),
      ...expressionWidths(expression.whenFalse, sourceFile),
    ];
  }
  return [];
}

function objectWidth(
  expression: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile
): number[] {
  for (const property of expression.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === "width"
    ) {
      return expressionWidths(property.initializer, sourceFile);
    }
    if (
      ts.isShorthandPropertyAssignment(property) &&
      property.name.text === "width"
    ) {
      return identifierWidths(property.name, sourceFile);
    }
  }
  return [];
}

function identifierWidths(
  identifier: ts.Identifier,
  sourceFile: ts.SourceFile
): number[] {
  const loopWidths = forOfWidths(identifier);
  if (loopWidths) {
    return loopWidths;
  }
  let current: ts.Node | undefined = identifier.parent;
  while (current) {
    if (ts.isBlock(current) || ts.isSourceFile(current)) {
      for (const statement of current.statements) {
        if (!ts.isVariableStatement(statement)) {
          continue;
        }
        for (const declaration of statement.declarationList.declarations) {
          if (
            ts.isIdentifier(declaration.name) &&
            declaration.name.text === identifier.text &&
            declaration.initializer &&
            declaration.name.pos < identifier.pos
          ) {
            return expressionWidths(declaration.initializer, sourceFile);
          }
        }
      }
    }
    current = current.parent;
  }
  return importedWidths(sourceFile, identifier.text) ?? [];
}

function forOfWidths(identifier: ts.Identifier): number[] | undefined {
  let current: ts.Node | undefined = identifier.parent;
  while (current) {
    if (
      ts.isForOfStatement(current) &&
      declaresLoopName(current, identifier.text)
    ) {
      return expressionWidths(current.expression, identifier.getSourceFile());
    }
    current = current.parent;
  }
  return undefined;
}

function declaresLoopName(statement: ts.ForOfStatement, name: string): boolean {
  if (!ts.isVariableDeclarationList(statement.initializer)) {
    return false;
  }
  const declaration = statement.initializer.declarations[0];
  return (
    declaration !== undefined &&
    ts.isIdentifier(declaration.name) &&
    declaration.name.text === name
  );
}

function importedWidths(
  sourceFile: ts.SourceFile,
  localName: string
): number[] | undefined {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) {
      continue;
    }
    const { moduleSpecifier, importClause } = statement;
    if (
      !ts.isStringLiteral(moduleSpecifier) ||
      !moduleSpecifier.text.endsWith("release-phone-viewport") ||
      !importClause.namedBindings ||
      !ts.isNamedImports(importClause.namedBindings)
    ) {
      continue;
    }
    for (const element of importClause.namedBindings.elements) {
      if (element.name.text !== localName) {
        continue;
      }
      const imported = element.propertyName?.text ?? element.name.text;
      return helperWidths[imported];
    }
  }
  return undefined;
}

function callIsGuarded(call: ts.CallExpression, source: string): boolean {
  const argument = call.arguments[0];
  const argumentText = argument
    ? source.slice(argument.getStart(), argument.getEnd())
    : "";
  if (choosesMobileWidth(argumentText) && argumentText.includes("?")) {
    return true;
  }
  const testStart = enclosingTestStart(call);
  const prefix =
    testStart === undefined ? "" : source.slice(testStart, call.getStart());
  if (
    hasPhoneGuard(prefix) ||
    (choosesMobileWidth(prefix) && argumentText.includes("?"))
  ) {
    return true;
  }
  return describeSkipsUnlessMobile(call, source);
}

function enclosingTestStart(node: ts.Node): number | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      current.expression.text === "test"
    ) {
      return current.getStart();
    }
    current = current.parent;
  }
  return undefined;
}

function describeSkipsUnlessMobile(node: ts.Node, source: string): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isCallExpression(current) && isDescribeCall(current)) {
      const beforeEach = beforeEachText(current, source);
      if (hasPhoneGuard(beforeEach)) {
        return true;
      }
    }
    current = current.parent;
  }
  return false;
}

function beforeEachText(call: ts.CallExpression, source: string): string {
  const callback = call.arguments.find(
    (argument): argument is ts.ArrowFunction | ts.FunctionExpression =>
      ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)
  );
  if (!(callback && ts.isBlock(callback.body))) {
    return "";
  }
  const beforeEach = callback.body.statements.find((statement) =>
    source
      .slice(statement.getStart(), statement.getEnd())
      .includes("beforeEach")
  );
  if (!beforeEach) {
    return "";
  }
  return source.slice(beforeEach.getStart(), beforeEach.getEnd());
}

function isDescribeCall(call: ts.CallExpression): boolean {
  return (
    ts.isPropertyAccessExpression(call.expression) &&
    call.expression.name.text === "describe" &&
    ts.isIdentifier(call.expression.expression) &&
    call.expression.expression.text === "test"
  );
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
}

export function scanPhoneViewportCalls(): ViewportCall[] {
  const calls: ViewportCall[] = [];
  for (const file of specFiles()) {
    const source = readFileSync(file, "utf-8");
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "setViewportSize" &&
        node.arguments[0]
      ) {
        const guarded = callIsGuarded(node, source);
        const widths = expressionWidths(node.arguments[0], sourceFile);
        if (widths.length === 0) {
          calls.push({
            file,
            guarded: false,
            line: lineOf(sourceFile, node),
            width: 0,
          });
        }
        for (const width of widths) {
          if (width >= 768) {
            continue;
          }
          calls.push({
            file,
            guarded,
            line: lineOf(sourceFile, node),
            width,
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return calls;
}
