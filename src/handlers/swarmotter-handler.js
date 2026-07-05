// SwarmOtter Handler for Torrent Snag extension
'use strict';

class SwarmOtterHandler extends BaseTorrentHandler {
  constructor(config = {}) {
    super(config);
    this.baseURL = this.normalizeBaseURL(config.url);
    this.apiURL = this.baseURL.endsWith('/api/v1') ? this.baseURL : `${this.baseURL}/api/v1`;
    this.authToken = (config.authToken || '').trim();
    this.downloadDir = (config.downloadDir || '').trim();
  }

  normalizeBaseURL(url) {
    const fallback = 'http://127.0.0.1:9091';
    const value = (url || fallback).trim().replace(/\/+$/, '');
    return value || fallback;
  }

  buildHeaders(headers = {}) {
    const merged = {
      Accept: 'application/json',
      ...headers
    };

    if (this.authToken) {
      merged.Authorization = `Bearer ${this.authToken}`;
    }

    return merged;
  }

  async apiFetch(path, options = {}) {
    try {
      return await fetch(`${this.apiURL}${path}`, {
        ...options,
        headers: this.buildHeaders(options.headers || {})
      });
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`Cannot reach SwarmOtter API at ${this.apiURL}. Verify SwarmOtter is running, the URL is reachable from Chrome, and the API/Web UI port is exposed.`);
      }
      throw error;
    }
  }

  async parseEnvelope(response, action) {
    const responseText = await response.text();
    let envelope = {};

    if (responseText) {
      try {
        envelope = JSON.parse(responseText);
      } catch (error) {
        throw new Error(`${action} returned non-JSON response: ${responseText.slice(0, 120)}`);
      }
    }

    if (!response.ok || envelope.success === false) {
      const errorMessage = envelope.error?.message || response.statusText || `${action} failed`;
      const message = response.ok ? errorMessage : `HTTP ${response.status}: ${errorMessage}`;
      const error = new Error(message);
      error.code = envelope.error?.code;
      error.status = response.status;
      throw error;
    }

    return envelope.data;
  }

  extractHashFromDuplicate(error) {
    const match = error.message.match(/[a-fA-F0-9]{40}/);
    return match ? match[0].toLowerCase() : null;
  }

  async login() {
    try {
      const response = await this.apiFetch('/health', { method: 'GET' });
      await this.parseEnvelope(response, 'SwarmOtter health check');
      this.isAuthenticated = true;
      return true;
    } catch (error) {
      console.error('SwarmOtter connection test failed:', error);
      if (!this.isTesting) {
        this.showNotification(`SwarmOtter connection failed: ${error.message}`, 'error');
      }
      return false;
    }
  }

  async testConnection() {
    this.isTesting = true;
    return this.login();
  }

  async addTorrents(urls, labels = []) {
    if (!this.isAuthenticated && !(await this.login())) {
      throw new Error('SwarmOtter connection failed');
    }

    try {
      let successCount = 0;
      const results = [];

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const label = labels[i] || this.config.defaultLabel || '';

        try {
          const result = url.startsWith('magnet:')
            ? await this.addMagnet(url, label)
            : await this.addTorrentFileUrl(url, label);

          successCount++;
          results.push({
            url,
            success: true,
            hash: result.hash,
            duplicate: result.duplicate || false,
            warning: result.warning || null,
            label: label || null
          });
        } catch (error) {
          results.push({ url, success: false, error: error.message, label: label || null });
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return { success: successCount > 0, count: successCount, total: urls.length, results };
    } catch (error) {
      console.error('SwarmOtter: Add torrents failed:', error);
      if (!this.isTesting) {
        this.showNotification(`Failed to add torrents to SwarmOtter: ${error.message}`, 'error');
      }
      throw error;
    }
  }

  async addMagnet(magnet, label) {
    const body = { magnet };
    if (this.downloadDir) {
      body.download_dir = this.downloadDir;
    }

    const response = await this.apiFetch('/torrents/magnet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const addResult = await this.parseAddResponse(response, 'Add magnet');
    return this.applyLabelResult(addResult.hash, label, addResult.duplicate);
  }

  async addTorrentFileUrl(url, label) {
    let torrentFile = null;

    try {
      torrentFile = await this.downloadTorrentFile(url);
      const response = await this.apiFetch('/torrents/file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        body: torrentFile.content
      });

      const addResult = await this.parseAddResponse(response, 'Upload torrent file');
      return this.applyLabelResult(addResult.hash, label, addResult.duplicate);
    } finally {
      if (torrentFile) {
        this.cleanupTorrentFile(torrentFile);
      }
    }
  }

  async parseAddResponse(response, action) {
    try {
      const hash = await this.parseEnvelope(response, action);
      return { hash, duplicate: false };
    } catch (error) {
      if (error.code === 'duplicate_torrent') {
        const duplicateHash = this.extractHashFromDuplicate(error);
        if (duplicateHash) {
          return { hash: duplicateHash, duplicate: true };
        }
      }
      throw error;
    }
  }

  async applyLabelResult(hash, label, duplicate = false) {
    const result = {
      hash,
      duplicate,
      warning: null
    };

    if (!label || !label.trim()) {
      return result;
    }

    try {
      await this.setLabels(hash, [label.trim()]);
    } catch (error) {
      result.warning = `Torrent was added, but labels were not applied: ${error.message}`;
    }

    return result;
  }

  async setLabels(hash, labels) {
    const response = await this.apiFetch(`/torrents/${hash}/labels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ labels })
    });
    await this.parseEnvelope(response, 'Set labels');
  }

  async downloadTorrentFile(url) {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch torrent URL`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      return this.extractTorrentFromHtml(response, url);
    }

    const torrentBlob = await response.blob();
    return { type: 'file', content: torrentBlob, filename: this.extractFilename(response, url) };
  }

  async extractTorrentFromHtml(response, sourceUrl) {
    const html = await response.text();
    const torrentLinkMatch = html.match(/href=["']([^"']*\.torrent(?:\?[^"']*)?)["']/i);

    if (!torrentLinkMatch) {
      throw new Error('Download page did not expose a direct .torrent link');
    }

    const torrentUrl = torrentLinkMatch[1].startsWith('http')
      ? torrentLinkMatch[1]
      : new URL(torrentLinkMatch[1], sourceUrl).href;

    return this.downloadTorrentFile(torrentUrl);
  }
}

if (typeof window !== 'undefined') {
  window.SwarmOtterHandler = SwarmOtterHandler;
}
