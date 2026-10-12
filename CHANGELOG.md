# Changelog

All notable changes to toodly are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

The section of the version being released is used as the text of the GitHub release (see `scripts/release-notes.mjs` and `.github/workflows/release.yml`). To release: move the items from *Unreleased* under a new `## [x.y.z] - YYYY-MM-DD` heading, bump the version everywhere, tag `vx.y.z` and push the tag.

## [Unreleased]

## [1.1.0] - 2026-10-12

### Added
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

[Unreleased]: https://github.com/atlantidezign/toodly/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/atlantidezign/toodly/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/atlantidezign/toodly/releases/tag/v1.0.1
[1.0.0]: https://github.com/atlantidezign/toodly/releases/tag/v1.0.0
