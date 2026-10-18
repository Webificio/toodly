# toodly — manual test checklist

Things to try by hand in the real app (`npm run tauri dev`, or an installer build) before a release. Automated checks first:

- [ ] `npm install`
- [ ] `npm test` (vitest, logic only)
- [ ] `npm run check` (svelte-check)
- [ ] `npm run build`
- [ ] `cd src-tauri && cargo check`

Known gaps and future work are in [ROADMAP.md](ROADMAP.md).

## Data and windows
- [ ] Migration of an existing data set (new columns: `tags`, `recur_until`, `milestone`, `remind_min`, `start_date`, `in_gantt`, `group_id`).
- [ ] Two windows opening the same database at once (`busy_timeout`, concurrent `ALTER`s).
- [ ] Backup (*Data*): automatic backup folder, *Run now*, pruning of old `toodly-auto-*.zip`; restore; `.ics` export opened in a calendar.

## Editing
- [ ] Undo / redo (`Ctrl+Z`, `Ctrl+Y`): delete a task with attachments, undo, redo.
- [ ] Templates: save from a task with sub-tasks, use with another date, undo.
- [ ] Tags: `#tag` / `+tag` in Quick Add, tag view, tag filter.
- [ ] Recurrence: weekdays, last day of the month, chosen days, *Until*.
- [ ] Attachment preview (image, PDF, text); PDF may not work on Linux/webkit.

## Reminders and smart views
- [ ] Reminders and system notifications (also from the tray, also with several windows: no duplicates).
- [ ] *Today* / *Next 7 days* in sections; statistics; first-start tour (only with an empty data set).

## Appearance
- [ ] Density and interface size; shortcuts page (`?`); ↑ ↓ Enter Space in the list.
- [ ] Light theme: darker priority colours (red/orange/blue) look right.

## Gantt
- [ ] Milestones, critical path, *Late only*.
- [ ] Dependency by dragging from the round handle; keyboard (`Enter`, `Alt+←/→`).
- [ ] Many tasks (row virtualization above 120 rows).

## Graph
- [ ] Top bar (task, *Template*, *Group*) behaves like the List; hover on a group: *add task* (input row below the group, `Esc` cancels), *new sub-group*, *edit*.
- [ ] Move around by dragging the background; zoom with `Ctrl` + wheel, the slider and the arrows beside the minimap (the dash fits everything); the plain wheel scrolls.
- [ ] Minimap: shows the whole graph and the box of the current view; click to jump, drag the box.
- [ ] Group colours in light and dark theme (20 blue/violet tints, rotating on top-level groups; sub-groups, tasks and connectors inherit). Check the contrast of the white text on group nodes in the light theme.
- [ ] Task cards: priority-coloured checkbox, red date when overdue, dashed outline when blocked, completed dimmed, numbering (setting), sub-task counter, chevron to fold sub-tasks, quick actions on hover.
- [ ] Click opens the details panel; `Ctrl` / `Shift` + click selects several (bulk bar); ↑ / ↓ change task and the view scrolls to it; `Space` completes.
- [ ] Drag & drop: card above/below another (reorder, also among sub-tasks), card onto a group (move), group onto a group (nest), bottom strip (out of all groups); auto-scroll at the edges; `Ctrl+Z` undoes.
- [ ] Groups fold/unfold (state shared with the List and the Gantt); *Collapse all* / *Expand all*; *Completed* shows/hides finished tasks.
- [ ] Dependency arrows (dashed, red when late); the *No group* node appears only when there are ungrouped tasks.
- [ ] Hundreds of tasks: smoothness; switch view and come back (zoom and position are kept while the app is open).
