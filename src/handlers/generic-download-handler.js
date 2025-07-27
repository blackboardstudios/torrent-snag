// Generic Download Handler for Torrent Snag extension
'use strict';

// Generic Download Handler
class GenericDownloadHandler extends BaseTorrentHandler {
  constructor(config) {
    super(config);
    this.isAuthenticated = true; // No auth needed for downloads
  }

  async login() {
    return true; // No authentication required
  }

  async addTorrents(urls, labels = []) {
    
    try {
      let successCount = 0;
      const results = [];

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const label = labels[i] || this.config.defaultLabel || '';
        
        try {
          if (url.startsWith('magnet:')) {
            // For magnet links, we'll create a .magnet file
            const magnetContent = url;
            let filename = this.getMagnetFilename(url);
            
            // If label is provided, prepend it to filename
            if (label && label.trim()) {
              const labelPrefix = label.trim().replace(/[/\\?%*:|"<>]/g, '-');
              filename = `${labelPrefix}_${filename}`;
            }
            
            const blob = new Blob([magnetContent], { type: 'text/plain' });
            const downloadUrl = URL.createObjectURL(blob);
            
            await chrome.downloads.download({
              url: downloadUrl,
              filename: filename,
              saveAs: false
            });

            URL.revokeObjectURL(downloadUrl);
            successCount++;
            results.push({ url, success: true, label: label || null });
          } else {
            // For torrent file URLs, download directly
            await chrome.downloads.download({
              url: url,
              saveAs: false
            });
            
            successCount++;
            results.push({ url, success: true, label: label || null });
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error('GenericDownload: Failed to download:', url, error);
          results.push({ url, success: false, error: error.message, label: label || null });
        }
      }

      return { success: successCount > 0, count: successCount, total: urls.length, results };
    } catch (error) {
      console.error('GenericDownload: Add torrents failed:', error);
      if (!this.isTesting) {
        this.showNotification(`Failed to download torrents: ${error.message}`, 'error');
      }
      throw error;
    }
  }

  getMagnetFilename(magnetUrl) {
    // Extract name from magnet link if available
    const nameMatch = magnetUrl.match(/[&?]dn=([^&]*)/);
    if (nameMatch) {
      const decodedName = decodeURIComponent(nameMatch[1]).replace(/[^a-zA-Z0-9\-_. ]/g, '_');
      return `${decodedName}.magnet`;
    }
    
    // Fall back to hash-based filename
    const hashMatch = magnetUrl.match(/[&?]xt=urn:btih:([a-fA-F0-9]{40})/);
    if (hashMatch) {
      return `${hashMatch[1]}.magnet`;
    }
    
    return `torrent-${Date.now()}.magnet`;
  }

  async testConnection() {
    // Always return true as we don't need to connect to anything
    return true;
  }
}

// Export for use in other files
if (typeof window !== 'undefined') {
  window.GenericDownloadHandler = GenericDownloadHandler;
}