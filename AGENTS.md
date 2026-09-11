<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Frontend design-system rules

- Search `src/components/ui` and existing `atlas-*` domain patterns before creating a control or layout composition.
- Shared reusable controls must come from `src/components/ui`. Do not create custom button, input, select, dialog, dropdown, card, badge, table, or tooltip primitives without a documented justification.
- Do not introduce a second UI framework (Mantine, MUI, Chakra, Ant Design, Storybook, etc.).
- Use semantic Tailwind/shadcn tokens in `src/app/globals.css` for application chrome. Do not hardcode chrome colors when a semantic token exists.
- Keep Atlas domain and visualization tokens (map ramps, evidence/risk colors, navy/teal brand values, `.priority-pill` severity colors) independent when their data meaning is important. Do not flatten them into `primary`.
- Domain components compose UI primitives. Do not move scoring, filter, geography, or provenance logic into `src/components/ui`.
- MapLibre remains the geo rendering layer. Do not wrap or replace map rendering with shadcn.
- Conversational AI / assistant UI is a separate track (`src/features/assistant`, evidence chat). Do not invent a second chat framework in this migration.
- Follow [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md). Run `npm run check:design-system` before completion. The `/design-system` gallery is unlinked internal reference, not a product surface.
- Native HTML is correct when it is the better semantic choice. Documented exceptions:

| Pattern | Location | Why native / domain CSS remains |
| --- | --- | --- |
| Rank-row county buttons | `src/components/ranked-counties.tsx` | Domain list rows with score-color encoding, not generic actions |
| Variant county-list rows | `src/components/experiment-atlas.tsx` | Same ranked-list semantics in interview variants |
| Guided-step tabs | `src/components/experiment-atlas.tsx` | Native `role="tab"` stepper, not a shared Button |
| Scoring range inputs | `src/components/experiment-atlas.tsx` | Native `input type="range"`; no shared Slider primitive |
| Sidebar scrim | `src/components/app-shell.tsx` | Full-viewport dismiss hit target, not a chrome Button |
| Chat launcher / close / history | `src/components/chat-launcher.tsx`, `src/components/evidence-chat.tsx` | Conversational UI chrome; class-only Button used only for shared actions (New chat, Ask) |
| `.priority-pill` on `Badge` | `src/components/atlas-priority-badge.tsx` | Domain severity colors composed through Badge, not a second badge system |
| MapLibre internals | `src/components/atlas-map.tsx` and map CSS | Geo renderer and ramps stay outside shadcn |
| Assistant demo | `src/features/assistant` | Separate conversational product track |

- Editorial dark-hero CTAs may use `.hero-cta-primary` and `.cta-on-dark` on top of Button/`buttonVariants`. Do not reintroduce generic `.button` or `.card` classes.

## Atlas web instructions

Before material work, read the workspace [AGENTS.md](../AGENTS.md), the [technology and governance baseline](../TECHNOLOGY_AND_GOVERNANCE.md), this repository's `README.md`, and the applicable workspace ADRs—especially [0001 frontend platform](../docs/adr/0001-frontend-platform.md), [0002 public API and Snowflake access](../docs/adr/0002-public-api-and-snowflake-access.md), and [0003 geospatial delivery](../docs/adr/0003-geospatial-delivery.md).

- `contracts/openapi.json` and `src/generated/` are generated from the API's OpenAPI contract. Do not hand-edit generated output or make handwritten API models authoritative. Run `npm run generate:api` for contract changes and review the resulting diff.
- Preserve the browser-to-Python-API boundary. `NEXT_PUBLIC_API_BASE_URL` is the only public service configuration; non-secret boolean feature gates may follow the existing `NEXT_PUBLIC_KG_CHAT_ENABLED` convention. Never add credentials, Snowflake access, or query logic to browser code.
- Keep atlas state reproducible in validated URL parameters. Affected map findings must retain equivalent table, text, or download access, plus provenance, freshness, methodology, and limitation information.
- Add focused Vitest coverage and, for user-visible flows, Playwright coverage including axe checks for map/filter, URL state, provenance, and non-map parity as applicable.
- Extend `src/features/assistant` for conversational UI work; do not create another chat framework or put model/provider SDKs in browser code.
- Keep assistant sources structured and attributable, never render hidden reasoning or arbitrary model-provided UI, and use an explicit allowlist before adding generated Atlas UI.
- The assistant demo is feature-gated and fixture-only until a governed backend adapter is approved; never add AI secrets to public configuration.

Run the CI-equivalent checks before handoff:

```powershell
npm ci
npm run generate:api
git diff --exit-code -- contracts src/generated
npm run format
npm run typecheck
npm run lint
npm run check:design-system
npm test
npm run build
docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.carawaylabs.com .
```

`npm run format` applies the repository's deterministic Ultracite/Oxlint/Oxfmt standard. `npm run lint` is the non-mutating CI check; do not reintroduce a second lint or formatter configuration.

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `npm exec -- ultracite fix`
- **Check for issues**: `npm exec -- ultracite check`
- **Diagnose setup**: `npm exec -- ultracite doctor`

Oxlint + Oxfmt (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Oxlint + Oxfmt Can't Help

Oxlint + Oxfmt's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Oxlint + Oxfmt can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Oxlint + Oxfmt. Run `npm exec -- ultracite fix` before committing to ensure compliance.
