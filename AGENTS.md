<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Frontend design-system rules

- Use the semantic Tailwind/shadcn tokens in `src/app/globals.css` for UI surfaces, text, actions, borders, and focus states; do not introduce arbitrary new UI colors.
- Use shared primitives from `@/components/ui` before creating new one-off controls.
- Keep Atlas domain and visualization tokens (map ramps, evidence/risk colors, navy/teal brand values) independent when their data meaning is important.
