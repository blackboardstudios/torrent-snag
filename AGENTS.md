# AGENTS.md

## Build System

- **Two build scripts exist with different behavior:**
  - `npm run build` / `node build.js` — uses esbuild to bundle `background.js`, `popup.js`, `options.js` as IIFE, copies remaining assets to `dist/`. Use this for development.
  - `./build.sh` — naive `cp -r src/* dist/` with no bundling. Does not run esbuild. Use only for quick inspection; it skips bundling of entry points.
  - `npm run build:prod` — same as `build.js` but with minification and no sourcemaps.
- Always run `npm run build` before loading the extension in Chrome. The `dist/` folder is the loadable unpacked extension.
- No linting is configured. The `npm run lint` script is a placeholder (`echo`).

## Testing

- Tests use Jest with `jsdom` environment. Run with `npm test` or `npm run test:coverage`.
- Test files live in `tests/` with the pattern `*.test.js`.
- **Tests define their own inline implementations** of constants, hash utilities, and duplicate tracker — they do NOT import from `src/utils/`. This means tests verify logic contracts but will not catch drift between test doubles and actual source code.
- `tests/setup.js` provides a full `chrome` API mock (runtime, storage, tabs, action, notifications, i18n, contextMenus, commands, alarms, windows) plus `crypto.subtle.digest`, `TextEncoder`, `btoa`/`atob`.
- To run a single test: `npx jest tests/hash.test.js` (or any specific file).

## Architecture

- **Manifest V3 Chrome extension**. Entry points: `src/manifest.json`.
- **Content script loading order matters**: `utils/config.js` → `utils/hash.js` → `utils/constants.js` → `content/content-script.js` (defined in manifest `content_scripts[].js` array). These are NOT bundled together for content scripts — they load as separate injected scripts.
- **Background worker** (`src/background/background.js`), **popup** (`src/popup/popup.js`), and **options** (`src/options/options.js`) are bundled via esbuild (IIFE format, targets Chrome 100+).
- **Handler pattern**: `src/handlers/handler-factory.js` creates client handlers by type string (`qbittorrent`, `transmission`, `deluge`, `download`). Each handler is a standalone class (e.g., `QBittorrentHandler`) loaded as a separate script — they are globals on `window`, not ES modules.
- **Config** (`src/utils/config.js`) manages all extension state via `chrome.storage.local`. Uses deep-merge with `DEFAULT_CONFIG` for migration. Built-in patterns/filters are reconciled via `ensureBuiltinItems`.
- **Constants** (`src/utils/constants.js`) defines `MESSAGE_TYPES`, `STORAGE_KEYS`, `HANDLER_TYPES`, `DEFAULTS`. Tests duplicate these inline — update both when adding new constants.
- **10 locales** in `src/_locales/`: `en`, `es`, `fr`, `de`, `ru`, `pt`, `zh_CN`, `it`, `ja`, `tr`.

## Key Quirks

- `src/handlers/handler-factory.js` references handler classes (`QBittorrentHandler`, etc.) as global constructors. These must be loaded as separate script tags before the factory is used. esbuild bundles `background.js`/`popup.js`/`options.js` as IIFE which includes dependencies, but handler files themselves are copied as-is.
- The `html-torrent-downloads` detection pattern was previously too broad and was fixed in 1.1.0. Do not re-add overly generic patterns like generic download URLs.
- `config.js` has backward-compat migration for legacy `handler`/`handlerConfig` top-level keys.
- Built-in patterns and filters cannot be removed via `removePattern`/`removeFilter` (guarded by `p.builtin` check).
- Regex validation includes ReDoS protection (100ms timeout on test string).

## Version & Release

- Current version: `1.1.0` (UNRELEASED per CHANGELOG.md). Version appears in both `package.json` and `src/manifest.json` — update both when bumping.
- CHANGELOG.md has a duplicated header block (lines 1-6 repeated at lines 29-34) — a known artifact.
- No CI/CD workflows exist. No pre-commit hooks.
