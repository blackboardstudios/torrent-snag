// Transmission Handler for Torrent Snag extension
'use strict';

// Transmission Handler
class TransmissionHandler extends BaseTorrentHandler {
  constructor(config) {
    super(config);
    this.baseURL = config.url.replace(/\/$/, '');
    this.username = config.username;
    this.password = config.password;
    this.sessionId = null;
  }

  async login() {
    try {
      // Transmission uses session ID for CSRF protection
      const response = await fetch(`${this.baseURL}/transmission/rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(`${this.username}:${this.password}`)
        },
        body: JSON.stringify({
          method: 'session-get'
        })
      });

      // Transmission returns 409 with session ID in header
      if (response.status === 409) {
        this.sessionId = response.headers.get('X-Transmission-Session-Id');
        this.isAuthenticated = true;
        return true;
      }

      if (response.ok) {
        this.isAuthenticated = true;
        return true;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      console.error('Transmission login failed:', error);
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
          const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(`${this.username}:${this.password}`)
          };

          if (this.sessionId) {
            headers['X-Transmission-Session-Id'] = this.sessionId;
          }

          const body = {
            method: 'torrent-add',
            arguments: {}
          };

          if (url.startsWith('magnet:')) {
            body.arguments.filename = url;
          } else {
            body.arguments.filename = url;
          }

          // Add labels if provided (Transmission supports labels via array)
          if (label && label.trim()) {
            body.arguments.labels = [label.trim()];
          }

          let response = await fetch(`${this.baseURL}/transmission/rpc`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
          });

          // If session ID missing/stale, capture it and retry once
          if (response.status === 409) {
            const newSessionId = response.headers.get('X-Transmission-Session-Id');
            if (newSessionId) {
              this.sessionId = newSessionId;
              headers['X-Transmission-Session-Id'] = newSessionId;
              response = await fetch(`${this.baseURL}/transmission/rpc`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
              });
            }
          }

          if (response.ok) {
            const result = await response.json();
            if (result.result === 'success') {
              successCount++;
              results.push({ url, success: true, label: label || null });
            } else {
              results.push({ url, success: false, error: result.result, label: label || null });
            }
          } else {
            results.push({ url, success: false, error: `HTTP ${response.status}` });
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          results.push({ url, success: false, error: error.message });
        }
      }

      return { success: successCount > 0, count: successCount, total: urls.length, results };
    } catch (error) {
      console.error('Transmission: Add torrents failed:', error);
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

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${this.username}:${this.password}`)
      };

      if (this.sessionId) {
        headers['X-Transmission-Session-Id'] = this.sessionId;
      }

      const response = await fetch(`${this.baseURL}/transmission/rpc`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          method: 'session-get'
        })
      });

      return response.ok || response.status === 409;
    } catch (error) {
      console.error('Transmission connection test failed:', error);
      return false;
    }
  }
}

// Export for use in other files
if (typeof window !== 'undefined') {
  window.TransmissionHandler = TransmissionHandler;
}
