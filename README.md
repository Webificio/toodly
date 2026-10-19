<p align="center">
  <img src="docs/logo.png" alt="toodly" width="200">
</p>

<p align="center">
  Toodly is a fast, local-first desktop to-do app, written in Rust, cross-platform (Windows, macOS and Linux), in the spirit of TickTick and Linear.<br>
  Lists, Kanban, calendar with time-blocking, sub-tasks, dependencies, multiple windows and independent data sets.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="Version" src="https://img.shields.io/badge/version-1.3.0-6b3fa0.svg">
  <img alt="Tauri v2" src="https://img.shields.io/badge/Tauri-v2-24C8DB.svg?logo=tauri&logoColor=white">
  <img alt="Svelte 5" src="https://img.shields.io/badge/Svelte-5-FF3E00.svg?logo=svelte&logoColor=white">
  <img alt="Platforms" src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg">
</p>

## One dataset, fourteen views

A to-do list is about the simplest dataset there is: a few dozen rows with a title, a date, a priority, a group and some dependencies. Toodly treats that as an experiment in **data visualization**: how many genuinely different, genuinely *useful* pictures can you draw from the same small table, and which questions does each one answer best?

| Question | View |
| --- | --- |
| What is on my plate, in order? | **List**, **Kanban** |
| What happens when? | **Calendar**, **Gantt**, **Metro** (one line per group, time flowing right) |
| How is it all organised? | **Graph** (groups and tasks as a tree) |
| What is closest to me, right now? | **Orbit** (a radar: today at the centre, one sector per group) |
| What should I do first? | **Matrix** (importance × deadline), **Mosaic** (tiles sized by urgency) |
| Am I overloading myself? | **Ridge** (daily workload as a mountain profile against your capacity) |
| What is coming up the road? | **Road** (perspective toward the horizon, one lane per group) |
| How are my projects doing? | **Grove** (one tree per group: leaves = open, fruits = done, fallen leaves = overdue) |
| Where do I put it in my day? | **Slot** (drag tasks into the free gaps of a day) |
| Can I just arrange them my way? | **Cork** (a draggable cork board of sticky notes) |

All of them are fully interactive rather than static charts: the same add bar, selection (`Ctrl`/`Shift`), keyboard navigation, details panel, hover card with quick actions and *Completed* toggle everywhere; canvas views add pan, zoom and a minimap, and several let you change the data by dragging or with the arrows. The view switcher shows only icons (the name appears for the active view or on hover) so fourteen views stay out of the way. Everything stays local: the views only read and edit your own SQLite data.

## Screenshots

<table>
<tr>
<td width="50%"><a href="docs/screenshots/home-list.jpg"><img src="docs/screenshots/home-list.jpg" alt="Home — List view"></a><br><sub><b>Home — List view</b> — The Today smart view as a list, with overdue and scheduled tasks.</sub></td>
<td width="50%"><a href="docs/screenshots/home-kanban.jpg"><img src="docs/screenshots/home-kanban.jpg" alt="Home — Kanban view"></a><br><sub><b>Home — Kanban view</b> — The Today smart view as a Kanban board, by status.</sub></td>
</tr>
<tr>
<td width="50%"><a href="docs/screenshots/list.jpg"><img src="docs/screenshots/list.jpg" alt="List view"></a><br><sub><b>List view</b> — All tasks as a hierarchical list, with groups, sub-tasks and dependencies.</sub></td>
<td width="50%"><a href="docs/screenshots/kanban.jpg"><img src="docs/screenshots/kanban.jpg" alt="Kanban view"></a><br><sub><b>Kanban view</b> — All tasks on a Kanban board, with blocked tasks highlighted.</sub></td>
</tr>
<tr>
<td width="50%"><a href="docs/screenshots/calendar.jpg"><img src="docs/screenshots/calendar.jpg" alt="Calendar view"></a><br><sub><b>Calendar view</b> — Weekly calendar with time-blocking and a panel of unscheduled tasks.</sub></td>
<td width="50%"><a href="docs/screenshots/gantt.jpg"><img src="docs/screenshots/gantt.jpg" alt="Gantt view"></a><br><sub><b>Gantt view</b> — Timeline of groups and tasks with dependency links.</sub></td>
</tr>
<tr>
<td width="50%"><a href="docs/screenshots/graph-compact.jpg"><img src="docs/screenshots/graph-compact.jpg" alt="Graph view — compact"></a><br><sub><b>Graph view — compact</b> — Groups and tasks as a tree, filtered by a custom filter.</sub></td>
<td width="50%"><a href="docs/screenshots/graph-opened.jpg"><img src="docs/screenshots/graph-opened.jpg" alt="Graph view — expanded"></a><br><sub><b>Graph view — expanded</b> — The whole task tree expanded on the canvas.</sub></td>
</tr>
<tr>
<td width="50%"><a href="docs/screenshots/graph-zoom.jpg"><img src="docs/screenshots/graph-zoom.jpg" alt="Graph view — zoom"></a><br><sub><b>Graph view — zoom</b> — Zoomed-in detail of the Graph canvas.</sub></td>
<td width="50%"><a href="docs/screenshots/orbit.jpg"><img src="docs/screenshots/orbit.jpg" alt="Orbit view"></a><br><sub><b>Orbit view</b> — A radar: today at the centre, time rings, one coloured sector per group.</sub></td>
</tr>
<tr>
<td width="50%"><a href="docs/screenshots/metro.jpg"><img src="docs/screenshots/metro.jpg" alt="Metro view"></a><br><sub><b>Metro view</b> — A subway map: one line per group, one station per task, time flowing right.</sub></td>
<td width="50%"><a href="docs/screenshots/cork.jpg"><img src="docs/screenshots/cork.jpg" alt="Cork view"></a><br><sub><b>Cork view</b> — A cork board of sticky notes you can drag anywhere, with strings for dependencies.</sub></td>
</tr>
<tr>
<td width="50%"><a href="docs/screenshots/road.jpg"><img src="docs/screenshots/road.jpg" alt="Road view"></a><br><sub><b>Road view</b> — A road in perspective, one lane per group, toward the horizon.</sub></td>
<td width="50%"><a href="docs/screenshots/matrix.jpg"><img src="docs/screenshots/matrix.jpg" alt="Matrix view"></a><br><sub><b>Matrix view</b> — Importance by deadline in four quadrants.</sub></td>
</tr>
<tr>
<td width="50%"><a href="docs/screenshots/mosaic.jpg"><img src="docs/screenshots/mosaic.jpg" alt="Mosaic view"></a><br><sub><b>Mosaic view</b> — Tiles sized by priority and deadline proximity.</sub></td>
<td width="50%"><a href="docs/screenshots/grove.jpg"><img src="docs/screenshots/grove.jpg" alt="Grove view"></a><br><sub><b>Grove view</b> — One tree per group: leaves are open tasks, fruits are done, fallen leaves are overdue.</sub></td>
</tr>
<tr>
<td width="50%"><a href="docs/screenshots/ridge.jpg"><img src="docs/screenshots/ridge.jpg" alt="Ridge view"></a><br><sub><b>Ridge view</b> — Daily workload as a mountain profile against your capacity.</sub></td>
<td width="50%"><a href="docs/screenshots/slot.jpg"><img src="docs/screenshots/slot.jpg" alt="Slot view"></a><br><sub><b>Slot view</b> — A day timeline with free slots; drag tasks from the tray into the gaps.</sub></td>
</tr>
<tr>
<td width="50%"><a href="docs/screenshots/settings.jpg"><img src="docs/screenshots/settings.jpg" alt="Settings"></a><br><sub><b>Settings</b> — Appearance (light, dark, system), theme, language, density, interface size, reminders, shortcuts and startup options.</sub></td>
<td width="50%"></td>
</tr>
</table>

> **Status:** early release (1.3.0). toodly is young and has been tested mainly on Windows; bug reports and feedback are very welcome.

## Download

Installers for Windows, macOS and Linux are published on the [Releases](https://github.com/atlantidezign/toodly/releases) page. They are not code-signed yet, so Windows SmartScreen and macOS Gatekeeper may show a warning on first launch.

You can also build them yourself, see [Building](#building).

## Highlights

- **Tasks** with 4 priorities, hierarchical sub-tasks, **dependencies** ("waiting" until prerequisites are done), due date and start/end time, recurrence, drag & drop reordering.
- **Views**: 14 ways to look at the same tasks — List, Kanban (by status or priority), monthly and weekly Calendar with time-blocking, Gantt, Graph, and the experimental data-visualization views described [above](#one-dataset-fourteen-views), plus smart views (*Today*, *Next 7 days*, *Important*, *All*), colored lists, and custom **filters** with AND/OR rules.
- **Themes**: Default, Material, CRT (green phosphor), Nord, Solarized, Dracula, Gruvbox and Rosé Pine, each in light and dark (Settings → Appearance). Adding your own takes one CSS block, see [docs/THEMES.md](docs/THEMES.md).
- **Productivity**: global search (`Ctrl+K`), undo/redo (`Ctrl+Z`), per-task reminders with system notifications, Gantt, Graph, Orbit and Metro views with Mermaid export, estimated durations and a daily capacity (Ridge), statistics.
- **Groups and sub-groups** (folders) independent from lists, multi-selection with bulk edits, bulk creation of tasks from pasted text or Markdown.
- **Rich task details**: Markdown description, multiple notes, file attachments.
- **Multi-window**: every window opens its own **data set**; position, size, sidebar width and view of each window are saved and restored on restart (multi-monitor aware).
- **System tray**, global **Quick Add** shortcut (`Ctrl+Shift+Space`, `Cmd+Shift+Space` on macOS), optional autostart.
- **Backup**: export and import everything as a single versioned `.zip`.
- **Localized UI**: Italian (default) and English, switchable in Settings.
- **Local-first**: all data lives in SQLite files on your machine. No account, no cloud.

The complete feature reference is in [docs/FEATURES.md](docs/FEATURES.md).

## Documentation

| Document | Audience | Content |
|---|---|---|
| [User guide](docs/USER_GUIDE.md) | Users | How to use toodly: tasks, views, windows, data sets, Quick Add, backup, shortcuts |
| [Themes](docs/THEMES.md) | Users and developers | The available themes and how to create or customise one |
| [Features](docs/FEATURES.md) | Users and developers | Detailed reference of every feature and its rules |
| [Changelog](CHANGELOG.md) | Everyone | What changed in each version (also used as GitHub release notes) |
| [Developer guide](docs/DEVELOPER.md) | Developers | Architecture, data model, frontend/backend contract, persistence files, conventions |
| [Building](docs/BUILDING.md) | Developers | Build, installers per OS, CI, releasing |
| [Roadmap](docs/ROADMAP.md) | Developers | What is still to do, known limitations, ideas for later |
| [Manual tests](docs/MANUAL_TESTS.md) | Developers | Checklist of things to try by hand before a release |

## Tech stack

Tauri v2 (Rust) · SvelteKit (SPA/SSG, Svelte 5) · Tailwind CSS v4 · bits-ui (headless components) · Motion One · SQLite (`tauri-plugin-sql`) · system notifications (`tauri-plugin-notification`).

## Getting started

Requirements:

- Node.js 20.19+ or 22.12+ (not 21.x) and npm
- Rust stable (<https://rustup.rs>)
- Windows: Microsoft C++ Build Tools + WebView2 (already present on up-to-date Windows 10/11)
- macOS: Xcode Command Line Tools
- Linux: `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev libssl-dev`

```bash
git clone https://github.com/atlantidezign/toodly.git
cd toodly
npm install
npm run tauri dev      # development with hot reload
```

Other scripts: `npm run check` (svelte-check) and `npm run build` (frontend only → `build/`; it is not the app, Tauri uses it as web content).

## Building

```bash
npm run tauri build
```

This builds the frontend, compiles the Rust backend in release mode and packages the installers **for the operating system you run it on** (Tauri does not cross-compile). Output goes to `src-tauri/target/release/`. A GitHub Actions workflow (`.github/workflows/release.yml`) builds Windows, macOS (universal) and Linux installers.

See [docs/BUILDING.md](docs/BUILDING.md) for per-OS output, useful flags and CI details, and [docs/DEVELOPER.md](docs/DEVELOPER.md) for the architecture and project structure.

## Project status and notes

- On Linux/Wayland, global shortcuts may be unavailable.
- If the global shortcut is already taken by another app, the error is only logged.
- With `--autostart` (used by the autostart option) and no saved windows, the app starts directly in the tray.
- Runtime behavior on Windows (new windows, data set file deletion) has been verified only with browser mocks and `cargo check` / unit tests.

## Contributing

Issues and pull requests are welcome. For bugs, please include your OS, the toodly version (Settings → About) and steps to reproduce. For larger changes, open an issue first to discuss the idea.

Read the [developer guide](docs/DEVELOPER.md) first. When adding user-facing text, do not hardcode it: the UI uses `t('Italian text')` with English translations in `src/lib/en.json`.

## Author

**Alessandro Di Michele** — [atlantide-design.it](https://www.atlantide-design.it) · [info@atlantide-design.it](mailto:info@atlantide-design.it)

## License

Released under the [MIT License](LICENSE) — © 2026 Alessandro Di Michele.
