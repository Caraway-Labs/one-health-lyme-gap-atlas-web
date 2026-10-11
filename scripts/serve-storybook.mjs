import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const root = path.resolve("storybook-static");
const prefix = "/one-health-lyme-gap-atlas-web/";
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
};

// Serve exactly the public artifact under the Pages project path for verification.
createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  if (!pathname.startsWith(prefix)) {
    response.writeHead(404).end();
    return;
  }
  const file = path.resolve(
    root,
    pathname.slice(prefix.length) || "index.html"
  );
  if (!file.startsWith(`${root}${path.sep}`)) {
    response.writeHead(404).end();
    return;
  }
  try {
    if (!(await stat(file)).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader(
      "Content-Type",
      types[path.extname(file)] ?? "application/octet-stream"
    );
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
}).listen(6007, "127.0.0.1");
