// Base Torrent Handler for Torrent Snag extension
'use strict';

// Base abstract handler class
class BaseTorrentHandler {
  constructor(config) {
    this.config = config;
    this.isAuthenticated = false;
    this.isTesting = false;
  }

  // Abstract methods that must be implemented by subclasses
  async login() {
    throw new Error('login() must be implemented by subclass');
  }

  async addTorrents(urls, labels = []) {
    throw new Error('addTorrents() must be implemented by subclass');
  }

  async testConnection() {
    throw new Error('testConnection() must be implemented by subclass');
  }

  async processUrl(url) {
    // Default implementation - subclasses can override
    return url;
  }

  // Common utility methods
  showNotification(message, type = 'info') {
    if (!this.isTesting) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icons/icon-48.png',
        title: 'Torrent Snag',
        message: message
      });
    }
  }

  extractFilename(response, url) {
    // Try to get filename from Content-Disposition header
    const disposition = response.headers.get('content-disposition');
    if (disposition) {
      const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch) {
        return filenameMatch[1].replace(/['"]/g, '');
      }
    }
    
    // Fall back to URL
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      if (filename && filename.includes('.')) {
        return filename;
      }
    } catch (e) {
      // ignore
    }
    
    return 'download.torrent';
  }

  cleanupTorrentFile(torrentFile) {
    if (torrentFile && typeof torrentFile === 'object' && torrentFile.type === 'file') {
      if (torrentFile.content) {
        torrentFile.content = null;
      }
      torrentFile.filename = null;
      torrentFile.type = null;
      return true;
    }
    return false;
  }

  isHtmlRedirectUrl(url) {
    const htmlIndicators = [
      /\.html?$/i,
      /\/download\/\d+\.html/i,
      /\/torrent\/\d+\.html/i,
      /\/torrents\/download\/id\/\d+/i,
      /action=download/i,
      /download\.php/i,
      /get\.php/i
    ];
    
    return htmlIndicators.some(pattern => pattern.test(url));
  }
}

// Export for use in other files
if (typeof window !== 'undefined') {
  window.BaseTorrentHandler = BaseTorrentHandler;
}