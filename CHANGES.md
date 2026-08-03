# Changes Summary

## Top 3 Issues Fixed

### 1. Schema-apply script missing `bigserial` rewrite
**File**: `scripts/db-config.mjs:64-68`

Added `.replaceAll('bigserial', 'integer')` to the `toSqliteSql` function. This ensures that `npm run schema:apply` works correctly in dev mode with SQLite, which doesn't support the `bigserial` type.

### 2. Client-side upload doesn't validate byte size
**File**: `src/lib/components/DocumentEditorPane.svelte:53-71`

Added byte-size validation using `TextEncoder` to check the 1 MiB limit before checking the character limit. This prevents files with multibyte characters from passing client validation but failing on the server.

### 3. Layout component is a monolith
**Files**: 
- Created `src/lib/use-documents.svelte.ts`
- Created `src/lib/use-editor-guard.svelte.ts`
- Refactored `src/routes/(browser)/+layout.svelte`

Extracted composables from the 277-line layout component:
- `useDocuments` - manages documents list, refresh, create, delete, rename operations
- `useEditorGuard` - manages editor guard registration, discard logic, and navigation guards

The layout is now a thin orchestration layer that instantiates these composables and wires them to child components.

## Bug Fixes

### 4. "+" (New document) added no document
**File**: `src/lib/use-pinned-documents.svelte.ts` (later removed)

The prune `$effect` read and wrote `pinnedIds` on every run, causing an infinite Svelte reactivity loop (`effect_update_depth_exceeded`). This crashed the layout's state updates, so creating a document server-side never reflected in the list. Fixed by making the prune write idempotent and later removing the pinned concept entirely.

### 5. Selecting a document hid the other documents
**Files**: `src/lib/components/DocumentList.svelte`, `src/routes/(browser)/+layout.svelte`

Selecting a document auto-pinned it, switching the list source from the full document set to the pinned subset, hiding every other document. The pinned/active-list concept was removed: the left pane now always lists all shared documents (paginated), with the selected row highlighted.

## Pagination Implementation

### Server-side changes
- **`src/lib/server/documents.ts`**: Updated `fetchDocumentSummaries` to accept optional `limit` and `offset` parameters
- **`src/routes/api/documents/+server.ts`**: Updated GET endpoint to accept `limit` and `offset` query parameters and return `hasMore` flag

### Client-side changes
- **`src/lib/documents.ts`**: Updated `fetchDocumentSummaries` to support pagination and return `DocumentListResponse` with `documents` array and `hasMore` flag
- **`src/lib/use-documents.svelte.ts`**: Added `loadMore` functionality and `hasMore` state. Default page size is 20 (configurable via `DEFAULT_DOCUMENTS_PAGE_SIZE`)
- **`src/lib/components/DocumentList.svelte`**: Added `hasMore` and `onLoadMore` props, renders "Show more" button when there are more documents to load

### Test updates
- **`src/lib/__tests__/documents-api.test.ts`**: Updated tests to match new `DocumentListResponse` format and added test for pagination parameters

## Verification

All checks pass:
- ✅ `npm run check` - 0 errors, 0 warnings
- ✅ `npm test` - 54/54 tests passing
- ✅ `npm run build` - successful build

## Configuration

The pagination page size is configurable via the `DEFAULT_DOCUMENTS_PAGE_SIZE` constant in `src/lib/use-documents.svelte.ts`. To change it, modify the constant or pass a `pageSize` option when calling `useDocuments()`.
