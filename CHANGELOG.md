# Changelog

All notable changes to Torrent Snag will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] 2026-07-05

### Changed
- Updated the SwarmOtter native handler to submit batches through `POST /api/v1/torrents/bulk`, including base64 `.torrent` payloads, while preserving per-item result mapping, duplicate handling, and post-add label assignment.

### Fixed
- Prevented failed or partially failed torrent sends from being recorded as sent, removed from review state, hidden from the badge, or reported as full success.
- Preserved failed torrent links for retry while removing only successfully sent links from content-script state.
- Updated popup send behavior to wait for the background result and keep the popup open on partial or complete failure.
- Kept esbuild output for bundled `background`, `popup`, and `options` entry points from being overwritten by the copy pass in `build.js`.
- Added post-build manifest and bundle smoke checks to fail builds when required scripts, pages, icons, or locales are missing.
- Updated context-menu send behavior to avoid showing a success notification when the background send response reports failure.
- Reconciled stored built-in pattern and filter definitions on config load so stale extension-owned fields are updated while user `enabled` state is preserved.
- Replaced popup torrent-row interpolation for untrusted torrent names and URLs with DOM construction using text nodes and attributes.
- Scoped detected-link storage to the actual tab ID when available, with Unicode-safe SHA-256 URL fallback keys.
- Removed stale detected-link storage entries when links are cleared, pages navigate, or tabs close.
- Preserved query strings in non-magnet torrent identity so query-driven download endpoints no longer collapse distinct torrents.
- Prevented content-script scans from running before configuration and storage initialization finish.
- Fixed phase-5 UI/runtime cleanup issues: default pattern/filter enabled state persistence, dead options code paths, popup handler naming, strict context-menu URL validation, duplicate tracking cleanup on install/startup, and dead handler/logger cleanup.

### Added
- Added `REMOVE_DETECTED_LINKS` message handling for removing multiple successfully sent detected links by exact URL.
- Added `GET_TAB_ID` message handling for content scripts to resolve their tab-scoped storage key.
- Added trace logging for popup sends, background handler dispatch, and per-item SwarmOtter submissions, including batch IDs, item indexes, API responses, elapsed times, and final result tables.
- Added source-backed tests for background send outcomes, content-script multi-remove behavior, popup rendering safety, built-in config reconciliation, URL identity, storage cleanup, and initialization timing.
- Added source-backed tests for Phase 5 behaviors including enabled-state preservation, import ID generation, context-menu URL validation, duplicate-tracker lifecycle cleanup, and Deluge JSON-RPC request IDs.
- Added source-backed content-script tests for CONFIG_UPDATED regex cache recompilation and `REMOVE_DETECTED_LINKS` targeted removal semantics, plus options-page coverage that Generic Download testing does not require a server URL.
- Added ESLint with a flat configuration, wired `npm run lint`, and added a GitHub Actions CI workflow running lint, tests, and production build on push/pull_request.
- Added SwarmOtter as a native API handler using `/api/v1` magnet, raw torrent upload, health, and labels endpoints.

## [1.2.0] 2026-05-08

### Added
- Test infrastructure with Jest (hash utilities, constants, content detection, source contracts, and Transmission handler behavior)
- esbuild bundler with dev/prod build modes
- Centralized constants module (`src/utils/constants.js`) for message types, storage keys, and defaults

### Fixed
- Removed duplicate `generateHash` function from background script (now imported from `utils/hash.js`)
- Dynamic handler name in popup send button (previously hardcoded to "qBittorrent")
- Content script memory/storage synchronization issue (added `loadFromStorage()`/`saveToStorage()`)
- Transmission handler no longer requires username/password (auth is optional)
- Removed unused `chrome.alarms` code causing service worker registration failures
- Options page now loads user's saved handler selection on page load
- Fixed torrent detection pattern matching too many URLs (removed overly broad `html-torrent-downloads` pattern)
- Default filters now disabled but available for users to enable if needed
- Fixed regex lastIndex bug in content script detection loop

### Changed
- Replaced magic strings with centralized constants across all scripts
- Updated build script to use esbuild for bundling and minification

## [1.1.0] - 2025-08-01

Initial Release

### Added
- Chrome extension Manifest V3 support for torrent and magnet link detection
- Multi-client support: qBittorrent, Transmission, Deluge, and generic downloads
- Pattern detection with configurable regex for magnets, .torrent files, and HTML redirects
- Smart filtering to skip unwanted torrents with configurable regex filters
- SHA-256 duplicate tracking to prevent re-sending same torrents
- Chunked processing for performance with configurable batch sizes
- Internationalization with 10 languages supported
- Keyboard shortcuts: Ctrl+Shift+T (popup), Ctrl+Shift+S (send all)
- Context menus for right-click torrent sending with optional labels
- Theme support with auto-detect system theme and dark mode override
- Settings import/export with validation
