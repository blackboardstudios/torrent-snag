// qBittorrent Handler for Torrent Snag extension
'use strict';

// qBittorrent Handler
class QBittorrentHandler extends BaseTorrentHandler {
  constructor(config) {
    super(config);
    this.baseURL = config.url.replace(/\/$/, '');
    this.username = config.username;
    this.password = config.password;
  }

  async login() {
    let lastStatus = null;
    try {
      const formData = new FormData();
      formData.append('username', this.username);
      formData.append('password', this.password);
      
      const response = await fetch(`${this.baseURL}/api/v2/auth/login`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        mode: 'cors',
        headers: {
          'Accept': 'text/plain, */*',
          'User-Agent': 'TorrentSnag/1.0'
        }
      });
      lastStatus = response.status;
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const responseText = await response.text();
      this.isAuthenticated = responseText === 'Ok.';
      
      if (!this.isAuthenticated) {
        throw new Error('Invalid credentials');
      }
      
      return this.isAuthenticated;
    } catch (error) {
      console.error('qBittorrent login failed:', error);
      
      let errorMessage = error.message;
      let helpText = '';
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Connection failed - Cannot reach qBittorrent server';
        helpText = `
Possible solutions:
1. Check if qBittorrent Web UI is running at ${this.baseURL}
2. In qBittorrent: Tools → Options → Web UI → Enable "Bypass authentication for clients on localhost"
3. Or add "Access-Control-Allow-Origin: *" to qBittorrent's Web UI settings
4. Temporarily disable CSRF protection in qBittorrent Web UI
5. Verify the URL is correct (default: http://localhost:8080)`;
      } else if (lastStatus === 403) {
        errorMessage = 'Access forbidden - CSRF protection may be blocking the request';
        helpText = 'Try disabling CSRF protection in qBittorrent Web UI settings';
      } else if (lastStatus === 401) {
        errorMessage = 'Authentication failed - Invalid username or password';
        helpText = 'Check your qBittorrent Web UI credentials';
      }
      
      if (!this.isTesting) {
        this.showNotification(`qBittorrent Error: ${errorMessage}${helpText ? '\n\n' + helpText : ''}`, 'error');
      }
      
      return false;
    }
  }

  async processUrl(url) {
    if (this.isHtmlRedirectUrl(url)) {
      try {
        return await this.downloadTorrentFile(url);
      } catch (error) {
        console.error('QBittorrent: Failed to download torrent file, using original URL:', error);
        return url;
      }
    }
    return url;
  }

  async downloadTorrentFile(url) {
    try {
      
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        credentials: 'include',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': new URL(url).origin
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to access download page`);
      }

      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/x-bittorrent') || 
          contentType.includes('application/octet-stream')) {
        const torrentBlob = await response.blob();
        return { type: 'file', content: torrentBlob, filename: this.extractFilename(response, url) };
      }

      if (contentType.includes('text/html')) {
        const html = await response.text();
        
        if (html.match(/(login|signin|authentication)/i) && html.match(/form/i)) {
          throw new Error('Authentication required: Please log in to the torrent site first');
        }

        const torrentLinkMatch = html.match(/href=["']([^"']*\.torrent[^"']*?)["']/i);
        if (torrentLinkMatch) {
          const torrentUrl = torrentLinkMatch[1];
          const fullTorrentUrl = torrentUrl.startsWith('http') ? torrentUrl : new URL(torrentUrl, url).href;
          
          const torrentResponse = await fetch(fullTorrentUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Referer': url
            }
          });
          
          if (torrentResponse.ok) {
            const torrentBlob = await torrentResponse.blob();
            return { type: 'file', content: torrentBlob, filename: this.extractFilename(torrentResponse, fullTorrentUrl) };
          }
        }
      }

      return { type: 'url', content: url };

    } catch (error) {
      console.error('QBittorrent: Error downloading torrent file:', error);
      throw error;
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
        let processed = null;
        
        try {
          
          processed = await this.processUrl(url);
          
          const formData = new FormData();
          
          if (typeof processed === 'object' && processed.type === 'file') {
            formData.append('torrents', processed.content, processed.filename);
          } else {
            const processedUrl = typeof processed === 'string' ? processed : processed.content;
            const hasEncodedChars = processedUrl.includes('%');
            const decodedUrl = hasEncodedChars ? decodeURIComponent(processedUrl) : processedUrl;
            formData.append('urls', decodedUrl);
          }
          
          // Add category/label if provided
          if (label && label.trim()) {
            formData.append('category', label.trim());
          }
          
          const response = await fetch(`${this.baseURL}/api/v2/torrents/add`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
            mode: 'cors'
          });
          
          if (response.ok) {
            const responseText = await response.text();
            if (responseText === 'Ok.') {
              successCount++;
              results.push({ url, success: true, label: label || null });
            } else {
              results.push({ url, success: false, error: responseText, label: label || null });
            }
          } else {
            const responseText = await response.text();
            results.push({ url, success: false, error: `HTTP ${response.status}: ${responseText}`, label: label || null });
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`QBittorrent: Individual torrent ${i + 1} error:`, error);
          results.push({ url, success: false, error: error.message, label: label || null });
        } finally {
          if (processed) {
            this.cleanupTorrentFile(processed);
            processed = null;
          }
        }
      }
      
      
      return { success: successCount > 0, count: successCount, total: urls.length, results };
    } catch (error) {
      console.error('QBittorrent: Add torrents failed:', error);
      let errorMessage = error.message;
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Network error - this may be due to CORS restrictions. Please check qBittorrent CORS settings or try disabling CSRF protection.';
      }
      
      if (!this.isTesting) {
        this.showNotification(`Failed to add torrents: ${errorMessage}`, 'error');
      }
      throw error;
    }
  }

  async testConnection() {
    this.isTesting = true;
    try {
      // First, try to reach the login endpoint
      
      // Test basic connectivity first
      const connectivityTest = await fetch(`${this.baseURL}/api/v2/app/version`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'include'
      }).catch(error => {
        return null;
      });
      
      if (!connectivityTest) {
        throw new Error(`Cannot connect to qBittorrent at ${this.baseURL}. Please check if qBittorrent Web UI is running and accessible.`);
      }
      
      // Test authentication
      const loginResult = await this.login();
      if (!loginResult) {
        throw new Error('Authentication test failed');
      }
      
      // Test API access
      const response = await fetch(`${this.baseURL}/api/v2/app/version`, {
        credentials: 'include',
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`API access failed: HTTP ${response.status}`);
      }
      
      const version = await response.text();
      
      return {
        success: true,
        message: `Successfully connected to qBittorrent ${version}`,
        version: version
      };
      
    } catch (error) {
      console.error('qBittorrent connection test failed:', error);
      
      let message = error.message;
      let suggestions = [];
      
      if (error.message.includes('Failed to fetch') || error.message.includes('Cannot connect')) {
        suggestions = [
          '1. Verify qBittorrent Web UI is enabled and running',
          '2. Check the URL is correct (default: http://localhost:8080)',
          '3. In qBittorrent → Tools → Options → Web UI → Check "Enable Web User Interface"',
          '4. Try adding "Access-Control-Allow-Origin: *" to qBittorrent Web UI settings',
          '5. Consider enabling "Bypass authentication for clients on localhost" for local use'
        ];
      } else if (error.message.includes('Authentication')) {
        suggestions = [
          '1. Verify your username and password are correct',
          '2. Check if default credentials are "admin" with blank password',
          '3. Try resetting qBittorrent Web UI credentials'
        ];
      }
      
      return {
        success: false,
        message: message,
        suggestions: suggestions
      };
    } finally {
      this.isTesting = false;
    }
  }
  
  // Helper method to provide troubleshooting guidance
  static getTroubleshootingGuide() {
    return {
      title: "qBittorrent Connection Issues",
      commonIssues: [
        {
          issue: "Failed to fetch / CORS errors",
          solutions: [
            "Enable qBittorrent Web UI: Tools → Options → Web UI → Enable",
            "Add CORS header in qBittorrent advanced settings",
            "Temporarily disable CSRF protection",
            "Try 'Bypass authentication for clients on localhost'"
          ]
        },
        {
          issue: "Authentication failed",
          solutions: [
            "Check default credentials (usually admin with no password)",
            "Verify Web UI credentials in qBittorrent settings",
            "Reset Web UI password if forgotten"
          ]
        },
        {
          issue: "Connection refused",
          solutions: [
            "Verify qBittorrent is running",
            "Check Web UI port (default: 8080)",
            "Ensure no firewall is blocking the connection",
            "Try accessing Web UI directly in browser first"
          ]
        }
      ]
    };
  }
}

// Export for use in other files
if (typeof window !== 'undefined') {
  window.QBittorrentHandler = QBittorrentHandler;
}
