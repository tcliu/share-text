# Share Text

A public shared-text webapp where any visitor can create, edit, save, and delete
documents that are shared with everyone. Built with SvelteKit and deployed to
Vercel with a Neon PostgreSQL store.

- SvelteKit 2 + Svelte 5 (runes), Tailwind CSS v4, CodeMirror 6
- Two-pane layout: document list on the left, editor on the right
- Two profiles: `dev` (local SQLite, no config) and `prod` (Neon on Vercel)

## Requirements

- Node.js 24+ (dev uses the built-in `node:sqlite` module)
- `prod` requires a PostgreSQL database (Neon); `dev` needs none

## Install

```bash
npm install
```

## Configuration

Runtime configuration comes from environment variables. For local development,
keep the defaults in `.env` and optional local overrides in `.env.local`.
`.env.dev` is loaded only by the dev server as a dev-specific override (it wins
over `.env` and `.env.local`); real shell environment variables always take
precedence.

Some scripts also merge env files directly:

- `scripts/db-config.mjs` loads `.env`, `.env.local`, and `.env.vercel`, then
  overlays the current shell environment.
- `scripts/sync-vercel-env.mjs` merges `.env` and `.env.vercel` before syncing
  production values to Vercel.
- `.env.example` is a template only; it is not loaded by the app or scripts.

### Profiles

The `PROFILE` variable selects the database backend. It is derived as follows:
an explicit `PROFILE=dev|prod` wins; otherwise `NODE_ENV=production` resolves to
`prod`; otherwise `dev`. `npm run dev` runs in `dev` with no configuration.

| Profile | Backend | Database |
|---|---|---|
| `dev` | SQLite (`node:sqlite`) | `.data/share-text-dev.sqlite`, auto-created |
| `prod` | PostgreSQL (`pg`) | `DATABASE_URL` (Neon) |

`PROFILE=prod npm run dev` runs the prod profile locally against Postgres, and
`SQLITE_PATH` overrides the dev database file path.

Keys:

| Key | Description |
|---|---|
| `PROFILE` | `dev` (default) or `prod` |
| `APP_BASE_URL` | Public URL the app is reachable at |
| `DATABASE_URL` | PostgreSQL connection string (required only for `prod`) |
| `SQLITE_PATH` | Dev SQLite file (default `.data/share-text-dev.sqlite`) |
| `MAX_DOCUMENTS_PER_IP` | Max documents a single client IP can create (default 10) |
| `MAX_CONTENT_LENGTH` | Max document content length in chars (editor + uploads, default 1048576), subject to a separate hard 1 MiB UTF-8 byte cap |

## Database Setup

The committed schema lives in `sql/schema.sql` (portable across Postgres and
SQLite, idempotent): the `documents` table plus its `updated_at` index. Each row
has an internal auto-incrementing `id` (sequence) and a public six-character
`key` (`0-9a-z`) that identifies the document in URLs.

```bash
npm run schema:apply        # applies to the dev SQLite database
PROFILE=prod npm run schema:apply   # applies to the prod database (DATABASE_URL)
```

In `dev` the schema is also applied automatically when the server first starts.

## Development

```bash
npm run dev
```

Open `http://localhost:5173`. The left pane lists all shared documents, most
recently edited first. The search box filters the list in place. Click a name to
navigate to `/{doc-id}` and load that document's content into the editor. Click
**New document** to create one; it is added to the list automatically.
Double-click a name (or use the pencil icon next to it) to rename. No
`DATABASE_URL` is needed — documents are stored in a local SQLite file at
`.data/share-text-dev.sqlite` (created on first run).

## Quality Checks

```bash
npm run check
npm run build
npm test
```

## Deploy to Vercel

1. Install the Vercel CLI (`npm i -g vercel`) and log in: `vercel login`.
2. Link the project: `vercel pull --yes`.
3. Set the real production values in `.env.vercel`:
   - `PROFILE=prod`
   - `APP_BASE_URL=https://<your-alias>.vercel.app`
   - `DATABASE_URL=<your-neon-connection-string>`
4. Sync environment variables to Vercel:

   ```bash
   npm run env:sync:vercel
   ```

   This merges `.env` defaults with `.env.vercel` overrides, upserts the set to
   Vercel production env vars, and removes production env vars no longer present.

5. Deploy:

   ```bash
   npm run deploy
   ```

   This builds, deploys to production, waits for the deployment to reach
   `READY`, and syncs the project's production domain to `APP_BASE_URL`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |
| `npm run check` | Run svelte-check |
| `npm test` | Run Vitest |
| `npm run schema:apply` | Apply `sql/schema.sql` to the dev SQLite database (or `PROFILE=prod` for the prod database) |
| `npm run env:sync:vercel` | Sync `.env` + `.env.vercel` to Vercel |
| `npm run deploy` | Deploy to Vercel |
