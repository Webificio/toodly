# toodly — developer guide

This document describes how toodly is built: architecture, data model, the frontend/backend contract, persistence files and the conventions to follow when contributing. For the list of user-visible features see [FEATURES.md](FEATURES.md); for build and packaging see [BUILDING.md](BUILDING.md); for the end-user manual see [USER_GUIDE.md](USER_GUIDE.md).

## 1. Architecture overview

toodly is a [Tauri v2](https://tauri.app) desktop app:

- **Frontend**: SvelteKit (Svelte 5 runes, SPA via `adapter-static`, `ssr = false`), Tailwind CSS v4, bits-ui headless components, Motion One for animations. The build output (`build/`) is served by Tauri as the web content.
- **Backend**: Rust (`src-tauri/`). It is deliberately thin: windows, data-set registry, tray, global shortcut, attachments and zip backup. It does **not** own the task data.
- **Storage**: SQLite through `tauri-plugin-sql`. All queries and the schema live in the **frontend** (`src/lib/db.ts`, `schema.ts`, `store.svelte.ts`), because every data set is a separate DB file with a dynamic name and the plugin's built-in migrations require a fixed name.

```
┌────────────── window "w-…" (webview) ──────────────┐        ┌────────── Rust backend ──────────┐
│ SvelteKit UI  ⇄  store.svelte.ts  ⇄  SQLite (plugin)│        │ windows.rs  layout, data sets    │
│        │                                            │ invoke │ lib.rs      tray, shortcut, exit │
│        └── windowing.ts / datasets.ts / backup.ts ──┼───────▶│ backup.rs   zip export/import    │
│                                                     │◀───────│ attachments.rs  files on disk    │
└─────────────────────────────────────────────────────┘ events └──────────────────────────────────┘
```

Key ideas:

1. **Data sets, not windows, own data.** A set is a SQLite file (`ds-<id>.db`) that exists independently from windows. A window is assigned exactly one set at a time, and a set can be open in at most one window.
2. **Windows are described by `WinState`** (label, route, geometry, maximized, set id, sidebar width) and persisted by the backend in `windows.json`.
3. **Navigation state lives in the URL query string** (`scope`, `mode`, `sort`, `group`, `cal`, `gz`, `d`). The frontend reports the route to the backend (`report_route`) on every navigation, so views are restored on restart.
4. **The backend never produces user-facing text**: it returns codes (`NAME_TAKEN`, `NAME_REQUIRED`, `UNSUPPORTED_VERSION:<n>`…) that the frontend translates. The only exception is the tray menu, which has its own table in `lib.rs`.

## 2. Repository layout

```
src/
  app.html, app.css          shell and Tailwind theme tokens
  hooks.ts                   reroute /index.html → /
  routes/
    +layout.svelte           app shell: sidebar, resizer, dialogs, window bootstrap
    +layout.ts               ssr = false, prerender = false
    +page.svelte             current view (list / kanban / calendar / gantt / graph / orbit / metro)
  lib/
    store.svelte.ts          reactive state + all DB writes
    db.ts                    per-set DB connection cache, exec/select helpers
    schema.ts                SQLite schema + idempotent migration
    workspace.ts             wipe a data set (attachments + rows)
    datasets.ts              data-set registry client (list/create/rename/delete/assign)
    backup.ts                zip export/import (versioned manifest)
    windowing.ts             window helpers, data-changed events, report_route…
    nav.svelte.ts            query-string navigation state, global UI state, toasts
    views.ts                 scopes, filter rules, sorting, sort-key math
    quickparse.ts            Quick Add syntax (!priority @date #list)
    bulk.ts                  bulk text / Markdown import parser
    exportmd.ts              list → Markdown export
    markdown.ts              Markdown rendering (marked + DOMPurify)
    dnd.svelte.ts            drag & drop with Pointer Events
    selection.svelte.ts      multi-selection state
    groupui.svelte.ts        collapsed groups per data set + view (localStorage)
    components/GanttView.svelte   Gantt: tree (groups/tasks) + timeline, drag/resize bars, dependency arrows
    exportgantt.ts           Gantt → Mermaid (.md) export
    themes.css               (src/) theme blocks: colours, shapes, shadows, Graph group tints; see THEMES.md
    exportgraph.ts           Graph → Mermaid (.md) export (save dialog; the pure `graphToMermaid` lives in graph.ts)
    components/GraphView.svelte   Graph: canvas (native scroll + scaled world), minimap, zoom, drag & drop; GraphGroup / GraphTask are its nodes
    maps.ts                  Orbit + Metro: shared pure helpers (root group per task, colours, breadcrumb, label picking, polar coordinates)
    orbit.ts / metro.ts      Orbit radar and Metro subway layouts + `orbitToMermaid` / `metroToMermaid` (pure; tests/maps.test.ts); exportmap.ts saves them
    components/OrbitView.svelte, MetroView.svelte   the two views; MapCanvas (pan/zoom/minimap), MapNode (bubble + hover card), MapBar (add bar) are shared
    graph.ts                 Graph: pure layout (nodes, connectors, palette, dependency curves), unit-tested in tests/graph.test.ts
    uiprefs.svelte.ts        UI preferences (task numbering) in localStorage
    layoutui.svelte.ts       per-window sidebar width
    theme.svelte.ts          light / dark / system
    i18n.svelte.ts, en.json  translations
    dates.ts, ids.ts, motion.ts, types.ts
    components/              views, drawer, editors, dialogs
src-tauri/
  src/main.rs                entry point
  src/lib.rs                 plugins, tray, global shortcut, window events, lifecycle
  src/windows.rs             window state, data-set registry, Quick Add, exit logic
  src/backup.rs              zip export/import
  src/attachments.rs         attachment copy/open/delete, external links, text file save
  capabilities/default.json  permissions granted to all windows
  tauri.conf.json            app config (windows are created from Rust, none declared)
docs/                        documentation
.github/workflows/           CI installers build
```

## 3. Data model

Defined in `src/lib/schema.ts` (all steps are idempotent and run every time a set is opened). Ids are UUID strings (`uid()` in `ids.ts`); timestamps are ISO strings; `sort` is a floating-point key.

| Table | Purpose | Notable columns |
|---|---|---|
| `lists` | Colored task lists | `name`, `color`, `sort` |
| `task_groups` | Tree of groups / sub-groups | `parent_id` (self FK, `SET NULL`), `name`, `sort` |
| `tasks` | Tasks and sub-tasks | `list_id`, `group_id`, `parent_id` (cascade), `title`, `description` (Markdown), `completed`, `completed_at`, `priority` 0–3, `status` `todo\|doing\|done`, `in_gantt` 0/1 (default 1: show in the Gantt), `start_date` `YYYY-MM-DD` (Gantt start; `NULL` = creation day, see `taskStart()` in `dates.ts`), `due_date` `YYYY-MM-DD`, `start_time`/`end_time` `HH:MM`, `recurrence` `none\|daily\|weekly\|monthly\|yearly`, `sort` |
| `notes` | Note feed of a task | `task_id`, `text`, `created_at` |
| `attachments` | Files attached to a task | `task_id`, `name`, absolute `path`, `size` |
| `filters` | Saved custom filters | `match_mode` `and\|or`, `rules` (JSON array of `{field, op, value}`) |
| `task_deps` | Dependencies | `(task_id, depends_on_id)` primary key, cascade |

`TABLES` in `schema.ts` lists the tables in dependency order; export, import and wipe rely on it. `group_id`, `in_gantt` and `start_date` were added later via a guarded `ALTER TABLE` (`start_date` is back-filled once with the local creation day, never after `due_date`), which is the pattern to follow for new columns (check `PRAGMA table_info` first, since `ALTER` is not idempotent).

**Invariants** enforced by the store:

- Every set has at least one list ("General" by default) and no task is without a list (`ensureDefaultList`).
- Group names are unique per set (case-insensitive); data-set names are unique and required (validated in Rust).
- Dependencies cannot form cycles (`wouldCycle`). A task is *blocked* while any prerequisite is not completed.
- Completing a recurring task with a due date creates the next occurrence (`spawnNextOccurrence`).

### Filter rules

`Rule = { field, op, value }` with `field` ∈ `priority | due | list | status | completed | title | blocked`. Operators: `=`/`!=` for all, `>=`/`<=` for priority. `due` values: `none`, `any`, `overdue`, `today`, `tomorrow`, `next7`, `date:YYYY-MM-DD`. Evaluation is in `views.ts` (`ruleMatches`, `filterMatches`); `match_mode` chooses AND/OR.

### Scopes

`nav.scope` is one of the smart views (`today`, `next7`, `important`, `all`), `list:<id>` or `filter:<id>` (`views.ts → inScope`). The legacy `inbox` scope is redirected to `today`.

## 4. Frontend

### State and writes

`store.svelte.ts` exports a singleton `store` (Svelte 5 runes). `reload()` loads every table; reads are derived in memory. Writes are **optimistic and serialized**: the in-memory state is updated first, then the SQL runs in a queue through `write()`; on failure the store reloads from the DB. After a successful write the window emits `data-changed` (`windowing.ts`) so other windows on the **same set** reload (debounced, 60 ms). Because a set is normally open in one window, this mainly serves the Quick Add bar.

Manual ordering uses `sort` keys placed between neighbours (`sortBetween` in `views.ts`), renumbering when the gap becomes too small.

### Window bootstrap (`+layout.svelte`)

1. `initTheme()`, `initLang()`, `initSidebar()`.
2. `window_dataset` (backend) returns the set assigned to this window; if present it is opened (`setWorkspace`, `store.reload()`, window title), otherwise the **set picker** is shown.
3. `window_ready` tells the backend to show the window (windows are created hidden to avoid a white flash; a 3.5 s timer is the fallback).
4. A `$effect` calls `report_route` whenever the query string changes.

### Quick Add

The `quick` window (`/?quick=1`) is a transparent, always-on-top, undecorated webview created at startup and shown by the global shortcut. The backend picks the target set (last active window with a set) and sends the `quick-show` event; the task is written directly into that set's DB and the other windows are notified with `data-changed`.

### Drag & drop

Native HTML5 drag & drop is disabled (`disable_drag_drop_handler`); `dnd.svelte.ts` implements it with Pointer Events and is shared by list, Kanban, calendar and group re-parenting.

### Markdown

`markdown.ts` renders with `marked` and sanitizes with `DOMPurify`. `MarkdownEditor.svelte` provides the toolbar, shortcuts, list continuation, templates and clickable checklists.

### Internationalization

- Use `t('Italian source text', { param })` from `i18n.svelte.ts`. **The key is the Italian text**; English translations go in `src/lib/en.json`. Missing keys fall back to the key itself.
- Never hardcode user-visible strings. Placeholders use `{name}`.
- The language is stored in `localStorage` (`toodly.lang`) and mirrored to the backend (`set_language`) for the tray menu.
- Dates and month names use `Intl` through `locale()`.

### Local preferences

Stored in `localStorage` with the `toodly.` prefix (theme, language, task numbering, reminders, default reminder time, tour done, collapsed detail sections, collapsed groups, legacy sidebar width). They are included in the backup manifest (`prefs`) and cleared by "Delete all data".

## 5. Backend (Rust)

### Persistence files (app data dir, e.g. `%APPDATA%\app.toodly.desktop`)

| File | Content |
|---|---|
| `ds-<id>.db` (+ `-wal`, `-shm`) | One SQLite database per data set |
| `toodly.db` | Legacy database, adopted as the set with id `main` ("Main data") |
| `datasets.json` | Registry: `[{ id, name, created_at }]` |
| `windows.json` | Layout: `[WinState]` |
| `lang.txt` | Language for the tray menu |
| `attachments/<task>/…` | Attachment files |

`WinState` (`windows.rs`): `label`, `route`, `x`, `y`, `w`, `h` (physical pixels), `maximized`, `ws` (data-set id, optional) and `sidebar` (sidebar width, optional). New optional fields must use `#[serde(default)]` so older `windows.json` files keep loading.

### Window lifecycle

- `create_window` registers the `WinState` first, builds the webview **hidden**, applies saved size/position (only if the rectangle is sufficiently visible on one of the current monitors, otherwise the window is centered) and maximizes if needed.
- `capture_geometry` runs on `Moved`/`Resized`, ignores minimized and fullscreen windows (Windows reports bogus coordinates) and stores the *restored* geometry when maximized. Saving is debounced (700 ms, `schedule_save`).
- `restore_windows` recreates every saved window on start. With `--autostart` and no saved windows the app stays in the tray.
- `forget_window` drops a closed window from the layout, unless the whole app is quitting (the layout is kept then).
- Closing the last window is intercepted: the backend emits `close-confirm`, and the frontend answers through `close_choice` (quit or destroy the window and stay in the tray).
- A **single-instance** plugin brings the last active window to the front when a second instance starts.

### Data-set resolution (`resolve_dataset`)

A window gets a set when: it has a candidate (saved or requested) that exists and is not open elsewhere; or it is the first, new window and there is zero or one set (zero → one is created). Otherwise the frontend shows the picker.

### Commands exposed to the frontend

| Module | Commands |
|---|---|
| `windows.rs` | `open_window`, `report_route`, `window_ready`, `hide_quick`, `quit_app`, `close_choice`, `list_windows`, `list_datasets`, `create_dataset`, `rename_dataset`, `remove_dataset`, `window_dataset`, `assign_dataset`, `replace_layout`, `window_sidebar`, `set_sidebar_width` |
| `backup.rs` | `export_zip`, `read_backup`, `extract_attachments` |
| `attachments.rs` | `add_attachment`, `delete_attachment_file`, `delete_task_attachments`, `open_attachment`, `open_external`, `save_text_file` |
| `lib.rs` | `set_language` |

Window-creating commands are `async` and handlers go through `spawn_new_window` (a separate thread): creating windows from a synchronous command or the main thread can deadlock on Windows.

### Permissions

`src-tauri/capabilities/default.json` grants the default core permissions, SQL (`sql:default`, `sql:allow-execute`), autostart, dialog and `core:window:allow-set-title` to all windows. Add a permission there when you use a new plugin API from the frontend.

### Undo, search, reminders

- **History** (`store.svelte.ts`): `record()` pushes `{label, key, undo, redo}`; same-`key` entries within 1.5 s merge; `batch(label, fn, toast)` groups several operations into one entry; limit 100; `clearHistory()` on data-set change. Deleting keeps attachment files (list in `localStorage` `toodly-internal.pendingPurge`, purged after 6 h or on eviction). `onTasksRemoved(fn)` lets the UI drop selection of vanished tasks.
- **Search**: `SearchDialog.svelte`, opened with `ui.searchOpen`.
- **Reminders** (`reminders.svelte.ts`): a 20 s tick per non-quick window; dedupe through `toodly-internal.reminded` (not backed up). Uses `@tauri-apps/plugin-notification` (`tauri-plugin-notification` in `Cargo.toml`, registered in `lib.rs`, permission `notification:default`). After pulling these changes run `npm install` and rebuild the Rust side. Only the data set open in a window is checked.
- **Migrations** (`schema.ts`): `addColumn()` is idempotent and `PRAGMA busy_timeout = 5000` is set, so concurrent windows can migrate the same file.
- `toodly-internal.*` localStorage keys are runtime state and are not part of backups.

### Tags, recurrence, milestones (schema additions)

New `tasks` columns (guarded by `addColumn`): `tags` (lowercase words separated by spaces; `src/lib/tags.ts` normalizes/parses; `Task.tags` is a `string[]`, converted in `applyPatch` and on load), `recur_until` (ISO date) and `milestone` (0/1). `recurrence` is now a free string: `none | daily | weekly | monthly | yearly | weekdays | monthend | dow:1,4` (0 = Sunday); `nextOccurrence()` in `dates.ts` interprets it and `spawnNextOccurrence` shifts the other dates by the same day delta. `parseQuick(text, lists, withTags = true)` returns `tags` (bulk import passes `false`). The `tag:<name>` scope and the `tag` filter rule live in `views.ts`. `EXPORT_FORMAT_VERSION` is unchanged: backups copy the columns that both sides have.

GanttView extras: `critical` (tight dependency chain ending at the latest end date), `lateIds`/`lateKeep`, link-drag (`startLink`, `store.addDep`) and row virtualization (`win`/`visible`, active above 120 rows). Appearance prefs (`density`, `textScale`) are applied to `<html>` (`data-density`, CSS `zoom`) by `uiprefs.svelte.ts`.

GraphView: `graph.ts` is pure (no Svelte, store or DOM) and unit-tested (`tests/graph.test.ts`). `buildGraph()` takes the groups and the already-sorted tasks of the view and returns nodes (`group` / `task` / `add`), connectors and the size of the graph; layout is a stacked tree (root groups side by side, children below with a rounded elbow, sub-tasks indented) and positions are never stored: the manual `sort` only orders siblings. `depEdges()` / `depPath()` give the dependency curves. Colours: top-level groups take an index into `PALETTE` (20 entries, by creation order); each node carries `--gh` / `--gl` (`paletteStyle()`), and the CSS in `GraphView.svelte` turns them into `--gfill`, `--gborder`, `--gacc` with one set of tones for the light and one for the dark theme (`.dark .gx`). The canvas uses native scrolling (`data-scroll="xy"`, so `dnd.svelte.ts` auto-scroll and the global `scrollIntoView` keyboard navigation work) around a scaled "world" `div`; the minimap and the zoom pivot convert pointer coordinates with the ratio `getBoundingClientRect().width / offsetWidth` so they stay correct when the interface size setting uses CSS `zoom`. Cards are `[data-task][data-task-id]` so selection, keyboard navigation and the details panel need no special code. Zoom and scroll position are kept in a module-level map per data set and view (in memory only).

### Adding a command

1. Write the `#[tauri::command]` function (take `AppHandle` / `WebviewWindow` as needed; `window.label()` identifies the caller).
2. Register it in `tauri::generate_handler![…]` in `lib.rs`.
3. Call it with `invoke('name', { camelCaseArgs })` from the frontend (Tauri converts argument names to camelCase).
4. Return `Result<_, String>` with a **code**, not a sentence, for errors the user can see.

## 6. Backup format

A single `.zip`:

```
manifest.json                         { app, formatVersion, exportedAt, workspaces, datasets, windows, prefs }
workspaces/<setId>.json               dump of all tables of the set
attachments/<setId>/<attachmentId>/<name>
```

`formatVersion` is currently **1**. Import reads the manifest first and rejects files that are not from toodly, have no version, or are newer than supported (`UNSUPPORTED_VERSION:<n>`). A future format change should bump the version and add a dedicated reader (`read_backup` in `backup.rs`, `pickAndReadBackup` in `backup.ts`). Import modes: **append** (new sets, names disambiguated with " (2)", " (3)"…, ids regenerated where needed) and **overwrite** (wipe everything, restore sets, layout and prefs through `replace_layout`).

## 7. Conventions

- Svelte 5 runes (`$state`, `$derived`, `$effect`); no legacy stores.
- Keep SQL in `store.svelte.ts` (or `backup.ts` / `workspace.ts` for whole-set operations). Components call store methods.
- Use stable ids, never array indices, to reference sets, windows, tasks, lists, groups.
- No hardcoded user text (see Internationalization); Rust returns codes.
- Keep documentation updated: README, FEATURES, USER_GUIDE and this file when behavior changes, including per-OS build notes.
- Version bumps touch `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` together; the About dialog reads the version from `package.json` at build time (`__APP_VERSION__` in `vite.config.ts`).

### Templates, backups, previews, .ics

- `templates.svelte.ts`: templates in `localStorage` (`toodly.templates`), nodes keep date offsets from the root task; `useTemplate` creates tasks inside `store.batch` (one undo step).
- `autobackup.svelte.ts`: scheduler (20 s after start, then every 30 min) using `autoBackupTo()` in `backup.ts` and the Rust command `prune_backups(dir, keep)` (deletes the oldest `toodly-auto-*.zip`). State in `toodly-internal.autoBackup*`; cross-window lock key `toodly-internal.autoBackupLock`.
- `read_attachment` (Rust, `attachments.rs`) returns the bytes of an attachment (inside the attachments root, max 8 MB) as `tauri::ipc::Response`; `AttachmentPreview.svelte` builds a Blob URL.
- `ics.ts` is pure (no Tauri) and unit-tested; `exportics.ts` handles the save dialog.
- Tests live in `tests/` and mock `src/lib/i18n.svelte` with `vi.mock`; `vitest.config.ts` is separate from `vite.config.ts` so no SvelteKit plugin is needed.

### Changelog and releases

`CHANGELOG.md` (Keep a Changelog format) is the single source of release notes. While working, add items under `## [Unreleased]`. To release: rename it to `## [x.y.z] - YYYY-MM-DD` (and open a fresh *Unreleased*), bump the version in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` (and the lockfiles), commit, then `git tag vx.y.z && git push --tags`. The workflow checks the tag against `package.json` and the changelog, runs `npm test`, builds the installers and creates the GitHub release with the changelog section as its text (`node scripts/release-notes.mjs x.y.z` prints it locally).

## 8. Useful checks

```bash
npm run check                 # svelte-check / TypeScript
npm test                      # vitest: logic tests in tests/ (dates, quick-add parsing, tags, scopes/filters, .ics)
cd src-tauri && cargo check   # Rust type-check
npm run tauri dev             # run the app with hot reload
```

Known limitations: on Linux/Wayland global shortcuts may be unavailable; runtime behavior on Windows (creating windows, deleting set files) has so far been verified only with browser mocks and `cargo check` / unit tests.
