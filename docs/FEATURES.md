# toodly — features

> Detailed reference of what toodly does and the rules behind it. For how to use it step by step see the [user guide](USER_GUIDE.md); for how it is built see the [developer guide](DEVELOPER.md).
>
> Note: the app UI is in Italian by default (English can be selected in Settings → Language). Menu and button names below are given in English, with the Italian label in quotes where it helps.

## Tasks

Completion with a strike-through animation, a collapsible "Completed" section, 4 priorities (red / orange / blue / gray), collapsible hierarchical sub-tasks, **dependencies** between tasks (a task is "waiting" until its prerequisites are completed: padlock, dashed border and a "Waiting for…" badge in list, Kanban and calendar; no cycles; a "Waiting" rule is available in filters), drag & drop reordering, sorting by priority or due date, start date (default: creation day; never after the due date), due date + start/end time, recurrence (daily, weekly, monthly, yearly: completing a task creates the next occurrence).

## Details

Right-hand drawer: Markdown description (toolbar, Ctrl+B/I shortcuts, automatic list continuation, templates, clickable checklists), a feed of multiple notes with `created_at`, attachments copied to `<AppData>/app.toodly.desktop/attachments/<task>/` with absolute path and name stored in the DB (click to open).

## Views

- **Themes**: *Settings → Appearance → Theme* picks the style (*Default*, *Material*, *CRT*, *Nord*, *Solarized*, *Dracula*, *Gruvbox*, *Rosé Pine*); it is independent from the Light / Dark / System mode and is remembered per machine (`toodly.themestyle`) and shared by all windows. A theme is a block of CSS variables in `src/themes.css` (how to create or customise one: [THEMES.md](THEMES.md)) (`:root[data-theme='x']` light, `:root[data-theme='x'].dark` dark): colours, shapes (`--radius-*` for the Tailwind utilities, `--r-ctl/-field/-icon/-menu/-item/-gr/-gs` for buttons, fields, menus and Graph nodes), shadows (`--shadow`, `--shadow-sm`), a `--glow` for primary buttons and the hue/saturation/lightness of the Graph groups (`--g-hs`, `--g-sat`, `--g-ld`). Each theme has its own character: Material is tonal with pill buttons, Dracula has a neon glow, Gruvbox hard offset shadows, Nord and Solarized are flat, Rosé Pine soft and very round. *CRT* is dark only (the mode switch is disabled), square, with phosphor glow, scanlines and the generic system `monospace` font; every other theme keeps the same font. The `.dark` class and `data-theme` are set on `<html>` by `theme.svelte.ts` and, before first paint, by the inline script in `app.html`.
- **Orbit**: a radar view — today at the centre, time rings, one coloured sector per group; urgent tasks sit near the centre. **Metro**: a subway-map view — one line per group, one station per task, time flowing right, dependencies as interchanges. Both have the same pan / zoom / minimap, add bar, selection, details panel and quick actions as the Graph.
- **Cork** (draggable sticky notes on a cork board), **Road** (perspective road toward the horizon), **Matrix** (importance × deadline), **Mosaic** (tiles sized by urgency), **Ridge** (daily workload vs capacity, with estimated durations) **Grove** (one tree per group) and **Slot** (day timeline with drag & drop into free slots): all with the same selection, details panel, hover card and quick actions as the Graph. The view switcher shows only icons, with the name on the active view or on hover.
- **Graph**: a tree of groups → sub-groups → tasks → sub-tasks on a canvas you move by dragging the background and zoom with `Ctrl` + wheel or a slider, with a minimap (whole graph + box of the current view) in the bottom-left corner. It has the same add bar as the List and reuses its parts: `TaskQuickActions`, the details panel, multi-selection, the keyboard navigation (cards are `[data-task]`), the drag & drop library and the shared open/closed state of groups. Layout is automatic and decided in `src/lib/graph.ts` (pure, unit-tested): root groups side by side, children stacked below with a rounded elbow connector, sub-tasks indented; the manual `sort` only orders siblings. Top-level groups take a tint from a 20-entry blue/violet palette (rotation by creation order); the two tones per theme live in CSS variables (`--gh`, `--gl` → `--gfill`, `--gborder`, `--gacc`). Dependencies are dashed curves (red when late). Native scrolling is used (not a transformed viewport) so `scrollIntoView`, drag auto-scroll and the scroll bars keep working; the view (zoom and position) is remembered per data set and view while the app is open. **Export**: the *Mermaid* button in the top-right toolbar (and a copy button) produces a Markdown file with a ```` ```mermaid flowchart LR ```` diagram built from the same model as the view (`graphToMermaid` in `src/lib/graph.ts`, unit-tested): groups and sub-groups are `subgraph`s (empty ones are skipped, folded ones are exported in full), tasks are nodes with their due date (milestones are diamonds), sub-tasks are linked to their parent (`-->`) and dependencies go from prerequisite to waiting task (`-.->`); completed, in-progress and high-priority tasks get the `done`, `doing` and `crit` classes. It follows the view's scope and *Completed* toggle. No new dependencies.
- **Gantt**: every task with a due date is a bar from its start date to its due date, over a timeline with day / week / month zoom and a "today" line. The left side keeps the groups → sub-groups → tasks → sub-tasks hierarchy (group open/closed state is shared with the List view); group rows show a summary bar (first start to last due date of their content). Bars can be dragged to move them, or resized from either end (day snapping); a click opens the task details; a double-click on the row of a task without a due date sets it. Dependencies are drawn as arrows (red when the prerequisite ends after the dependent task starts); bars show progress (completed, or share of completed sub-tasks), completed tasks are dimmed, waiting tasks have a dashed outline. Tasks without a due date have no bar. Each task has a **Show in Gantt** switch (task details; also an eye button on hover in the Gantt tree): excluded tasks keep their place in the hierarchy but shrink to a thin, faint row with no bar (they do not count in group summaries or arrows); the *Show excluded* toggle hides them completely. **Export**: the *Mermaid* button saves the Gantt as a Markdown file with a ```` ```mermaid gantt ```` diagram (a copy button puts it on the clipboard): groups and sub-groups become sections ("Group / Sub-group"), sub-tasks follow their parent with a ↳ prefix, and only tasks shown in the Gantt and with a due date are included (same scope and *Show completed* choice as the view); completed tasks are `done`, in-progress `active`, high-priority `crit` (logic in `src/lib/exportgantt.ts`). Scope "Today" / "Next 7 days" show everything, like the Calendar.
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

## Search, undo, reminders and statistics

- **Global search** (`Ctrl/Cmd+K`): palette over titles and descriptions (accent- and case-insensitive, all words must match), filters by list and priority, optional completed tasks, keyboard navigation; picking a result opens the task's list and its details. With an empty query it shows recently modified tasks.
- **Undo / redo** (`Ctrl+Z`, `Ctrl+Y` or `Ctrl+Shift+Z`, and header buttons): the last 100 operations (edits, completion, move, reorder, delete — also bulk ones, as a single step). Quick edits of the same field are merged. Deleting shows a "Task deleted · Undo" toast. Attachment files of deleted tasks stay on disk until the entry leaves the history or after 6 hours, so an undo restores them. History is per window and cleared when the data set changes.
- **Reminders**: per-task "Reminder" (at start time, 5/10/15/30 min, 1/2 h, 1/2 days before). Tasks without a start time use the default time in Settings. A system notification is sent while toodly is running (tray included); a missed reminder is still delivered within 12 hours. Several windows do not duplicate notifications. Can be turned off in Settings.
- **Today / Next 7 days** are split into *Overdue*, *Today*, *Tomorrow* and later days, each with task count, planned time (from start/end times) and number of untimed tasks.
- **Statistics** (sidebar footer): completed in 7/30 days, open and overdue tasks, average creation→completion time, completed per week (last 8 weeks, chart or table), open tasks per list.
- **Feedback**: a save indicator in the header (*Saving… / Saved / Save error*); if a write fails the data are reloaded and an error toast is shown.
- **Detail panel** in collapsible sections (Organization, Planning, Description, Sub-tasks, Dependencies, Notes, Attachments); their open/closed state is remembered.
- **First start**: short welcome tour (only on an empty data set; relaunchable from Settings → Getting started) and explanatory empty states.
- Concurrency: the DB is opened with `busy_timeout` and column migrations ignore "duplicate column", so two windows starting together do not clash.

## Tags, richer recurrence, shortcuts and appearance

- **Tags**: free labels (`#tag`) orthogonal to lists and groups. In Quick Add and in the add bars `#word` is a list if it matches a list name, otherwise a tag; `+word` is always a tag. Tags are edited in the task details (chips, autocomplete), shown on rows and cards, listed in the sidebar (*Tags*, with open-task counts) where each one is a view (new tasks added there get the tag), searchable (`Ctrl+K`) and usable in filters (*Tag is / is not*). Stored lowercase, space separated, in the `tags` column.
- **Recurrence**: besides daily/weekly/monthly/yearly there are *weekdays* (Mon–Fri), *last day of the month* and *specific days of the week* (e.g. Monday and Thursday), plus an optional **end date** ("Until"). Completing a task creates the next occurrence only if it falls on or before the end date; start date, reminder and sub-tasks shift by the same number of days, so the task keeps its duration.
- **Keyboard**: `↑ / ↓` move between tasks, `Enter` edits the title, `Space` completes/reopens, `?` opens the shortcuts page (also in Settings).
- **Appearance** (Settings): list density (compact / normal / comfortable) and interface size (90–125 %).
- **Gantt, second iteration**: *milestones* (task switch "Milestone": a diamond on the due date, `milestone` in the Mermaid export); *critical path* toggle (the chain of dependencies without slack leading to the latest end date is outlined in red, the rest is dimmed); *late only* filter (overdue tasks and tasks starting before a prerequisite ends, with their parents); **create dependencies by dragging** from the round handle at the right end of a bar onto another bar (the target depends on the source; circular links are refused). Rows are rendered only around the visible area (virtualization) once there are more than ~120 rows.

## Templates, attachments preview, backups and calendar export

- **Templates**: *Save as template* (details panel) stores a task with all its sub-tasks; the *Template* button next to the add bar in the List view creates a new copy (undoable as a single step). Dates are saved as distances from the main task, so they follow the "reference date" you choose. Stored in `localStorage` (`toodly.templates`), hence valid for every data set and included in backups.
- **Attachment preview**: the eye button on an attachment shows images, PDFs (where the web view supports it) and the start of text files inside the details panel (files up to 8 MB).
- **Automatic backup** (Settings → Data): daily or weekly full `.zip` backup (same content as *Export all…*) into a chosen folder while toodly is running; only the latest 3/7/14/30 `toodly-auto-*.zip` files are kept. Settings are per computer (`toodly-internal.*`, not in backups); with several windows only one runs the backup.
- **Calendar export**: *Export .ics…* writes the open tasks with a due date of the current set as iCalendar events (all-day or with start/end time; recurrence → `RRULE`, reminder → `VALARM`, tags → `CATEGORIES`).
- **Accessibility**: Gantt bars and rows are keyboard-focusable (`Enter`/`Space` opens, `Alt+←/→` moves a bar by a day), darker priority colours in the light theme, animations are skipped when the system asks for reduced motion.

## Sidebar width

The vertical line between the sidebar and the main area can be dragged to resize it (180–480 px); double-click resets it to 240 px. The width is stored **per window** (`sidebar` field in `windows.json`, together with position, size and maximized state) and restored when the window reopens; it is included in the layout of the export. Windows without their own value start from the old global preference `toodly.sidebarWidth`, if present.

## Groups and sub-groups

Tree-like folders (table `task_groups`; `tasks.group_id`) independent from lists. In the List view a group is a collapsible header (open/closed state saved locally for each view of each data set, e.g. each list, and restored when it is shown again): sub-groups first, then the tasks of the same level. Create them with the "Group" button (or "New sub-group" on a header), edit/delete them from the editor (when deleting, tasks and sub-groups move up one level), drag tasks and groups onto headers to move them (a "top level" drop zone appears at the bottom while dragging). Also available from the task details (Group field) and the multi-selection bar. A group name is required and unique within the set (case-insensitive). Once created, groups are always shown, even when empty. Each header shows the number of open tasks (sub-groups included), followed by a red badge with the high-priority ones and an orange badge with the medium-priority ones, when there are any.

## Quick actions

In the task details, small icon buttons next to the title change its capitalization (first letter only, Each Word, UPPERCASE, lowercase) or clear it; the title stays required, so leaving it empty restores the previous one.

Settings has a switch that numbers the tasks in the list: a progressive number, in the accent (purple) color, between the checkbox and the title, counted among siblings at the same level (groups are not counted; sub-tasks restart from 1). It is stored locally (`toodly.showNumbers`) and shared by all windows.

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
