# Torrent Snag

Chrome Manifest V3 extension for detecting torrent and magnet links on web pages and sending them to a configured torrent handler.

[Chrome Web Store listing](https://chromewebstore.google.com/detail/torrent-snag/ekokhjgmofjdgdoflmegelfibjciobjd) · [Privacy policy](PRIVACY_POLICY.md) · [License](LICENSE)

## Current Status

- Manifest V3 Chrome extension.
- Current package/manifest version: `1.2.0` in [package.json](package.json) and [src/manifest.json](src/manifest.json).
- Next unreleased changes are tracked under `1.3.0` in [CHANGELOG.md](CHANGELOG.md).
- Supports qBittorrent, Transmission, Deluge, SwarmOtter, and generic Chrome download handling.
- Includes 10 locale folders in `src/_locales/`: `de`, `en`, `es`, `fr`, `it`, `ja`, `pt`, `ru`, `tr`, `zh_CN`.
- Includes Jest tests, ESLint, and a GitHub Actions CI workflow for lint, tests, and production build.

## Install

### Chrome Web Store

Install from the [Torrent Snag Chrome Web Store listing](https://chromewebstore.google.com/detail/torrent-snag/ekokhjgmofjdgdoflmegelfibjciobjd).

### Manual Install From Source

```bash
git clone https://github.com/blackboardstudios/torrent-snag.git
cd torrent-snag
npm ci
npm run build
```

Then load the built extension:

1. Open `chrome://extensions/`.
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select the `dist/` directory.

After rebuilding, click **Reload** on the extension card in `chrome://extensions/`, then reload any already-open web pages. Chrome content scripts already injected into a page are not replaced until that page is reloaded.

## Build, Lint, And Test

```bash
npm run lint          # ESLint over src/**/*.js, tests/**/*.js, and build.js
npm test              # Jest tests
npm run test:coverage # Jest coverage
npm run build         # development build into dist/
npm run build:prod    # minified production build into dist/
./build.sh            # wrapper around npm run build, with a basic dist/ check
```

The loadable unpacked extension is `dist/`. The CI workflow in `.github/workflows/ci.yml` runs `npm ci`, `npm run lint`, `npm test -- --runInBand`, and `npm run build:prod`.

## Supported Handlers

### qBittorrent

Uses the qBittorrent Web API.

Recommended setup:

1. In qBittorrent, enable **Web UI**.
2. Confirm the Web UI is reachable in Chrome, for example `http://localhost:8080`.
3. In Torrent Snag options, select qBittorrent.
4. Set URL, username, and password.
5. Use **Test Connection** before sending torrents.

Common failure points:

- Web UI is disabled.
- URL or port is wrong.
- qBittorrent CSRF/CORS settings reject extension requests.
- Firewall or container networking prevents Chrome from reaching the Web UI.

Labels entered in Torrent Snag are sent to qBittorrent as categories.

### Transmission

Uses Transmission RPC.

Recommended setup:

1. In Transmission, enable remote/RPC access.
2. Confirm the RPC endpoint is reachable from the same browser environment.
3. In Torrent Snag options, select Transmission.
4. Use either base URL `http://localhost:9091` or full RPC URL `http://localhost:9091/transmission/rpc`.
5. Enter username/password only if Transmission RPC authentication is enabled.
6. Use **Test Connection** before sending torrents.

If Chrome reports `Failed to fetch`, the extension could not reach Transmission at the configured URL. Try `http://127.0.0.1:9091` instead of `localhost`, verify Transmission is running, and verify remote access is enabled.

### Deluge

Uses Deluge Web UI JSON-RPC.

Recommended setup:

1. Enable Deluge Web UI.
2. Confirm it is reachable in Chrome, for example `http://localhost:8112`.
3. In Torrent Snag options, select Deluge.
4. Set URL and Web UI password.
5. Use **Test Connection** before sending torrents.

### SwarmOtter

Uses the native SwarmOtter REST API under `/api/v1`. Torrent Snag does not use SwarmOtter's Transmission compatibility endpoint.

Recommended setup:

1. Start SwarmOtter and confirm the Web UI/API is reachable in Chrome, for example `http://127.0.0.1:9091`.
2. In Torrent Snag options, select SwarmOtter.
3. Set the SwarmOtter URL. Either `http://127.0.0.1:9091` or `http://127.0.0.1:9091/api/v1` is accepted.
4. If SwarmOtter has `api.require_auth = true`, enter the configured API token. Leave the token blank when SwarmOtter auth is disabled.
5. Optionally set a SwarmOtter download directory override for magnet links.
6. Optionally set a default label.
7. Use **Test Connection** before sending torrents.

Native API behavior:

- Magnet links are sent to `POST /api/v1/torrents/magnet` as `{ magnet, download_dir? }`.
- Direct `.torrent` URLs are fetched by the extension and uploaded as raw bytes to `POST /api/v1/torrents/file`.
- HTML download pages are followed only when they expose a direct `.torrent` link.
- Labels are applied after add with `POST /api/v1/torrents/:hash/labels`.
- Duplicate responses from SwarmOtter are treated as successful duplicate sends when the API error includes the duplicate info hash.
- The optional download directory override applies to magnet adds. Native raw `.torrent` upload currently uses SwarmOtter's configured storage path.

### Generic Download

Uses Chrome's downloads API. No torrent client is required.

- Magnet links are saved as `.magnet` text files.
- Torrent URLs are sent to Chrome downloads directly.

## Usage

1. Browse to a page containing torrent or magnet links.
2. Torrent Snag scans the page and updates the badge count.
3. Click the extension icon to review detected torrents.
4. Send all detected torrents or select specific rows in the review popup.
5. Optionally assign labels/categories before sending.
6. Use right-click context menus on valid magnet or direct `.torrent` links for direct sending.

Keyboard shortcuts:

- `Ctrl+Shift+T` / `Command+Shift+T`: open the review popup.
- `Ctrl+Shift+S` / `Command+Shift+S`: send all detected torrents on the current page.

## Detection And Filtering

Built-in detection covers:

- Magnet links with hex or base32 BTIH hashes.
- Direct `.torrent` URLs.
- Conservative HTML torrent download URL patterns.

Detection is intentionally generic. It does not contain site-specific host logic.

The content script prefers likely page content/detail containers, skips common ad/sidebar/related/recent containers, and falls back to broader page scanning when needed. This reduces false positives on pages that inject unrelated torrent links.

Custom patterns and filters can be managed from the options page. Regex patterns are validated before saving and include a lightweight execution-time check across representative inputs to reduce ReDoS risk. That check is a guardrail, not a formal regex safety proof.

## Duplicate Tracking

Sent torrents are tracked locally to reduce repeated sends.

- Magnet links are keyed by BTIH hash when possible.
- Torrent URLs are keyed by normalized origin, path, and query string; fragments are ignored.
- Duplicate tracking is stored in `chrome.storage.local`.
- Old tracking data is cleaned on extension startup/install and can also be cleaned from the options page.

## Settings Import And Export

The options page supports importing and exporting settings.

Exported settings include:

- Detection patterns.
- Filters.
- Performance settings.
- Theme and language settings.
- Handler configuration.
- Selected handler.

Exports may include handler URLs, usernames, passwords, or API tokens. Treat exported settings files as private.

## Privacy

Torrent Snag stores settings, detected review links, and duplicate tracking locally in Chrome extension storage. The extension does not run its own analytics service and does not send usage data to a project-owned server.

The extension requests broad `http://*/` and `https://*/` host permissions so the content script can scan pages and the background worker can contact local or remote torrent clients configured by the user.

When you send torrents, Torrent Snag transmits the selected torrent or magnet URLs, optional labels/categories, and configured handler credentials only to the selected handler endpoint. Credentials are stored in `chrome.storage.local` as part of handler configuration; they are not application-level encrypted by Torrent Snag.

## Project Structure

```text
.
├── .github/workflows/        # CI workflow
├── build.js                  # esbuild-based extension build
├── build.sh                  # wrapper around npm run build
├── eslint.config.js          # ESLint flat config
├── package.json              # npm scripts and Jest config
├── src/
│   ├── manifest.json         # Chrome Manifest V3 manifest
│   ├── background/           # service worker
│   ├── content/              # content script scanner
│   ├── handlers/             # torrent client handlers
│   ├── options/              # options page
│   ├── popup/                # review popup
│   ├── utils/                # shared utilities
│   ├── _locales/             # Chrome i18n messages
│   └── assets/               # extension icons
├── store-assets/             # Chrome Web Store artwork/screenshots
└── tests/                    # Jest tests
```

## Architecture Notes

- Content scripts are loaded as separate files in the order defined by `src/manifest.json`.
- `background/background.js`, `popup/popup.js`, and `options/options.js` are build entry points bundled by esbuild as IIFEs.
- Handler classes are global constructors loaded as scripts, not ES modules.
- Configuration is merged with defaults on read to support migrations.
- Built-in patterns and filters are reconciled by ID and cannot be removed through normal options UI operations.
- `dist/` is generated build output and is not tracked.

## Troubleshooting

### Badge Shows Torrents But Send Fails

Open the options page and use **Test Connection** for the selected handler. If the selected handler cannot be reached from Chrome, sending will fail even though page detection works.

For local clients:

- Verify the client is running.
- Verify the Web UI/RPC/API feature is enabled.
- Verify the configured URL works in Chrome.
- Try `127.0.0.1` instead of `localhost`.
- Check firewall, VPN, container, or remote desktop networking.

For SwarmOtter specifically, verify the configured URL points to the control-plane API/Web UI port, not a torrent peer port. If `api.require_auth = true`, verify the API token in Torrent Snag matches `api.auth_token`.

### Extension Errors Still Show Old Source

After rebuilding:

1. Reload the extension in `chrome://extensions/`.
2. Reload the web page being scanned.
3. Clear old errors from the extension details page.

Chrome does not replace content scripts already injected into open pages until those pages are reloaded.

### Detection Finds Too Many Links

Use the review popup before sending, and add filters or disable overly broad custom patterns in the options page. Built-in detection is generic and may need tuning for pages that intentionally inject many unrelated links.

### Nothing Is Detected

- Confirm the page contains actual `href` links, not just copied text.
- Click the refresh button in the review popup.
- Check whether custom filters are excluding the links.
- Check the page console for content script errors.

## Development

```bash
npm ci
npm run lint
npm test
npm run build
```

Development loop:

1. Edit files under `src/`.
2. Run focused tests for the changed area.
3. Run `npm run lint` and `npm test`.
4. Run `npm run build` or `./build.sh`.
5. Reload the unpacked extension from `dist/`.
6. Reload any test pages.

When adding constants or behavior covered by tests, remember that some tests use inline doubles rather than importing source modules.

## License

Torrent Snag is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).
