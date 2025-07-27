// Popup script for Torrent Snag extension
'use strict';

let detectedTorrents = [];
let selectedTorrents = new Set();
let targetTabId = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    // Detect and apply theme
    await detectAndApplyTheme();
    
    await getTargetTabId();
    setupEventListeners();
    await loadTorrents();
});

async function detectAndApplyTheme() {
    
    try {
        // Check if user has forced dark mode in settings
        const config = await configUtils.getConfig();
        const forceDarkMode = config.theme?.forceDarkMode || false;
        
        
        if (forceDarkMode) {
            // User has forced dark mode
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
            document.documentElement.classList.add('dark-theme');
        } else {
            // Use system theme detection
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.body.classList.remove('light-theme');
                document.body.classList.add('dark-theme');
                document.documentElement.classList.add('dark-theme');
            } else {
                document.body.classList.remove('dark-theme');
                document.body.classList.add('light-theme');
                document.documentElement.classList.add('light-theme');
            }
        }
        
        
        // Listen for theme changes (only if not forced)
        if (!forceDarkMode && window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', (e) => {
                if (e.matches) {
                    document.body.classList.remove('light-theme');
                    document.body.classList.add('dark-theme');
                    document.documentElement.classList.add('dark-theme');
                } else {
                    document.body.classList.remove('dark-theme');
                    document.body.classList.add('light-theme');
                    document.documentElement.classList.remove('dark-theme');
                }
            });
        }
    } catch (error) {
        console.error('Failed to load theme settings:', error);
        // Fallback to system detection
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-theme');
            document.documentElement.classList.add('dark-theme');
        } else {
            document.body.classList.add('light-theme');
            document.documentElement.classList.add('light-theme');
        }
    }
}

async function getTargetTabId() {
    try {
        // Get the stored tab ID from the background script
        const result = await chrome.storage.local.get(['reviewPopupTabId']);
        targetTabId = result.reviewPopupTabId;
        
        if (!targetTabId) {
            // Fallback to current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            targetTabId = tab?.id;
        }
    } catch (error) {
        console.error('Failed to get target tab ID:', error);
    }
}

function setupEventListeners() {
    // Header buttons
    document.getElementById('refresh-btn').addEventListener('click', refreshPage);
    document.getElementById('options-btn').addEventListener('click', openOptions);
    
    // Torrent actions
    document.getElementById('select-all-btn').addEventListener('click', selectAll);
    document.getElementById('deselect-all-btn').addEventListener('click', deselectAll);
    document.getElementById('send-selected-btn').addEventListener('click', sendSelectedTorrents);
    document.getElementById('apply-bulk-label-btn').addEventListener('click', applyBulkLabel);
    
    // Empty state actions
    document.getElementById('scan-page-btn').addEventListener('click', refreshPage);
    document.getElementById('retry-btn').addEventListener('click', loadTorrents);
}

async function loadTorrents() {
    try {
        showLoading();
        
        if (!targetTabId) {
            throw new Error('No target tab available');
        }
        
        // Get detected torrents from content script
        const response = await chrome.tabs.sendMessage(targetTabId, { 
            type: 'GET_DETECTED_LINKS' 
        });
        
        if (!response) {
            throw new Error('Failed to get response from content script');
        }
        
        detectedTorrents = response.links || [];
        
        if (detectedTorrents.length === 0) {
            showNoTorrents();
        } else {
            showTorrents();
        }
        
    } catch (error) {
        console.error('Failed to load torrents:', error);
        showError(error.message);
    }
}

function showLoading() {
    hideAllStates();
    document.getElementById('loading').style.display = 'flex';
}

function showNoTorrents() {
    hideAllStates();
    document.getElementById('no-torrents').style.display = 'flex';
}

function showTorrents() {
    hideAllStates();
    document.getElementById('torrents-container').style.display = 'flex';
    renderTorrentsList();
    updateCounters();
}

function showError(message) {
    hideAllStates();
    document.getElementById('error-state').style.display = 'flex';
    document.getElementById('error-message').textContent = message;
}

function hideAllStates() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('no-torrents').style.display = 'none';
    document.getElementById('torrents-container').style.display = 'none';
    document.getElementById('error-state').style.display = 'none';
}

function renderTorrentsList() {
    const container = document.getElementById('torrents-list');
    container.innerHTML = '';
    
    detectedTorrents.forEach((torrent, index) => {
        const torrentElement = createTorrentElement(torrent, index);
        container.appendChild(torrentElement);
    });
    
    // Select all torrents by default
    selectedTorrents = new Set(detectedTorrents.map((_, index) => index));
    updateSelectionUI();
}

function createTorrentElement(torrent, index) {
    const element = document.createElement('div');
    element.className = 'torrent-item';
    element.dataset.index = index;
    
    const isMagnet = torrent.url.startsWith('magnet:');
    const isHtmlRedirect = isHtmlRedirectUrl(torrent.url);
    let torrentType = isMagnet ? 'magnet' : 'torrent';
    
    // Special handling for HTML redirects
    if (isHtmlRedirect && !isMagnet) {
        torrentType = 'html-redirect';
    }
    
    // Extract torrent name from URL
    const torrentName = extractTorrentName(torrent.url);
    
    element.innerHTML = `
        <input type="checkbox" class="torrent-checkbox" checked>
        <div class="torrent-info">
            <div class="torrent-name" title="${escapeHtml(torrentName)}">
                ${escapeHtml(torrentName)}
            </div>
            <div class="torrent-details">
                <span class="torrent-type ${torrentType}">
                    ${getTorrentTypeIcon(torrentType)} ${getTorrentTypeLabel(torrentType)}
                </span>
                <span class="torrent-url" title="${escapeHtml(torrent.url)}">
                    ${escapeHtml(torrent.url)}
                </span>
            </div>
            <div class="torrent-label">
                <label for="label-${index}">Label:</label>
                <input type="text" id="label-${index}" class="label-input" placeholder="Optional category/label" maxlength="50">
            </div>
        </div>
        <div class="torrent-actions">
            <button class="remove-btn" title="Remove this torrent">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="m19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
            </button>
        </div>
    `;
    
    // Add event listeners
    const checkbox = element.querySelector('.torrent-checkbox');
    const removeBtn = element.querySelector('.remove-btn');
    const labelInput = element.querySelector('.label-input');
    
    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            selectedTorrents.add(index);
            element.classList.add('selected');
        } else {
            selectedTorrents.delete(index);
            element.classList.remove('selected');
        }
        updateCounters();
    });
    
    element.addEventListener('click', (e) => {
        if (e.target === checkbox || e.target === removeBtn || removeBtn.contains(e.target) || 
            e.target === labelInput || e.target.closest('.torrent-label')) {
            return;
        }
        checkbox.click();
    });
    
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeTorrent(index);
    });
    
    return element;
}

function extractTorrentName(url) {
    try {
        if (url.startsWith('magnet:')) {
            // Extract display name from magnet link
            const match = url.match(/[?&]dn=([^&]*)/);
            if (match) {
                return decodeURIComponent(match[1]).replace(/\+/g, ' ');
            }
            
            // Fallback to hash
            const hashMatch = url.match(/btih:([a-fA-F0-9]{40})/);
            if (hashMatch) {
                return `Torrent ${hashMatch[1].substring(0, 8)}...`;
            }
            
            return 'Magnet Link';
        } else {
            // Extract filename from torrent URL
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const filename = pathname.split('/').pop();
            
            if (filename && filename.includes('.')) {
                return filename.replace(/\.torrent$/, '');
            }
            
            return pathname || 'Torrent File';
        }
    } catch (error) {
        return 'Unknown Torrent';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function removeTorrent(index) {
    try {
        if (!targetTabId) {
            throw new Error('No target tab available');
        }
        
        const torrent = detectedTorrents[index];
        
        // Remove from content script's detected links
        await chrome.tabs.sendMessage(targetTabId, {
            type: 'REMOVE_DETECTED_LINK',
            url: torrent.url
        });
        
        // Remove from local array
        detectedTorrents.splice(index, 1);
        
        // Update selected set (adjust indices)
        const newSelectedTorrents = new Set();
        selectedTorrents.forEach(selectedIndex => {
            if (selectedIndex < index) {
                newSelectedTorrents.add(selectedIndex);
            } else if (selectedIndex > index) {
                newSelectedTorrents.add(selectedIndex - 1);
            }
            // Skip if selectedIndex === index (removed item)
        });
        selectedTorrents = newSelectedTorrents;
        
        // Re-render the list
        if (detectedTorrents.length === 0) {
            showNoTorrents();
        } else {
            renderTorrentsList();
        }
        
    } catch (error) {
        console.error('Failed to remove torrent:', error);
        // Show error to user
        showError(`Failed to remove torrent: ${error.message}`);
    }
}

function selectAll() {
    selectedTorrents = new Set(detectedTorrents.map((_, index) => index));
    updateSelectionUI();
}

function deselectAll() {
    selectedTorrents.clear();
    updateSelectionUI();
}

function updateSelectionUI() {
    // Update checkboxes and visual selection
    document.querySelectorAll('.torrent-item').forEach((item, index) => {
        const checkbox = item.querySelector('.torrent-checkbox');
        const isSelected = selectedTorrents.has(index);
        
        checkbox.checked = isSelected;
        item.classList.toggle('selected', isSelected);
    });
    
    updateCounters();
}

function updateCounters() {
    const totalCount = detectedTorrents.length;
    const selectedCount = selectedTorrents.size;
    
    // Update headers
    document.getElementById('torrents-count').textContent = 
        `${totalCount} torrent${totalCount !== 1 ? 's' : ''} found`;
    
    document.getElementById('selected-count').textContent = selectedCount;
    
    // Update send button state
    const sendBtn = document.getElementById('send-selected-btn');
    sendBtn.disabled = selectedCount === 0;
    sendBtn.textContent = selectedCount === 0 
        ? 'Send to qBittorrent'
        : `Send ${selectedCount} to qBittorrent`;
}

function applyBulkLabel() {
    const bulkLabelInput = document.getElementById('bulk-label-input');
    const bulkLabel = bulkLabelInput.value.trim();
    
    // Apply the bulk label to all torrent label inputs
    detectedTorrents.forEach((_, index) => {
        const labelInput = document.getElementById(`label-${index}`);
        if (labelInput) {
            labelInput.value = bulkLabel;
        }
    });
    
    // Clear the bulk input
    bulkLabelInput.value = '';
}

async function sendSelectedTorrents() {
    try {
        if (selectedTorrents.size === 0) {
            return;
        }
        
        const sendBtn = document.getElementById('send-selected-btn');
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';
        
        // Get selected torrent URLs and their labels
        const selectedData = Array.from(selectedTorrents).map(index => {
            const labelInput = document.getElementById(`label-${index}`);
            return {
                url: detectedTorrents[index].url,
                label: labelInput ? labelInput.value.trim() : ''
            };
        });
        
        // Send to background script and close popup immediately
        chrome.runtime.sendMessage({
            type: 'SEND_TORRENTS',
            torrents: selectedData
        });
        
        // Close popup immediately
        window.close();
        
    } catch (error) {
        console.error('Failed to send torrents:', error);
        showError(`Failed to send torrents: ${error.message}`);
        
        // Reset button
        const sendBtn = document.getElementById('send-selected-btn');
        sendBtn.disabled = false;
        updateCounters();
    }
}

async function refreshPage() {
    try {
        if (!targetTabId) {
            throw new Error('No target tab available');
        }
        
        // Tell content script to rescan
        await chrome.tabs.sendMessage(targetTabId, { type: 'RESCAN_PAGE' });
        
        // Reload torrents
        await loadTorrents();
        
    } catch (error) {
        console.error('Failed to refresh page scan:', error);
        showError(`Failed to refresh: ${error.message}`);
    }
}

function openOptions() {
    chrome.runtime.openOptionsPage();
    window.close();
}

function isHtmlRedirectUrl(url) {
    // Check for common patterns that indicate HTML redirect pages
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

function getTorrentTypeIcon(type) {
    switch (type) {
        case 'magnet': return '🧲';
        case 'torrent': return '📁';
        case 'html-redirect': return '🔗';
        default: return '📄';
    }
}

function getTorrentTypeLabel(type) {
    switch (type) {
        case 'magnet': return 'MAGNET';
        case 'torrent': return 'TORRENT';
        case 'html-redirect': return 'HTML REDIRECT';
        default: return 'UNKNOWN';
    }
}
