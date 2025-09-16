// Context menu utilities for Torrent Snag extension
'use strict';

const contextMenuUtils = {
  // Torrent link detection patterns
  TORRENT_PATTERNS: [
    /\.torrent(\?.*)?$/i,
    /\/download\//i,
    /\/torrent\//i,
    /action=download/i,
    /download\.php/i,
    /dl\.php/i,
    /get\.php/i
  ],

  // Check if a URL is a torrent or magnet link
  isTorrentOrMagnetLink(url) {
    if (!url) return false;
    
    // Magnet links
    if (url.startsWith('magnet:')) {
      return true;
    }
    
    // Direct .torrent files
    if (url.match(/\.torrent(\?.*)?$/i)) {
      return true;
    }
    
    // Common torrent site patterns
    return this.TORRENT_PATTERNS.some(pattern => pattern.test(url));
  },

  // Get display name for current handler
  async getHandlerDisplayName() {
    try {
      // Use merged configuration for robustness
      const merged = await configUtils.getConfig();
      const selectedHandler = merged.selectedHandler || 'qbittorrent';
      const handlers = HandlerFactory.getAvailableHandlers();
      const handler = handlers.find(h => h.id === selectedHandler);
      return handler ? handler.name : 'Torrent Client';
    } catch (error) {
      console.error('Failed to get handler name:', error);
      return 'Torrent Client';
    }
  },

  // Setup context menus with current handler
  async setupContextMenus() {
    try {
      // Remove all existing context menus
      await chrome.contextMenus.removeAll();
      
      
      // Create the extension icon menu ONLY with action context
      // This ensures it ONLY shows when clicking the extension icon
      chrome.contextMenus.create({
        id: 'extension-review-torrents',
        title: 'Review Discovered Torrents',
        contexts: ['action'] // ONLY extension icon context, never on page content
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error creating extension menu:', chrome.runtime.lastError);
        } else {
        }
      });
      
      // Wait a moment then create link menus with completely separate context
      // This timeout ensures complete separation between action and link contexts
      setTimeout(() => {
        this.createLinkMenus();
      }, 200);
      
    } catch (error) {
      console.error('Failed to setup context menus:', error);
    }
  },

  // Create link menus with strict isolation from extension context
  async createLinkMenus() {
    try {
      
      const handlerName = await this.getHandlerDisplayName();
      
      // Create link menus with strict contexts - ONLY on links, NEVER on browser action
      chrome.contextMenus.create({
        id: 'link-send-torrent',
        title: `Send to ${handlerName}`,
        contexts: ['link'],
        documentUrlPatterns: ['*://*/*'], // Any webpage
        targetUrlPatterns: ['*://*/*', 'magnet:*'], // Any URL or magnet link
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error creating link send menu:', chrome.runtime.lastError);
        } else {
        }
      });
      
      chrome.contextMenus.create({
        id: 'link-send-with-label',
        title: 'Send with label...',
        contexts: ['link'],
        documentUrlPatterns: ['*://*/*'], // Any webpage
        targetUrlPatterns: ['*://*/*', 'magnet:*'], // Any URL or magnet link
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error creating link label menu:', chrome.runtime.lastError);
        } else {
          // Create submenu items
          this.createLabelSubmenus();
        }
      });
      
    } catch (error) {
      console.error('Failed to create link menus:', error);
    }
  },

  // Create label submenus
  createLabelSubmenus() {
    const commonLabels = ['Movies', 'TV Shows', 'Software', 'Music', 'Games', 'Books'];
    commonLabels.forEach(label => {
      chrome.contextMenus.create({
        id: `link-label-${label.replace(/\s+/g, '-').toLowerCase()}`,
        parentId: 'link-send-with-label',
        title: label,
        contexts: ['link'],
        documentUrlPatterns: ['*://*/*'], // Any webpage
        targetUrlPatterns: ['*://*/*', 'magnet:*'] // Any URL or magnet link
      });
    });
    
    chrome.contextMenus.create({
      id: 'link-label-custom',
      parentId: 'link-send-with-label',
      title: 'Custom label...',
      contexts: ['link'],
      documentUrlPatterns: ['*://*/*'], // Any webpage
      targetUrlPatterns: ['*://*/*', 'magnet:*'] // Any URL or magnet link
    });
  },

  // Update context menu titles when handler changes
  async updateContextMenus() {
    try {
      const handlerName = await this.getHandlerDisplayName();
      
      // Update the link menu titles but preserve strict context isolation
      chrome.contextMenus.update('link-send-torrent', {
        title: `Send to ${handlerName}`,
        contexts: ['link'], // Ensure it stays link-only
        documentUrlPatterns: ['*://*/*'],
        targetUrlPatterns: ['*://*/*', 'magnet:*']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error updating link menu:', chrome.runtime.lastError);
        } else {
        }
      });
    } catch (error) {
      console.error('Failed to update context menus:', error);
    }
  },

  // Handle context menu clicks
  async handleContextMenuClick(info, tab) {
    const { menuItemId, linkUrl } = info;
    
    try {
      if (menuItemId === 'extension-review-torrents') {
        // Open review popup (existing functionality)
        await this.openReviewPopup(tab.id);
        return;
      }
      
      // Handle dynamic link-based actions
      if (menuItemId === 'link-send-torrent') {
        if (!linkUrl || !this.isTorrentOrMagnetLink(linkUrl)) {
          this.showNotification('Selected link is not a torrent or magnet link', 'error');
          return;
        }
        await this.sendTorrentLink(linkUrl, '', tab);
        return;
      }
      
      if (menuItemId.startsWith('link-label-') && menuItemId !== 'link-label-custom') {
        if (!linkUrl || !this.isTorrentOrMagnetLink(linkUrl)) {
          this.showNotification('Selected link is not a torrent or magnet link', 'error');
          return;
        }
        // Extract label from ID
        const labelKey = menuItemId.replace('link-label-', '').replace(/-/g, ' ');
        const label = labelKey.replace(/\b\w/g, l => l.toUpperCase());
        await this.sendTorrentLink(linkUrl, label, tab);
        return;
      }
      
      if (menuItemId === 'link-label-custom') {
        if (!linkUrl || !this.isTorrentOrMagnetLink(linkUrl)) {
          this.showNotification('Selected link is not a torrent or magnet link', 'error');
          return;
        }
        // For now, send without label (could implement custom label input later)
        await this.sendTorrentLink(linkUrl, '', tab);
        return;
      }
      
      // Unknown menu item
      
    } catch (error) {
      console.error('Context menu action failed:', error);
      this.showNotification(`Action failed: ${error.message}`, 'error');
    }
  },

  // Send individual torrent link
  async sendTorrentLink(linkUrl, label, tab) {
    try {
      // Use existing sendTorrentsToHandler function
      await sendTorrentsToHandler([linkUrl], tab.id, [label]);
      
      const handlerName = await this.getHandlerDisplayName();
      const labelText = label ? ` with label "${label}"` : '';
      this.showNotification(`Torrent sent to ${handlerName}${labelText}`, 'success');
      
    } catch (error) {
      console.error('Failed to send torrent:', error);
      this.showNotification(`Failed to send torrent: ${error.message}`, 'error');
    }
  },

  // Open review popup (delegate to existing function)
  async openReviewPopup(tabId) {
    // This will be handled by the existing openReviewPopup function
    await openReviewPopup(tabId);
  },

  // Show notification
  showNotification(message, type = 'info') {
    const iconUrl = type === 'error' ? 'assets/icons/error-48.png' : 'assets/icons/icon-48.png';
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: iconUrl,
      title: 'Torrent Snag',
      message: message
    });
  }
};

// Export for use in background script
if (typeof window !== 'undefined') {
  window.contextMenuUtils = contextMenuUtils;
}
