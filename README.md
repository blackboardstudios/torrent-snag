# Torrent Snag

<div align="center">

![Torrent Snag Logo](src/assets/icons/logo.png)

</div>

**A powerful Chrome extension for seamless torrent management**

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Coming%20Soon-lightgrey?style=for-the-badge&logo=googlechrome)](https://chrome.google.com/webstore)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=for-the-badge)](https://www.gnu.org/licenses/gpl-3.0.html)
[![GitHub release](https://img.shields.io/github/release/yourusername/torrentsnag.svg?style=for-the-badge)](https://github.com/yourusername/torrentsnag/releases)
[![GitHub stars](https://img.shields.io/github/stars/yourusername/torrentsnag.svg?style=for-the-badge)](https://github.com/yourusername/torrentsnag/stargazers)

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue?style=flat-square&logo=googlechrome)](https://developer.chrome.com/docs/extensions/mv3/)
[![Multi-Client](https://img.shields.io/badge/Clients-qBittorrent%20%7C%20Transmission%20%7C%20Deluge-green?style=flat-square)](https://github.com/yourusername/torrentsnag#-multi-client-support)
[![Languages](https://img.shields.io/badge/Languages-10%20Supported-orange?style=flat-square)](https://github.com/yourusername/torrentsnag#internationalization)
[![GitHub issues](https://img.shields.io/github/issues/yourusername/torrentsnag.svg?style=flat-square)](https://github.com/yourusername/torrentsnag/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/yourusername/torrentsnag.svg?style=flat-square)](https://github.com/yourusername/torrentsnag/pulls)
[![Ko-fi](https://img.shields.io/badge/support_me_on_ko--fi-F16061?style=flat-square&logo=kofi&logoColor=f5f5f5)](https://ko-fi.com/sphildreth)


---

## 🚀 Overview

Torrent Snag automatically detects torrent and magnet links on web pages and sends them to your preferred torrent client or downloads them directly. Built with modern standards and comprehensive configuration options for power users.

### ✨ Key Highlights

- 🎯 **Multi-Client Support** - Works with qBittorrent, Transmission, Deluge, and direct downloads
- 🔍 **Smart Detection** - Advanced pattern recognition with custom site support  
- 🌍 **Global Ready** - 10 languages supported with full internationalization
- ⚡ **High Performance** - Optimized for large pages with configurable limits
- 🔒 **Privacy First** - All data stored locally, no tracking or telemetry

<details>
<summary><strong>📸 Screenshots & Demo</strong></summary>

> 🚧 Screenshots coming soon - extension in active development

</details>

## 🎯 Features

<table>
<tr>
<td width="50%">

### 🔌 **Multi-Client Support**
- **qBittorrent** - Full API integration with authentication
- **Transmission** - Complete RPC protocol support  
- **Deluge** - Web UI integration with label support
- **Generic Download** - Direct file downloads

### 🚀 **User Experience**
- **One-Click Download** - Send all detected torrents instantly
- **Review Interface** - Popup to selectively send torrents
- **Smart Badge** - Real-time count of new torrents found
- **Context Menu** - Right-click any torrent link to send
- **Keyboard Shortcuts** - `Ctrl+Shift+T`, `Ctrl+Shift+S`

</td>
<td width="50%">

### 🔍 **Intelligent Detection**
- **Smart Pattern Recognition** - Advanced regex patterns
- **HTML Redirect Handling** - Follows download redirects  
- **Custom Pattern Support** - Add site-specific detection
- **Built-in Site Support** - Pre-configured patterns

### ⚙️ **Performance & Customization**
- **Performance Controls** - Configurable scan limits
- **Memory Management** - Automatic cleanup of tracking data
- **Theme Support** - Dark mode with system detection
- **Internationalization** - 10 languages supported

</td>
</tr>
</table>

### 🔄 **Advanced Management**
- **Duplicate Prevention** - Intelligent tracking prevents re-sending torrents
- **Label/Category Support** - Organize torrents with automatic labeling  
- **Batch Processing** - Handle multiple torrents efficiently with chunked processing
- **Filter System** - Skip unwanted torrents using customizable regex patterns

### 🛡️ **Modern Architecture** 
- **Manifest V3** - Latest Chrome extension standards
- **Security** - Encrypted credential storage and secure API communication
- **Settings Management** - Complete import/export functionality
- **Error Handling** - Comprehensive reporting with troubleshooting guidance

## ⚡ Quick Start

> **Want to jump right in?** Follow these steps to get Torrent Snag running in under 5 minutes.

<details>
<summary><strong>📦 Installation Options</strong></summary>

### From Chrome Web Store
> 🚧 **Coming Soon** - Extension pending Chrome Web Store approval

### Manual Installation (Recommended for now)
```bash
# Clone the repository
git clone https://github.com/yourusername/torrentsnag.git
cd torrentsnag

# Build the extension  
./build.sh

# Load in Chrome
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" → select dist/ folder
```

</details>

### 🔧 Client Setup

Choose your preferred torrent client and follow the setup guide:

<details>
<summary><strong>qBittorrent Setup</strong></summary>

1. **Enable Web UI**
   - qBittorrent → Tools → Options → Web UI
   - ✅ Check "Enable the Web User Interface (Remote control)"
   - Set port (default: 8080) and create credentials

2. **Configure Extension**
   - Open extension options
   - URL: `http://localhost:8080`
   - Enter your username/password
   - Click "Test Connection"

</details>

<details>
<summary><strong>Transmission Setup</strong></summary>

1. **Enable RPC**
   - Transmission → Edit → Preferences → Remote
   - ✅ Enable "Allow remote access"
   - Set port (default: 9091) and optional authentication

2. **Configure Extension**
   - URL: `http://localhost:9091`
   - Enter credentials if required

</details>

<details>
<summary><strong>Deluge Setup</strong></summary>

1. **Enable Web UI**
   - Deluge → Preferences → Interface
   - ✅ Enable Web UI and set password

2. **Configure Extension**
   - URL: `http://localhost:8112`
   - Enter web UI password

</details>

<details>
<summary><strong>Generic Download</strong></summary>

**No setup required!** Downloads .torrent and .magnet files directly to your default download folder.

</details>

## 📖 Usage Guide

### Basic Workflow
1. **Browse torrent sites** - Extension automatically scans for torrent/magnet links
2. **Check the badge** - Number appears on extension icon showing new torrents found  
3. **Send torrents** using one of these methods:

| Method | Action | Description |
|--------|--------|-------------|
| 🖱️ **Click Extension Icon** | Send all detected torrents | Quick batch sending |
| 📋 **Review Popup** | Selective torrent sending | Choose specific torrents |  
| 🖱️ **Right-click Links** | Send individual torrents | With optional labels |

### ⌨️ Keyboard Shortcuts
- `Ctrl+Shift+T` (`Cmd+Shift+T` on Mac) - Open torrent review popup
- `Ctrl+Shift+S` (`Cmd+Shift+S` on Mac) - Send all detected torrents

<details>
<summary><strong>🔍 Detection & Filtering</strong></summary>

### Built-in Detection Patterns
- **Magnet Links** - `magnet:?xt=urn:btih:[hash]` format detection
- **Direct Torrent Files** - `.torrent` file downloads  
- **HTML Download Pages** - Redirects and download pages
- **Custom Patterns** - Add site-specific detection rules

### Smart Filtering System
Skip unwanted content with built-in and custom filters:

#### Default Filters
```regex
\b(greatest|hits)\b        # Skip compilation albums
\b(live|concert)\b         # Skip live recordings  
```

#### Custom Filter Examples
```regex
\b(country|folk)\b          # Skip specific genres
\b(flac|m4a)\b             # Skip certain audio formats
\b(128kbps|low.quality)\b  # Skip low quality releases
```

</details>

## ⚙️ Advanced Configuration

<details>
<summary><strong>🚀 Performance Tuning</strong></summary>

Optimize the extension for your system and usage patterns:

| Setting | Default | Description |
|---------|---------|-------------|
| **Max Links Per Scan** | 1000 | Limit scanning to prevent performance issues |
| **Processing Chunk Size** | 100 | Links processed simultaneously |
| **Scan Delay** | 500ms | Debounce delay after page changes |
| **Duplicate Tracking** | 10,000 | Auto cleanup of old tracking data |

</details>

<details>
<summary><strong>🏷️ Label & Category Management</strong></summary>

- **Auto-organize** torrents with labels or categories
- **Client Support**: qBittorrent (categories), Transmission/Deluge (labels)  
- **Quick Labels**: Right-click context menu for instant labeling

</details>

<details>
<summary><strong>🌍 Internationalization</strong></summary>

**Supported Languages:**
English • Spanish • French • German • Russian • Portuguese • Chinese (Simplified) • Italian • Japanese • Turkish

Language settings apply to all UI elements and persist across sessions.

</details>

<details>
<summary><strong>📤 Settings Import/Export</strong></summary>

### Export Settings
Create shareable configuration files containing:
- ✅ Custom detection patterns and filters
- ✅ Performance settings and theme preferences
- ✅ Language and interface preferences
- ❌ Client credentials (excluded for security)

### Configuration Sharing Use Cases
- **Development Teams** - Share optimized patterns for specific sites
- **Power Users** - Curated filter sets for different content
- **Multi-Device** - Sync settings across computers
- **Community** - Performance optimizations for different specs

</details>

## 🔧 Troubleshooting

<details>
<summary><strong>🔗 Connection Issues</strong></summary>

### qBittorrent Problems

**CORS/Authentication Errors** (Most Common):

| Solution | Security Level | Steps |
|----------|---------------|-------|
| **Disable CSRF** | ⚠️ Low | qBittorrent → Web UI → Uncheck "CSRF protection" |
| **IP Whitelist** | ✅ Medium | Enable + Add your network range (e.g., `192.168.0.0/16`) |
| **Localhost Bypass** | ✅ High | Check "Bypass authentication for localhost" |

**Connection Failed**:
- ✅ Verify Web UI accessible in browser at configured URL
- ✅ Check Web UI enabled in qBittorrent settings  
- ✅ Confirm firewall isn't blocking connection
- ✅ Try default credentials ("admin" + blank password)

### Other Clients

**Transmission**: Ensure RPC enabled, correct port (9091), matching auth settings  
**Deluge**: Confirm Web UI enabled, password matches, daemon running

</details>

<details>
<summary><strong>🐛 Extension Issues</strong></summary>

### Torrents Not Being Added
**Check Client Logs** - Look for rejected torrents:
- Invalid magnet links silently rejected
- Duplicate torrents often ignored  
- Blocked trackers in client settings

**Extension Debug Logs**:
1. Go to `chrome://extensions/` → Torrent Snag → "service worker"
2. Check console for detailed per-torrent results
3. Each attempt shows success/failure with specific errors

### Performance Issues
- **Large Pages**: Extension processes links in chunks to prevent blocking
- **Memory**: Auto cleanup removes old duplicate tracking data
- **Settings**: Reduce "Max Links Per Scan" for slower systems

### Badge Not Updating
- Ensure content scripts loading (check console errors)
- Verify page URL not blocked by browser security
- Try refreshing page or disable/re-enable extension

</details>

<details>
<summary><strong>🌐 CORS Issues</strong></summary>

Chrome extensions have CORS restrictions when communicating with local clients.

**qBittorrent**: Disable CSRF protection (most reliable) or setup reverse proxy  
**Others**: Transmission/Deluge typically have fewer CORS issues

</details>

## 🏗️ Technical Architecture

<details>
<summary><strong>📁 Project Structure</strong></summary>

```
torrentsnag/
├── 📁 src/
│   ├── 📄 manifest.json         # Extension manifest (V3)
│   ├── 📁 background/           # Service worker & core logic  
│   ├── 📁 content/              # Page scanning & detection
│   ├── 📁 popup/                # Review interface
│   ├── 📁 options/              # Configuration interface
│   ├── 📁 handlers/             # Client-specific APIs
│   │   ├── qbittorrent-handler.js
│   │   ├── transmission-handler.js  
│   │   ├── deluge-handler.js
│   │   └── generic-download-handler.js
│   ├── 📁 utils/                # Shared utilities
│   ├── 📁 _locales/            # Internationalization
│   └── 📁 assets/              # Icons & resources
├── 📁 dist/                    # Built extension
├── 📁 docs/                   # Documentation
└── 🔧 build.sh               # Build script
```

</details>

<details>
<summary><strong>⚡ Performance Optimizations</strong></summary>

| Feature | Implementation | Benefit |
|---------|---------------|---------|
| **Chunked Processing** | Links processed in batches (default: 100) | Prevents UI blocking |
| **Debounced Scanning** | 500ms delay after page changes | Reduces excessive scans |
| **Memory Management** | Auto cleanup (10k entry limit) | Prevents memory leaks |
| **Lazy Loading** | On-demand configuration loading | Faster startup |
| **Storage Optimization** | Compressed duplicate hashes | Efficient storage use |

</details>

<details>
<summary><strong>🔒 Security Features</strong></summary>

- **🔐 Encrypted Storage** - Chrome automatically encrypts stored credentials
- **🌐 CORS Handling** - Proper cross-origin request management  
- **✅ Input Validation** - Regex patterns validated before use
- **🔄 Session Management** - Auto re-authentication on expiry
- **🛡️ Error Isolation** - Client errors don't affect extension stability

</details>

### 🛠️ Tech Stack
- **Manifest V3** - Latest Chrome extension standards
- **Chrome APIs** - Storage, contextMenus, action, notifications, downloads
- **Internationalization** - Chrome i18n API with 10 language support
- **Modern JavaScript** - ES6+ with async/await patterns
- **HTTP APIs** - REST integration with multiple torrent clients

## Privacy & Security

- **Local Storage**: All data stored locally in your browser - nothing transmitted to external servers
- **No Tracking**: Extension doesn't collect, transmit, or analyze user data
- **Secure Credentials**: Client passwords encrypted by Chrome's secure storage API
- **Session Management**: Automatic re-authentication on session expiry with secure token handling
- **Input Validation**: All user configurations validated to prevent security vulnerabilities
- **Isolated Execution**: Content scripts run in isolated contexts to prevent page interference

## Development & Building

### Prerequisites
- Git for repository management
- Basic understanding of Chrome extension development
- Access to torrent client for testing

### Building from Source
```bash
# Clone the repository  
git clone https://github.com/yourusername/torrentsnag.git
cd torrentsnag

# Build the extension
./build.sh

# Load dist/ folder in Chrome developer mode
```

### Development Workflow
1. **Edit source files** in `src/` directory
2. **Run build script** to compile to `dist/`
3. **Reload extension** in Chrome extensions page
4. **Test functionality** with target torrent sites
5. **Check console logs** for debugging information

### Contributing Guidelines
1. **Fork** the repository and create a feature branch
2. **Follow existing code style** and patterns
3. **Test thoroughly** with multiple torrent clients  
4. **Update documentation** for new features
5. **Submit pull request** with detailed description

### Testing Checklist
- [ ] Test with multiple torrent clients (qBittorrent, Transmission, Deluge)
- [ ] Verify pattern detection on various torrent sites
- [ ] Test performance with large pages (1000+ links)
- [ ] Confirm settings import/export functionality
- [ ] Validate internationalization with different languages
- [ ] Check error handling with invalid configurations

## 🚀 Roadmap

<details>
<summary><strong>📅 Short Term (v1.1)</strong></summary>

- [ ] **Chrome Web Store Publication** - Official distribution channel
- [ ] **Enhanced Label System** - Custom label templates and auto-assignment rules  
- [ ] **Site-Specific Patterns** - Pre-configured detection patterns for popular torrent sites
- [ ] **Notification Customization** - Configurable success/error notification preferences
- [ ] **Connection Health Monitoring** - Real-time client connection status indicators

</details>

<details>
<summary><strong>📅 Medium Term (v1.2-1.5)</strong></summary>

- [ ] **Firefox Support** - Port to Firefox with WebExtensions API
- [ ] **Rutorrent Integration** - Support for popular web-based torrent client
- [ ] **RSS Feed Monitoring** - Automatic torrent detection from RSS feeds
- [ ] **Advanced Filtering** - Content-aware filters (file size, seeders, type detection)
- [ ] **Torrent Preview** - Quick torrent info display before sending
- [ ] **Batch Operations** - Multi-client sending and advanced queue management

</details>

<details>
<summary><strong>📅 Long Term (v2.0+)</strong></summary>

- [ ] **Native Messaging** - Direct communication with desktop torrent clients
- [ ] **Cloud Integration** - Sync settings across devices via cloud storage
- [ ] **Smart Categorization** - AI-powered automatic content categorization
- [ ] **Integration Hub** - Connect with media management tools (Sonarr, Radarr)
- [ ] **Mobile Companion** - Remote control via mobile app
- [ ] **Statistics Dashboard** - Detailed usage analytics and insights

</details>

<details>
<summary><strong>💡 Community Requests</strong></summary>

Vote on features by creating/upvoting GitHub issues!

- [ ] **Usenet Integration** - NZB file detection and handling
- [ ] **Streaming Integration** - Direct integration with media streaming setup
- [ ] **Scheduler** - Time-based torrent sending for bandwidth management
- [ ] **Torrent Health Checking** - Verify seeders/leechers before sending
- [ ] **Custom Actions** - User-defined post-download actions and scripts

</details>

---

## 📝 Changelog

### Version 1.0.0 (Current)
- ✅ Multi-client support (qBittorrent, Transmission, Deluge, Generic Download)
- ✅ Intelligent link detection with custom patterns
- ✅ Advanced filtering system with regex support
- ✅ Complete internationalization (10 languages)
- ✅ Settings import/export functionality
- ✅ Performance optimization with configurable limits
- ✅ Context menu integration
- ✅ Keyboard shortcuts support
- ✅ Duplicate prevention system
- ✅ Dark mode and theme support

## 🤝 Contributing & Support

<div align="center">

**Help make Torrent Snag even better!**

[![Contribute](https://img.shields.io/badge/Contribute-Welcome-brightgreen?style=for-the-badge)](CONTRIBUTING.md)
[![Issues](https://img.shields.io/github/issues/yourusername/torrentsnag?style=for-the-badge)](https://github.com/yourusername/torrentsnag/issues)
[![Discussions](https://img.shields.io/badge/Discussions-Join%20Us-blue?style=for-the-badge)](https://github.com/yourusername/torrentsnag/discussions)

</div>

### 🆘 Getting Help

| Type | Where | Description |
|------|-------|-------------|
| 📖 **Documentation** | This README | Setup guides and troubleshooting |
| 🐛 **Bug Reports** | [GitHub Issues](https://github.com/yourusername/torrentsnag/issues) | Report problems and errors |
| 💡 **Feature Requests** | [GitHub Issues](https://github.com/yourusername/torrentsnag/issues) | Suggest improvements |
| � **General Discussion** | [GitHub Discussions](https://github.com/yourusername/torrentsnag/discussions) | Questions and community chat |
| 📄 **Technical Details** | [PRD.md](docs/PRD.md) | Implementation specifics |

### 🌍 Contributing to Translation

**Help make Torrent Snag accessible worldwide!**

<details>
<summary><strong>Add a New Language</strong></summary>

1. **Check existing translations** in `src/_locales/`
2. **Create new language folder** with `messages.json`
3. **Translate all message keys** from English template
4. **Test translation** in extension interface
5. **Submit pull request** with new language support

**Currently supported:** English, Spanish, French, German, Russian, Portuguese, Chinese (Simplified), Italian, Japanese, Turkish

</details>

### 💻 Development

<details>
<summary><strong>Development Setup</strong></summary>

```bash
# Fork and clone the repository
git clone https://github.com/yourusername/torrentsnag.git
cd torrentsnag

# Build the extension
./build.sh

# Load dist/ folder in Chrome developer mode
```

**Development Workflow:**
1. Edit source files in `src/` directory
2. Run build script to compile to `dist/`
3. Reload extension in Chrome extensions page
4. Test functionality with target torrent sites
5. Check console logs for debugging

</details>

<details>
<summary><strong>Contributing Guidelines</strong></summary>

- **🍴 Fork** the repository and create a feature branch
- **🎯 Follow** existing code style and patterns
- **🧪 Test** thoroughly with multiple torrent clients
- **📝 Update** documentation for new features  
- **🔀 Submit** pull request with detailed description

**Testing Checklist:**
- [ ] Test with multiple clients (qBittorrent, Transmission, Deluge)
- [ ] Verify pattern detection on various torrent sites
- [ ] Test performance with large pages (1000+ links)
- [ ] Confirm settings import/export functionality
- [ ] Validate internationalization with different languages
- [ ] Check error handling with invalid configurations

</details>

## 📄 License & Acknowledgments

<div align="center">

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0.html)

This project is licensed under the terms of the GNU General Public License v3.0.
See the [LICENSE](LICENSE) file for details.

**Developed by [Blackboard Studios](https://blackboardstudios.com)**

</div>

### 🙏 Acknowledgments

- **[qBittorrent Team](https://qbittorrent.org/)** - Excellent Web API documentation and robust torrent client
- **[Transmission Project](https://transmissionbt.com/)** - Clean RPC protocol design and reliable daemon architecture  
- **[Deluge Team](https://deluge-torrent.org/)** - Comprehensive web interface and JSON-RPC implementation
- **[Chrome Extensions Team](https://developer.chrome.com/docs/extensions/)** - Manifest V3 documentation and development tools
- **Community Contributors** - Bug reports, feature suggestions, and translation contributions
- **Open Source Community** - Various utilities and patterns adapted from the ecosystem

---

<div align="center">

**🌟 Star this repository if you find Torrent Snag useful!**

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/torrentsnag&type=Date)](https://star-history.com/#yourusername/torrentsnag&Date)

**Consider [supporting development](https://ko-fi.com/sphildreth) ☕**

</div>
