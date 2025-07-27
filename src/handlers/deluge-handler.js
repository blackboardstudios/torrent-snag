// Deluge Handler for Torrent Snag extension
'use strict';

// Deluge Handler
class DelugeHandler extends BaseTorrentHandler {
  constructor(config) {
    super(config);
    this.baseURL = config.url.replace(/\/$/, '');
    this.password = config.password;
    this.sessionCookie = null;
  }

  async login() {
    try {
      const response = await fetch(`${this.baseURL}/json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method: 'auth.login',
          params: [this.password],
          id: 1
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.result === true) {
        this.isAuthenticated = true;
        return true;
      }

      throw new Error('Invalid password');
    } catch (error) {
      console.error('Deluge login failed:', error);
      if (!this.isTesting) {
        this.showNotification(`Login failed: ${error.message}`, 'error');
      }
      return false;
    }
  }

  async addTorrents(urls, labels = []) {
    if (!this.isAuthenticated && !(await this.login())) {
      throw new Error('Authentication failed');
    }

    try {
      let successCount = 0;
      const results = [];

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const label = labels[i] || this.config.defaultLabel || '';
        
        try {
          const torrentOptions = {};
          
          // Add label if provided (Deluge supports labels)
          if (label && label.trim()) {
            torrentOptions.label = label.trim();
          }
          
          const body = {
            method: 'web.add_torrents',
            params: [[{
              path: url,
              options: torrentOptions
            }]],
            id: Date.now()
          };

          const response = await fetch(`${this.baseURL}/json`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(body)
          });

          if (response.ok) {
            const result = await response.json();
            if (result.error === null) {
              successCount++;
              results.push({ url, success: true, label: label || null });
            } else {
              results.push({ url, success: false, error: result.error.message, label: label || null });
            }
          } else {
            results.push({ url, success: false, error: `HTTP ${response.status}`, label: label || null });
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          results.push({ url, success: false, error: error.message, label: label || null });
        }
      }

      return { success: successCount > 0, count: successCount, total: urls.length, results };
    } catch (error) {
      console.error('Deluge: Add torrents failed:', error);
      if (!this.isTesting) {
        this.showNotification(`Failed to add torrents: ${error.message}`, 'error');
      }
      throw error;
    }
  }

  async testConnection() {
    try {
      if (!this.isAuthenticated && !(await this.login())) {
        return false;
      }

      const response = await fetch(`${this.baseURL}/json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          method: 'daemon.get_method_list',
          params: [],
          id: 1
        })
      });

      if (response.ok) {
        const result = await response.json();
        return result.error === null;
      }
      return false;
    } catch (error) {
      console.error('Deluge connection test failed:', error);
      return false;
    }
  }
}

// Export for use in other files
if (typeof window !== 'undefined') {
  window.DelugeHandler = DelugeHandler;
}