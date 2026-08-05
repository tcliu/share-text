# Share Text Agent Conventions

## Development Guide

Read this `AGENTS.md` and the applicable shared reference files under `$AI_CONFIG_DIR/references/*.md` before writing or reviewing code. When reviewing code, follow the `code-review` skill definition, reporting findings with severity, location, rule, and fix. When instructions are ambiguous about what to change or how to approach a task, ask the user to clarify or present up to three concrete options before making changes, to avoid unwanted edits.

## Project conventions

- Server persistence goes through the `Db` interface (`src/lib/server/db-types.ts`), writing engine-agnostic SQL with `$n` placeholders and `current_timestamp` so DDL stays portable across adapters.
- Mutations are logged via `$lib/server/logging` with key identifying info (document id, name, size, IP, `elapsed_ms`).
- Document tags are stored as a JSON array of `{ name, color }` objects in the `documents.tags` column; `color` must be one of the hex `TAG_COLORS` in `src/lib/tag-colors.ts`, and chips/dropdowns render via the `tagChipStyle`/`tagDotStyle` inline-style helpers there (class helpers `tagChipClass`/`tagDotClass` carry the non-colour base styles). Tag badges render with the `Chip` component (`src/lib/components/Chip.svelte`).
- Document types follow the shared `type-registry` reference: the closed value set lives in `src/lib/document-type-values.ts`, the type definitions (language extensions, validators, formatters, converters, preview, toolbar actions) in `src/lib/document-types.ts`, and pure parse/format utilities in `src/lib/document-type-utils.ts`. Each type entry lazy-loads heavy dependencies (language modes, parsers) via dynamic `import()` inside the definition so they are not in the initial bundle. Consumers dispatch through `getDocumentType(value)` and never branch on specific type values.
- Editable form dialogs (settings, tags, format) use the OK/Apply + Reset pattern from the shared `ui-patterns` reference.
- Overlay option panels (dropdowns, tag suggestions) position via the shared `positionPanel` action (`src/lib/position-panel.svelte.ts`): attach it to the panel with `use:positionPanel={() => ({ getTrigger: ..., getOpen: ..., align?, autoPlace? })}` and keep the `fixed left-0 top-0 z-50 will-change-transform` positioning classes on the panel. The action portals to `document.body`, auto-places above/below, and repositions on resize/scroll; components keep their own open/close, keyboard, and outside-click handling.

## Keeping references in sync

- When a code change establishes or revises a project-specific convention, update this `AGENTS.md` in the same change.
- When a code change establishes or revises a generic reusable convention, update the appropriate file under `$AI_CONFIG_DIR/references/` in the same change rather than duplicating it here.
 - Shared reference files under `$AI_CONFIG_DIR/references/` must remain generic and implementation-agnostic. Do not include project-specific file paths, component names, routes, or other internal identifiers in those references — put project-level details in this `AGENTS.md` instead. See `ai/references/README.md` for the brief style guide.

## Quality checks

Run before finishing any change:

```bash
npm run check
npm run build
npm test
```
