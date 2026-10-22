# Changelog

All notable changes to toodly are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

The section of the version being released is used as the text of the GitHub release (see `scripts/release-notes.mjs` and `.github/workflows/release.yml`). To release: move the items from *Unreleased* under a new `## [x.y.z] - YYYY-MM-DD` heading, bump the version everywhere, tag `vx.y.z` and push the tag.

## [Unreleased]

### Fixed
- **Title capitalization**: *Capitalize first letter* now lowercases the rest of the title, so it also works after *Capitalize Each Word* or *ALL CAPS* (it used to leave the other capitals in place).

## [1.3.5] - 2026-10-20

### Added
- **Economy** (Settings → Economy, off by default): estimated money data per task. *Hourly rate*, *expenses* and *revenue* (both net of VAT) and a VAT rate on the revenue; **labour cost** = estimated duration × rate (only when a duration is set); gross revenue, VAT and **margin** are calculated. Each list has its own *currency*, default hourly rate and default VAT rate (22%). Amounts are stored in cents, formatted with the language's number format, and copied to recurring occurrences and templates; the multi-selection bar has an *Economy* button (only filled fields are applied, *Clear* empties them).
- **Group totals**: group rows in the List show the margin of everything inside (sub-groups and sub-tasks included), green or red, with the breakdown in the tooltip; lists with different currencies are never added together.
- **Amounts in the other views** (Settings → Economy → *Where to show amounts*, one switch per view): task chips (margin, or cost when there is no revenue) in List, Kanban, Gantt, Graph, Cork, Road, Mosaic and Slot and in the hover cards of Orbit, Metro, Matrix and Grove; group totals in Gantt, Graph, Orbit, Metro and Road; column totals in Kanban; day totals in the Calendar week view, Ridge and the *Today* / *Next 7 days* sections; net revenue per quadrant in Matrix; a new **Amount** size criterion in Mosaic; margin per list in the sidebar; an *Estimated economy* table in Statistics.
- **Budget view**: revenue, costs and margin by group and by month/week (with *Out of range*, *No date* and *Total* columns), period totals, a bar chart, a Margin/Revenue/Costs switch, a currency switch and **CSV export**. Amounts count on the task's due date.

### Changed
- **Estimated duration** is now a free field instead of a drop-down: type the **hours** (half an hour is `.5`, so `0.5`, `1.5`, `8`, `12`; dot or comma), arrows `↑`/`↓` change it by half an hour, empty means the default (30 minutes, or the time range when set). Values are rounded to the nearest half hour (minimum 0.5 h). Next to the field a localized reading shows what you typed in months, weeks, days, hours and minutes (e.g. `12` → *1 day and 4 h*), counting 1 day = 8 h, 1 week = 5 days, 1 month = 20 days. The same field replaces the drop-downs in the Slot tray and the Ridge day list. The same field is also in the multi-selection bar (*Duration*, with a *Default* button to reset) and templates now remember the estimated duration of the task and its sub-tasks (older templates keep the default). Stored values (minutes) are unchanged, no migration.

## [1.3.0] - 2026-10-19

### Added
- **Orbit view**: a radar of your tasks. *Today* sits at the centre, the rings are time bands (overdue, today, within 7 days, within 30 days, later, no date) and each group is a sector in its own colour: the closer to the centre, the more urgent. Dependencies are dashed arcs (red when late).
- **Metro view**: a subway map. One line per group, one station per task, time flowing left to right with a *today* marker; same-day tasks fan out above and below the line and dependencies are the interchanges between lines.
  Both views share the Graph interactions: same add bar, click to select and open the details panel, `Ctrl`/`Shift` multi-select, `↑`/`↓`, hover card with checkbox and quick actions, drag the background to pan, `Ctrl` + wheel / slider zoom, minimap, remembered position per set and a *Completed* toggle.
- **Orbit and Metro**: *Mermaid* export and copy buttons in the top-right toolbar, like Gantt and Graph. Metro exports a `flowchart LR` (one `subgraph` per line, stations chained by date, dependencies dashed, `done`/`doing`/`crit`/`late` classes); Orbit exports a `mindmap` (group → time band → tasks, nearest due date first; dependencies are not representable in a mindmap).
- **New views** (all with the Graph interactions: add bar, click / `Ctrl` / `Shift` selection, `↑`/`↓`, details panel, hover card with checkbox and quick actions, *Completed* toggle):
  - **Cork**: a cork board of sticky notes grouped by group. Drag the notes anywhere (the position is saved; several selected notes move together), strings for dependencies (red when late), *Rearrange* puts everything back by group.
  - **Road**: a road in perspective, one lane per group, time running to the horizon (1 week to 3 months). The wheel moves along the road, overdue tasks are in the foreground, tasks without a date or beyond the horizon sit in a side rail. Hover cards have ◀ ▶ to move the due date.
  - **Matrix**: importance (priority) by urgency (deadline) in four quadrants: *Do now*, *To plan*, *To squeeze in*, *Later*.
  - **Mosaic**: a tile grid (treemap) sized by priority, deadline proximity or both.
  - **Ridge**: the workload of the next 7 / 14 / 28 days as a mountain profile against a daily capacity (default 6 h, adjustable); peaks over capacity turn red. Click a day to see its tasks, shift them with ◀ ▶ and change their duration.
  - **Grove**: one tree per group; leaves are open tasks (colour = deadline proximity, size = priority), fruits are completed tasks and overdue tasks fall to the ground.
  - **Slot**: the day as a timeline (08:00–19:00 work hours highlighted as free slots). Tasks with a date and time are blocks you can drag (15-minute snap), resize from the bottom edge, nudge with ▲ ▼ or take off the schedule; tasks without a time wait in the *To schedule* tray (of the day, overdue, undated) and are dragged into a free slot or placed in the first one that fits with →, using their estimated duration.
- **Estimated duration** per task (Planning section of the details; default 30 minutes, or the time range when set), used by Ridge and Slot.
- **View switcher**: only the icon is always visible; the name shows for the active view or on hover.
- **Themes**: a new *Theme* setting (Settings → Appearance) combines with Light / Dark / System. *Default* is the classic look; *Material* (Material Design 3: tonal surfaces, pill buttons, large radii, elevation), *CRT* (green phosphors on black, system monospace font, glow, scanlines; always dark), and the palette themes *Nord*, *Solarized*, *Dracula*, *Gruvbox* (hard shadows, retro) and *Rosé Pine*, each with a light and a dark variant and its own shapes. The Graph group colours follow the theme. The font never changes (CRT uses the generic system `monospace`). New guide: [docs/THEMES.md](docs/THEMES.md) on creating and customising themes.
- **Graph view**: *Mermaid* export, like the Gantt. The button in the top-right toolbar saves a Markdown file with a ```` ```mermaid flowchart ```` diagram (groups and sub-groups as subgraphs, sub-task and dependency arrows), and the copy button puts it on the clipboard.

## [1.2.0] - 2026-10-18

### Added
- **Graph view**: groups, sub-groups, tasks and sub-tasks drawn as a tree on a pannable canvas. Same add bar as the List (task, template, group), same colours (priority, overdue, blocked), same quick actions, details panel, selection, drag & drop (reorder, move into a group, out of the groups) and live numbering. Groups use a rotating palette of 20 blue/violet tints (separate tones for the light and dark theme), collapse like in the List and the Gantt, and dependency arrows are drawn as in the Gantt. Drag the background to move around, `Ctrl` + wheel or the slider to zoom, minimap with the current view box.
- **Global search** (`Ctrl+K`) over titles, descriptions and tags, with list and priority filters.
- **Undo / redo** (`Ctrl+Z`, `Ctrl+Y`) for edits, completion, moves and deletions (also bulk), with an "Undo" notice after deleting.
- **Reminders** per task with system notifications (tray included), default time for tasks without a start time.
- **Today / Next 7 days** split into Overdue / Today / Tomorrow with task count and planned time.
- **Statistics** dialog (completed per week, overdue, average closing time, open tasks per list).
- **Gantt view**: zoom, drag and resize, dependency arrows, group summary bars, milestones, critical path, "late only" filter, dependencies created by dragging between bars, per-task "show in Gantt", Mermaid export (`.md` file or clipboard), row virtualization.
- **Start date** for tasks (defaults to the creation day).
- **Tags** (`#tag` / `+tag` in Quick Add, chips in the details, sidebar views, filter rule, search).
- **Richer recurrence**: weekdays, last day of the month, chosen days of the week, end date.
- **Task templates** (save a task with its sub-tasks, create new ones from it).
- **Attachment preview** (images, PDF, text).
- **Automatic backup** to a chosen folder (daily/weekly, keep the last N) and **`.ics` export**.
- **Keyboard**: arrows / Enter / Space in the list, shortcuts page (`?`); list density and interface size settings.
- First-start tour, explanatory empty states, save indicator, collapsible sections in the details panel.
- Automated tests (`npm test`).

### Changed
- Darker priority colours in the light theme; animations are skipped when the system asks for reduced motion.
- The details panel groups fields into Organization / Planning / content sections.

### Fixed
- Two windows opening the same data set no longer clash while migrating the database.
- "Days of the week" recurrence with an empty rule no longer behaves as Sunday.
- Full backups (ZIP export) wrote `format` instead of `formatVersion` in the manifest, so toodly rejected its own exports on import; the manifest now carries `formatVersion` 1.

## [1.0.1] - 2026-10-12

### Added
- Group counts in the list, with high-priority (red) and medium-priority (orange) badges.
- Title-case / upper / lower / clear buttons next to the task title in the details panel.
- Collapsed groups are remembered per list and per data set.
- Setting to show a progressive number for the tasks of each level.
- The current version is shown in the About dialog.

## [1.0.0]

### Added
- First public version: tasks, sub-tasks, dependencies, lists, groups, filters, List / Kanban / Calendar views, multi-window data sets, tray, Quick Add, backup and restore, Italian and English UI.

[Unreleased]: https://github.com/atlantidezign/toodly/compare/v1.3.5...HEAD
[1.3.5]: https://github.com/atlantidezign/toodly/compare/v1.3.0...v1.3.5
[1.3.0]: https://github.com/atlantidezign/toodly/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/atlantidezign/toodly/compare/v1.0.1...v1.2.0
[1.0.1]: https://github.com/atlantidezign/toodly/releases/tag/v1.0.1
[1.0.0]: https://github.com/atlantidezign/toodly/releases/tag/v1.0.0
