# toodly — features

> Detailed reference of what toodly does and the rules behind it. For how to use it step by step see the [user guide](USER_GUIDE.md); for how it is built see the [developer guide](DEVELOPER.md).
>
> Note: the app UI is in Italian by default (English can be selected in Settings → Language). Menu and button names below are given in English, with the Italian label in quotes where it helps.

## Tasks

Completion with a strike-through animation, a collapsible "Completed" section, 4 priorities (red / orange / blue / gray), collapsible hierarchical sub-tasks, **dependencies** between tasks (a task is "waiting" until its prerequisites are completed: padlock, dashed border and a "Waiting for…" badge in list, Kanban and calendar; no cycles; a "Waiting" rule is available in filters), drag & drop reordering, sorting by priority or due date, due date + start/end time, recurrence (daily, weekly, monthly, yearly: completing a task creates the next occurrence).

## Details

Right-hand drawer: Markdown description (toolbar, Ctrl+B/I shortcuts, automatic list continuation, templates, clickable checklists), a feed of multiple notes with `created_at`, attachments copied to `<AppData>/app.toodly.desktop/attachments/<task>/` with absolute path and name stored in the DB (click to open).

## Views

- **List**, **Kanban** (by status or priority, drag & drop between columns), monthly and weekly **Calendar** with time-blocking (drag from the "Unscheduled" panel into the hourly grid; move and resize blocks; double-click to create).
- Smart views: *Today*, *Next 7 days*, *Important*, *All*.
- Colored **lists**. Every task always belongs to a list: each set has at least one list ("General" by default), which cannot be deleted if it is the last one; deleting a list moves its tasks to another one; tasks without a list coming from old or imported data are assigned to the default list.
- **Custom filters** with combinable AND/OR rules, e.g. `Priority = High AND Due = Today`. The fixed sidebar entry "No filter" deactivates the active filter and goes back to "All tasks".

## System

- **Multi-window** (`Ctrl/Cmd+N` or "New window"): each window opens a **data set** (see below) and has its own view. Real-time sync through Tauri events concerns windows showing the same set (a set cannot be open in two windows, so normally each window is independent).
- The layout of all windows (position, size, maximized state, sidebar width, active view, open set) is saved in `windows.json` and recreated on restart, multi-monitor included.
- Window title: `toodly - setname`.
- Tray icon: left click restores the last active window, right click shows *Open New Window / New Quick Task / Quit*.
- Closing the last window asks whether to **quit** or **stay in the tray** (reopen with a left click on the tray icon or from the *Open New Window* menu entry; *Quit* ends the process).
- Autostart (toggle in Settings).
- Global **Quick Add** `Ctrl+Shift+Space` (`Cmd+Shift+Space` on macOS): a floating bar at the center of the screen; the task goes into the set of the most recently used window.

Quick Add and the "add" bar understand: `!high` `!medium` `!low`, `@today` `@tomorrow`, `#ListName` (the Italian forms `!alta` `!media` `!bassa`, `@oggi` `@domani` work as well).

## Sidebar width

The vertical line between the sidebar and the main area can be dragged to resize it (180–480 px); double-click resets it to 240 px. The width is stored **per window** (`sidebar` field in `windows.json`, together with position, size and maximized state) and restored when the window reopens; it is included in the layout of the export. Windows without their own value start from the old global preference `toodly.sidebarWidth`, if present.

## Groups and sub-groups

Tree-like folders (table `task_groups`; `tasks.group_id`) independent from lists. In the List view a group is a collapsible header (state saved locally): sub-groups first, then the tasks of the same level. Create them with the "Group" button (or "New sub-group" on a header), edit/delete them from the editor (when deleting, tasks and sub-groups move up one level), drag tasks and groups onto headers to move them (a "top level" drop zone appears at the bottom while dragging). Also available from the task details (Group field) and the multi-selection bar. A group name is required and unique within the set (case-insensitive). Once created, groups are always shown, even when empty.

## Quick actions

Hovering a task in the list shows, on the right, due date, priority and status (drop-down menus with the current value), then complete and delete (buttons with a confirmation modal, also in the multi-selection bar).

## Multi-selection

`Ctrl/Cmd+click` toggles a task, `Shift+click` selects a range, `Ctrl+A` selects all visible tasks, `Esc` (or "None" in the bar) clears the selection. Clicking outside the details panel closes it. A bar at the bottom applies to all selected tasks: due date (quick or specific date), priority, list, status, complete, delete.

## Delete all data

Settings → "Delete all data" → *Delete…* (with explicit confirmation): permanently deletes all sets with tasks, lists, groups, notes and attachments, resets local preferences (theme, sidebar width, collapsed groups…) and the window layout; a single window remains, with an empty "Main data" set. The interface language is untouched. Exporting a backup first is recommended.

## Export a list to Markdown

Hovering a list in the sidebar shows an "Export to .md" button next to the pencil: it saves a file with the list's tasks (`- [ ]` / `- [x]`, priority `!high`, due date `@YYYY-MM-DD`, indented sub-tasks, description as a `>` quote), first the tasks without a group, then the groups as `#`, `##`… headings. The file can be re-imported with "Add multiple tasks from text" (quotes are ignored).

## Bulk import from text

Sidebar button (or `Ctrl+Shift+I`): plain text (one task per non-empty line; `-`, `*`, `1.` markers and checkboxes are ignored; the `!high @tomorrow #list` syntax applies) or **Markdown**: `#`, `##`, `###`… headings create groups and sub-groups (the number of `#` is the level) and the following lines, with or without `-`, go into that group until the next heading; lines before the first heading stay without a group. Since group names are unique, a heading with the name of an existing group (or repeated in the text) reuses that group instead of creating a new one. Titles longer than 80 characters are shortened at the end of a sentence or word and the rest goes into the description (logic in `src/lib/bulk.ts`).

## Data sets

Data does not belong to windows but to independent, persistent **sets** (each one is a SQLite file `ds-<id>.db`; the list is in `datasets.json`). Closing a window loses nothing.

Rules when a window opens: if it is the first one and exactly one set exists, it opens it directly (with no sets it creates one, "Main data"); otherwise it shows the **picker** (new set, or an existing one not already open elsewhere). The same applies to a second window, or if the set the window had before no longer exists.

Manage them from Settings → Data → "Manage…" (or from the sidebar): list, open here / in a new window, rename, delete. The name is required and unique (case-insensitive comparison, checked on creation and rename). References are always stable, unique ids (sets `ds-…`, windows `w-…`), never indices. Data that existed before this feature is adopted as the "Main data" set (`toodly.db`).

## Export / import

Settings → Data: "Export all…" creates a single `.zip` containing:

```
manifest.json                       app, formatVersion, exportedAt, list of sets, window layout, local preferences (toodly.*)
workspaces/<setId>.json             dump of all tables of the set
attachments/<setId>/<attachmentId>/…  attached files
```

`formatVersion` (currently **1**) is the version of the export format: on import the manifest and its version are read first (backups from other apps, without a version, or newer ones are rejected with a clear message; a future version 2 can have its own reader, see `read_backup` in `backup.rs` and `pickAndReadBackup` in `backup.ts`).

"Import from zip…" asks: **Append** (imported sets are added to the existing ones) or **Overwrite** (deletes all current sets, with confirmation, and restores window layout and preferences too). If an imported name matches an existing one (or another imported one), " (2)", " (3)"… is appended to keep names unique. Internal ids are regenerated where needed and attachments are restored into the app folder.

## About

Settings → About shows the version (read from `package.json`, aligned with `tauri.conf.json` and `Cargo.toml`: update all three for a new release) and the author.

## Language

The interface is available in Italian (default) and English, selectable in Settings → Language; the choice is shared across windows and also updates the tray menu. No user-visible text lives outside the dictionaries: the frontend uses `t('text')` from `src/lib/i18n.svelte.ts` (key = Italian text, English translations in `src/lib/en.json`); the Rust backend produces no user text but codes (e.g. `NAME_TAKEN`, `UNSUPPORTED_VERSION:3`) that the frontend translates, apart from the tray menu entries, which have their own table in `lib.rs`. Dates and month names follow the selected language.
