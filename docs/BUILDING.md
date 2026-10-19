# Building toodly

## Requirements

- Node.js 20.19+ or 22.12+ (not 21.x: Vite 8 needs them) and npm
- Rust stable (<https://rustup.rs>)
- Windows: Microsoft C++ Build Tools + WebView2 (already present on up-to-date Windows 10/11)
- macOS: Xcode Command Line Tools
- Linux: `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev libssl-dev`

## Development

```bash
npm install
npm run tauri dev      # development with hot reload
```

Other scripts: `npm run check` (svelte-check), `npm run build` (**frontend only** → `build/` folder: it is not the app, Tauri uses it as web content).

## Creating the executable / installer

`npm run tauri build` builds the frontend (`npm run build`), then the Rust backend in release mode, and finally packages the installers **for the operating system you run it on** (Tauri does not cross-compile: to get Windows, macOS and Linux builds you need to build on each one, or use the CI below). The result is not in `build/` but in `src-tauri/target/release/`:

| System | Direct executable | Installers / packages (`src-tauri/target/release/bundle/…`) |
|---|---|---|
| **Windows** | `src-tauri/target/release/toodly.exe` (requires WebView2) | `nsis/toodly_1.3.0_x64-setup.exe`, `msi/toodly_1.3.0_x64_en-US.msi` |
| **macOS** | — | `macos/toodly.app`, `dmg/toodly_1.3.0_<arch>.dmg` |
| **Linux** | `src-tauri/target/release/toodly` | `deb/*.deb`, `rpm/*.rpm`, `appimage/*.AppImage` |

Useful commands:

```bash
npm run tauri build                          # all formats of the current system
npm run tauri build -- --bundles nsis        # Windows: only the .exe installer (no MSI/WiX)
npm run tauri build -- --bundles msi         # Windows: only the MSI
npm run tauri build -- --bundles deb,appimage   # Linux
npm run tauri build -- --bundles dmg         # macOS
npm run tauri build -- --target universal-apple-darwin   # macOS Intel + Apple Silicon
npm run tauri build -- --no-bundle           # only the executable, no installer
```

First build: it needs the prerequisites above and a few minutes to compile the Rust dependencies. The MSI bundle downloads WiX by itself on first use (Windows). Packages are not signed: Windows SmartScreen and macOS Gatekeeper will show a warning until code signing is configured.

## CI for all platforms

`.github/workflows/release.yml` builds Windows, macOS (universal) and Linux on GitHub Actions and attaches the installers as artifacts (manual start from *Actions → Build installer → Run workflow*, or by pushing a `v*` tag).

**Releasing**: move the *Unreleased* items of `CHANGELOG.md` under `## [x.y.z] - date`, bump the version (`package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`), commit, then `git tag vx.y.z && git push --tags`. For a tag the workflow verifies that the tag matches `package.json` and that the changelog has a section for it, runs `npm test`, builds the three platforms and publishes a GitHub release with the installers attached and that changelog section as its description.

## Releasing a new version

The version lives in three places and must be kept aligned: `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`.

## Project structure

See [DEVELOPER.md](DEVELOPER.md) for the repository layout, architecture and where data is stored.
