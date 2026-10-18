const fileExtensions = [".js", ".mjs", ".cjs", ".json", ".ts", ".tsx", ".node"];

function hasFileExtension(specifier) {
  return fileExtensions.some((extension) => specifier.endsWith(extension));
}

export function resolve(specifier, context, nextResolve) {
  const relative = specifier.startsWith("./") || specifier.startsWith("../");
  if (relative && !hasFileExtension(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}
