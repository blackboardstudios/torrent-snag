# Changelog

All notable changes to Torrent Snag will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] 2026-05-08

### Added
- Test infrastructure with Jest (15 passing tests for hash utilities and constants)
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
# Changelog

All notable changes to Torrent Snag will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


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

