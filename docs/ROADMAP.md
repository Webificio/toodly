# toodly — roadmap and known limitations

What is not done yet, what is known to be imperfect, and what could come next. For the checklist of things to try by hand before a release see [MANUAL_TESTS.md](MANUAL_TESTS.md); for what each version contains see the [changelog](../CHANGELOG.md).

## 1. Still to do

- [ ] Run `cargo check` in `src-tauri/`: two commands were written without being compiled — `prune_backups` (`backup.rs`) and `read_attachment` (`attachments.rs`) — plus the notification plugin registration in `lib.rs`.
- [ ] Run the app (`npm run tauri dev`) and go through [MANUAL_TESTS.md](MANUAL_TESTS.md): none of the recent features (including the Graph view) has been exercised inside the real app yet. The frontend is verified only by `npm test`, `npm run check` (svelte-check) and `npm run build`.
- [ ] Add `npm test` and `npm run check` to the GitHub workflow `release.yml`.
- [ ] Commit and push (`_wip` and `*.rar` are already in `.gitignore`).

## 2. Known limitations

### General
- **List virtualization**: only the Gantt renders rows around the visible area; the List does not (drag & drop and variable row heights make it risky to change without being able to try it).
- **Kanban by tag**: tags show on the cards, but there is no column-per-tag grouping.
- **English translations**: every key exists, but they have not been reviewed by a native speaker.
- **Reminders** are checked only for data sets open in a window, and only while toodly is running (tray included).
- **Automatic backup** runs only while the app is running; its settings are per computer (they are not part of the backups).
- Creating a dependency by dragging in the Gantt cannot be undone with `Ctrl+Z`.
- *Last day of the month* recurrence: the first occurrence is the due date you set; from the next one on it is the end of the month.
- **Automated tests** cover pure logic only (dates, quick-add, tags, views/filters, `.ics`, Graph layout). There are none for the database, migrations, import/export, the store or the components.

### Graph view
- No node virtualization: every node is in the DOM, so very large graphs (hundreds of tasks) may be slow.
- The background is a dot grid (no starry sky); zoom and position are remembered only while the app is open, not across restarts.
- The open/closed state of the *No group* node is not saved (real groups share their state with the List and the Gantt).
- Sub-tasks whose parent is not in the current view appear under *No group*, as in the List.
- Dependencies cannot be created from the Graph (use the details panel or the Gantt).
- The plain mouse wheel scrolls the canvas; zoom is `Ctrl` + wheel (or the slider).
- The layout is a single column per level; groups with a very large number of direct children make a tall column.

## 3. Ideas for later

- Kanban grouping by tag.
- List virtualization.
- Tests for migrations and import/export on a temporary SQLite database.
- Graph: node virtualization for large graphs, zoom/position saved across restarts, creating dependencies by dragging between cards, wrapping long columns into several, export as image / SVG, optional starry background in the dark theme.
- Undoable dependency creation in the Gantt.
