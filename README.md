<p align="center">
  <img src="docs/logo.png" alt="toodly" width="200">
</p>

<p align="center">
  Toodly is a fast, local-first desktop to-do app, written in Rust, in the spirit of TickTick and Linear.<br>
  Lists, Kanban, calendar with time-blocking, sub-tasks, dependencies, multiple windows and independent data sets.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="Version" src="https://img.shields.io/badge/version-1.0.0-6b3fa0.svg">
  <img alt="Tauri v2" src="https://img.shields.io/badge/Tauri-v2-24C8DB.svg?logo=tauri&logoColor=white">
  <img alt="Svelte 5" src="https://img.shields.io/badge/Svelte-5-FF3E00.svg?logo=svelte&logoColor=white">
  <img alt="Platforms" src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg">
</p>

<!--
## Screenshots

Add your images to docs/screenshots/ and uncomment:

| List view | Kanban | Calendar |
|---|---|---|
| ![List](docs/screenshots/list.png) | ![Kanban](docs/screenshots/kanban.png) | ![Calendar](docs/screenshots/calendar.png) |
-->

> **Status:** early release (1.0.0). toodly is young and has been tested mainly on Windows; bug reports and feedback are very welcome.

## Download

Installers for Windows, macOS and Linux are published on the [Releases](https://github.com/atlantidezign/toodly/releases) page. They are not code-signed yet, so Windows SmartScreen and macOS Gatekeeper may show a warning on first launch.

You can also build them yourself, see [Building](#building).

## Highlights

- **Tasks** with 4 priorities, hierarchical sub-tasks, **dependencies** ("waiting" until prerequisites are done), due date and start/end time, recurrence, drag & drop reordering.
- **Views**: List, Kanban (by status or priority), monthly and weekly Calendar with time-blocking, smart views (*Today*, *Next 7 days*, *Important*, *All*), colored lists, and custom **filters** with AND/OR rules.
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
| [Features](docs/FEATURES.md) | Users and developers | Detailed reference of every feature and its rules |
| [Developer guide](docs/DEVELOPER.md) | Developers | Architecture, data model, frontend/backend contract, persistence files, conventions |
| [Building](docs/BUILDING.md) | Developers | Build, installers per OS, CI, releasing |

## Tech stack

Tauri v2 (Rust) · SvelteKit (SPA/SSG, Svelte 5) · Tailwind CSS v4 · bits-ui (headless components) · Motion One · SQLite (`tauri-plugin-sql`).

## Getting started

Requirements:

- Node.js 20+ and npm
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
