// SwarmOtter Handler for Torrent Snag extension
'use strict';

class SwarmOtterHandler extends BaseTorrentHandler {
  constructor(config = {}) {
    super(config);
    this.baseURL = this.normalizeBaseURL(config.url);
    this.apiURL = this.baseURL.endsWith('/api/v1') ? this.baseURL : `${this.baseURL}/api/v1`;
    this.authToken = (config.authToken || '').trim();
    this.downloadDir = (config.downloadDir || '').trim();
    this.traceBatchId = config.traceBatchId || null;
    this.timeout = this.parsePositiveInteger(config.timeout, 30000);
  }

  createTraceBatchId() {
    return `swarmotter-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  }

  trace(event, details = {}) {
    console.info('Torrent Snag SwarmOtter trace:', event, details);
  }

  traceError(event, details = {}, error = null) {
    console.error('Torrent Snag SwarmOtter trace:', event, details, error || '');
  }

  traceWarn(event, details = {}) {
    console.warn('Torrent Snag SwarmOtter trace:', event, details);
  }

  torrentType(url) {
    return url.startsWith('magnet:') ? 'magnet' : 'torrent-url';
  }

  parsePositiveInteger(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }

  async fetchWithTimeout(url, options = {}, context = {}) {
    const timeoutMs = this.parsePositiveInteger(context.timeoutMs, this.timeout);

    if (typeof AbortController === 'undefined' || timeoutMs <= 0) {
      return fetch(url, options);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        const description = context.description || url;
        throw new Error(`${description} timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
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
    const method = options.method || 'GET';
    const startTime = Date.now();
    const url = `${this.apiURL}${path}`;

    this.trace('api request start', {
      batchId: this.traceBatchId,
      method,
      path,
      url,
      contentType: options.headers?.['Content-Type'] || null
    });

    try {
      const response = await this.fetchWithTimeout(url, {
        ...options,
        headers: this.buildHeaders(options.headers || {})
      }, {
        timeoutMs: this.timeout,
        description: `${method} ${path}`
      });
      this.trace('api request response', {
        batchId: this.traceBatchId,
        method,
        path,
        status: response.status,
        ok: response.ok,
        elapsedMs: Date.now() - startTime
      });
      return response;
    } catch (error) {
      this.traceError('api request failed', {
        batchId: this.traceBatchId,
        method,
        path,
        elapsedMs: Date.now() - startTime,
        error: error.message
      }, error);
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
    this.trace('connection test start', {
      batchId: this.traceBatchId,
      apiURL: this.apiURL,
      hasAuthToken: Boolean(this.authToken)
    });

    try {
      const response = await this.apiFetch('/health', { method: 'GET' });
      await this.parseEnvelope(response, 'SwarmOtter health check');
      this.isAuthenticated = true;
      this.trace('connection test succeeded', {
        batchId: this.traceBatchId,
        apiURL: this.apiURL
      });
      return true;
    } catch (error) {
      this.traceError('connection test failed', {
        batchId: this.traceBatchId,
        apiURL: this.apiURL,
        error: error.message
      }, error);
      console.error('SwarmOtter connection test failed:', error);
      if (!this.isTesting) {
        this.showNotification(`SwarmOtter connection failed: ${error.message}`, 'error');
      }
      return false;
    }
  }

  async testConnection() {
    this.isTesting = true;
    this.traceBatchId = this.traceBatchId || this.createTraceBatchId();
    const batchStartTime = Date.now();

    this.trace('connection test start', {
      batchId: this.traceBatchId,
      apiURL: this.apiURL,
      hasAuthToken: Boolean(this.authToken)
    });

    // Reachability: a headerless GET /health confirms the daemon is up and the
    // URL/port are correct. It does NOT exercise SwarmOtter's browser-origin
    // guard, because a simple cross-origin GET from the service worker carries no
    // Origin header, so it cannot detect token/origin problems on its own.
    try {
      const healthResponse = await this.apiFetch('/health', { method: 'GET' });
      await this.parseEnvelope(healthResponse, 'SwarmOtter health check');
    } catch (error) {
      this.traceError('connection test failed', {
        batchId: this.traceBatchId,
        apiURL: this.apiURL,
        error: error.message
      }, error);
      return this.reachabilityFailure(error);
    }

    // Authorization probe: a JSON POST carries the chrome-extension:// Origin, so
    // SwarmOtter evaluates its browser-origin guard. An empty bulk body is a
    // documented no-op (invalid_argument), making this side-effect-free. This is
    // what distinguishes a token/origin misconfiguration from reachability and
    // eliminates the false-positive "Test Connection" success.
    const probe = await this.verifyExtensionAccess();
    if (!probe.success) {
      return probe;
    }

    this.isAuthenticated = true;
    this.trace('connection test succeeded', {
      batchId: this.traceBatchId,
      apiURL: this.apiURL,
      elapsedMs: Date.now() - batchStartTime
    });
    return { success: true };
  }

  async verifyExtensionAccess() {
    this.trace('extension access probe start', {
      batchId: this.traceBatchId,
      apiURL: this.apiURL,
      hasAuthToken: Boolean(this.authToken)
    });

    let response;
    try {
      response = await this.apiFetch('/torrents/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ magnets: [], torrent_files: [] })
      });
    } catch (error) {
      this.traceError('extension access probe failed', {
        batchId: this.traceBatchId,
        error: error.message
      }, error);
      return this.reachabilityFailure(error);
    }

    const status = response.status;
    const code = response.ok ? null : await this.readErrorCode(response);

    this.trace('extension access probe response', {
      batchId: this.traceBatchId,
      status,
      ok: response.ok,
      code
    });

    // 401/403 are produced by the auth/browser-origin guard, which runs before
    // request handling. Any other status means the request reached daemon logic,
    // i.e. the extension origin was accepted (a valid token or a headerless
    // automation-style request that bypassed the guard).
    if (status !== 401 && status !== 403) {
      this.isAuthenticated = true;
      this.trace('extension access probe succeeded', {
        batchId: this.traceBatchId,
        status,
        code
      });
      return { success: true };
    }

    const failure = this.formatAccessFailure(status, code);
    this.traceError('extension access probe failed', {
      batchId: this.traceBatchId,
      status,
      code,
      error: failure.error
    }, null);
    return failure;
  }

  async readErrorCode(response) {
    try {
      const text = await response.text();
      if (!text) {
        return null;
      }
      const envelope = JSON.parse(text);
      return envelope?.error?.code || null;
    } catch (error) {
      return null;
    }
  }

  formatAccessFailure(status, code) {
    if (status === 403 && code === 'extension_origin_forbidden') {
      return {
        success: false,
        error: 'SwarmOtter blocked this Chrome extension origin. Extension API access requires api.require_auth = true with a configured api.auth_token.',
        suggestions: [
          'In SwarmOtter config set api.require_auth = true and api.auth_token, then restart SwarmOtter (auth-disabled mode always rejects chrome-extension origins)',
          'Copy the same api.auth_token value into the API token field here',
          'Re-test the connection after saving the token'
        ]
      };
    }
    if (status === 401) {
      return {
        success: false,
        error: 'SwarmOtter rejected the API token (HTTP 401). The API token here must match api.auth_token exactly.',
        suggestions: [
          'Re-open SwarmOtter config and copy api.auth_token',
          'Paste it into the API token field (surrounding whitespace is trimmed automatically)'
        ]
      };
    }
    if (status === 403) {
      return {
        success: false,
        error: `SwarmOtter blocked this request (HTTP 403${code ? `: ${code}` : ''}). Check the browser-origin and Host settings on SwarmOtter.`,
        suggestions: [
          'Confirm the URL host and port match the SwarmOtter listener',
          'If SwarmOtter is behind a reverse proxy, ensure it preserves the Host header'
        ]
      };
    }
    return {
      success: false,
      error: `SwarmOtter authorization check failed (HTTP ${status}${code ? `: ${code}` : ''}).`,
      suggestions: []
    };
  }

  reachabilityFailure(error) {
    return {
      success: false,
      error: error.message || 'SwarmOtter could not be reached',
      suggestions: [
        'Verify SwarmOtter is running and the API/Web UI port is exposed',
        'Check that the URL and port match the SwarmOtter listener',
        'Check for firewall or network restrictions between Chrome and SwarmOtter'
      ]
    };
  }

  async addTorrents(urls, labels = []) {
    this.traceBatchId = this.traceBatchId || this.createTraceBatchId();
    const batchStartTime = Date.now();

    this.trace('batch start', {
      batchId: this.traceBatchId,
      total: urls.length,
      apiURL: this.apiURL,
      baseURL: this.baseURL,
      hasAuthToken: Boolean(this.authToken),
      downloadDir: this.downloadDir || null,
      timeoutMs: this.timeout,
      endpoint: '/torrents/bulk'
    });

    if (!this.isAuthenticated && !(await this.login())) {
      throw new Error('SwarmOtter connection failed');
    }

    try {
      const results = new Array(urls.length);
      const bulkRequest = await this.prepareBulkAddRequest(urls, labels, results);

      if (bulkRequest.body.magnets.length > 0 || bulkRequest.body.torrent_files.length > 0) {
        const response = await this.apiFetch('/torrents/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bulkRequest.body)
        });

        const bulkResult = await this.parseEnvelope(response, 'Bulk add torrents');
        await this.applyBulkAddResult(bulkResult, bulkRequest.itemMap, results);
      }

      const orderedResults = results.map((result, index) => result || {
        url: urls[index],
        success: false,
        error: 'No bulk submission result was returned',
        label: labels[index] || this.config.defaultLabel || null
      });
      const successCount = orderedResults.filter(result => result.success).length;

      this.trace('batch complete', {
        batchId: this.traceBatchId,
        successCount,
        failedCount: orderedResults.length - successCount,
        total: urls.length,
        elapsedMs: Date.now() - batchStartTime
      });
      if (typeof console.table === 'function') {
        console.table(orderedResults.map((result, index) => ({
          batchId: this.traceBatchId,
          index: index + 1,
          success: result.success,
          hash: result.hash || null,
          duplicate: result.duplicate || false,
          error: result.error || null,
          url: result.url
        })));
      }

      return { success: successCount > 0, count: successCount, total: urls.length, results: orderedResults };
    } catch (error) {
      this.traceError('batch failed', {
        batchId: this.traceBatchId,
        total: urls.length,
        elapsedMs: Date.now() - batchStartTime,
        error: error.message
      }, error);
      console.error('SwarmOtter: Add torrents failed:', error);
      if (!this.isTesting) {
        this.showNotification(`Failed to add torrents to SwarmOtter: ${error.message}`, 'error');
      }
      throw error;
    }
  }

  async prepareBulkAddRequest(urls, labels, results) {
    const body = {
      magnets: [],
      torrent_files: []
    };
    const itemMap = new Map();

    if (this.downloadDir) {
      body.download_dir = this.downloadDir;
    }

    for (let index = 0; index < urls.length; index++) {
      const url = urls[index];
      const label = labels[index] || this.config.defaultLabel || '';
      const itemStartTime = Date.now();
      const traceDetails = {
        batchId: this.traceBatchId,
        index: index + 1,
        total: urls.length,
        type: this.torrentType(url),
        hasLabel: Boolean(label),
        url
      };

      this.trace('item prepare start', traceDetails);

      try {
        if (url.startsWith('magnet:')) {
          const bulkIndex = body.magnets.length;
          body.magnets.push(url);
          itemMap.set(this.bulkItemKey('magnet', bulkIndex), { index, url, label, kind: 'magnet' });
        } else {
          const torrentFile = await this.downloadTorrentFile(url);
          try {
            const metainfo = await this.blobToBase64(torrentFile.content);
            const bulkIndex = body.torrent_files.length;
            body.torrent_files.push({ metainfo });
            itemMap.set(this.bulkItemKey('torrent_file', bulkIndex), { index, url, label, kind: 'torrent_file' });
          } finally {
            this.cleanupTorrentFile(torrentFile);
          }
        }

        this.trace('item prepare succeeded', {
          ...traceDetails,
          bulkKind: url.startsWith('magnet:') ? 'magnet' : 'torrent_file',
          elapsedMs: Date.now() - itemStartTime
        });
      } catch (error) {
        this.traceError('item prepare failed', {
          ...traceDetails,
          error: error.message,
          elapsedMs: Date.now() - itemStartTime
        }, error);
        results[index] = { url, success: false, error: error.message, label: label || null };
      }
    }

    this.trace('bulk request prepared', {
      batchId: this.traceBatchId,
      magnets: body.magnets.length,
      torrentFiles: body.torrent_files.length,
      skipped: results.filter(Boolean).length,
      downloadDir: body.download_dir || null
    });

    return { body, itemMap };
  }

  async applyBulkAddResult(bulkResult, itemMap, results) {
    const added = Array.isArray(bulkResult?.added) ? bulkResult.added : [];
    const failed = Array.isArray(bulkResult?.failed) ? bulkResult.failed : [];

    this.trace('bulk response parsed', {
      batchId: this.traceBatchId,
      addedCount: added.length,
      failedCount: failed.length
    });

    for (const item of added) {
      const mapping = itemMap.get(this.bulkItemKey(item.kind, item.index));
      if (!mapping) {
        this.traceWarn('bulk added item had no matching request item', {
          batchId: this.traceBatchId,
          kind: item.kind,
          index: item.index,
          hash: item.info_hash || null
        });
        continue;
      }

      const result = await this.applyLabelResult(item.info_hash, mapping.label, false);
      results[mapping.index] = this.createSuccessResult(mapping, result);
      this.trace('item submit succeeded', {
        batchId: this.traceBatchId,
        index: mapping.index + 1,
        type: mapping.kind,
        hash: result.hash,
        duplicate: false,
        warning: result.warning || null
      });
    }

    for (const item of failed) {
      const mapping = itemMap.get(this.bulkItemKey(item.kind, item.index));
      if (!mapping) {
        this.traceWarn('bulk failed item had no matching request item', {
          batchId: this.traceBatchId,
          kind: item.kind,
          index: item.index,
          code: item.code || null,
          message: item.message || null
        });
        continue;
      }

      if (item.code === 'duplicate_torrent') {
        const duplicateHash = this.extractHashFromDuplicate({ message: item.message || '' }) || this.extractHashFromMagnet(mapping.url);
        if (duplicateHash) {
          const result = await this.applyLabelResult(duplicateHash, mapping.label, true);
          results[mapping.index] = this.createSuccessResult(mapping, result);
          this.trace('item submit succeeded', {
            batchId: this.traceBatchId,
            index: mapping.index + 1,
            type: mapping.kind,
            hash: result.hash,
            duplicate: true,
            warning: result.warning || null
          });
          continue;
        }
      }

      results[mapping.index] = {
        url: mapping.url,
        success: false,
        error: item.message || item.code || 'Bulk add item failed',
        label: mapping.label || null
      };
      this.traceError('item submit failed', {
        batchId: this.traceBatchId,
        index: mapping.index + 1,
        type: mapping.kind,
        code: item.code || null,
        error: item.message || item.code || 'Bulk add item failed'
      });
    }
  }

  bulkItemKey(kind, index) {
    return `${kind}:${index}`;
  }

  createSuccessResult(mapping, result) {
    return {
      url: mapping.url,
      success: true,
      hash: result.hash,
      duplicate: result.duplicate || false,
      warning: result.warning || null,
      label: mapping.label || null
    };
  }

  extractHashFromMagnet(magnet) {
    const match = magnet.match(/xt=urn:btih:([a-fA-F0-9]{40})(?:[&]|$)/);
    return match ? match[1].toLowerCase() : null;
  }

  async blobToBase64(blob) {
    const arrayBuffer = typeof blob.arrayBuffer === 'function'
      ? await blob.arrayBuffer()
      : await this.readBlobAsArrayBuffer(blob);
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 0x8000;

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, offset + chunkSize);
      binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
  }

  readBlobAsArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('Failed to read torrent file'));
      reader.onload = () => resolve(reader.result);
      reader.readAsArrayBuffer(blob);
    });
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
      this.traceWarn('label apply failed', {
        batchId: this.traceBatchId,
        hash,
        label: label.trim(),
        error: error.message
      });
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
    const startTime = Date.now();
    this.trace('torrent file download start', {
      batchId: this.traceBatchId,
      url
    });

    const response = await this.fetchWithTimeout(url, {
      method: 'GET',
      redirect: 'follow',
      credentials: 'include'
    }, {
      timeoutMs: this.timeout,
      description: `Download torrent URL ${url}`
    });

    const contentType = response.headers.get('content-type') || '';
    this.trace('torrent file download response', {
      batchId: this.traceBatchId,
      url,
      status: response.status,
      ok: response.ok,
      contentType,
      elapsedMs: Date.now() - startTime
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch torrent URL`);
    }

    if (contentType.includes('text/html')) {
      this.trace('torrent file response is html; extracting torrent link', {
        batchId: this.traceBatchId,
        url,
        contentType
      });
      return this.extractTorrentFromHtml(response, url);
    }

    const torrentBlob = await response.blob();
    this.trace('torrent file blob ready', {
      batchId: this.traceBatchId,
      url,
      size: torrentBlob.size ?? null,
      type: torrentBlob.type || null,
      elapsedMs: Date.now() - startTime
    });
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

    this.trace('torrent file link extracted from html', {
      batchId: this.traceBatchId,
      sourceUrl,
      torrentUrl
    });

    return this.downloadTorrentFile(torrentUrl);
  }
}

if (typeof window !== 'undefined') {
  window.SwarmOtterHandler = SwarmOtterHandler;
}
