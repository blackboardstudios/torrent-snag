// Torrent Snag Options Page JavaScript
(async () => {
    // Localization: replace all [data-i18n] elements with localized strings
    async function localizeOptionsPage() {
        // Get selected language from config
        const config = await configUtils.getConfig();
        const lang = config.language || 'en';
        // If not English, fetch the correct messages.json
        let messages = {};
        if (lang === 'en') {
            // Use chrome.i18n for English (default)
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                const msg = chrome.i18n.getMessage(key);
                if (msg) el.textContent = msg;
            });
            return;
        }
        // Try to fetch the correct _locales messages.json
        try {
            const resp = await fetch(`../_locales/${lang}/messages.json`);
            messages = await resp.json();
        } catch (e) {
            // fallback to English
            const resp = await fetch(`../_locales/en/messages.json`);
            messages = await resp.json();
        }
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (messages[key] && messages[key].message) {
                el.textContent = messages[key].message;
            }
        });
    }
    'use strict';

    let currentConfig = {};
    let currentPatternId = null;
    let availableHandlers = [];
    
    // Change tracking for unified save button
    let hasUnsavedChanges = false;
    const originalValues = new Map();

    // Localize UI first
    await localizeOptionsPage();
    // Initialize options page
    await initializeOptionsPage();

    async function initializeOptionsPage() {
        try {
            availableHandlers = HandlerFactory.getAvailableHandlers();
            await loadConfiguration();
            await loadDuplicateStats();
            setupEventListeners();
            setupTabNavigation();
            setupHandlerSelector();
            renderHandlerConfig();
            renderPatterns();
            renderFilters();
            initializeOriginalValues();
            initializeAboutTab();
        } catch (error) {
            console.error('Failed to initialize options page:', error);
            showStatus('error', 'Failed to load configuration');
        }
    }

    function setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.nav-tab');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                
                // Remove active class from all tabs and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                button.classList.add('active');
                document.getElementById(`tab-${tabId}`).classList.add('active');
            });
        });
    }

    async function loadConfiguration() {
        currentConfig = await configUtils.getConfig();
        // Populate performance settings
        document.getElementById('max-links').value = currentConfig.performance?.maxLinksPerScan || 1000;
        document.getElementById('chunk-size').value = currentConfig.performance?.chunkSize || 100;
        document.getElementById('debounce-delay').value = currentConfig.performance?.debounceDelay || 500;
        // Populate theme settings
        document.getElementById('force-dark-mode').checked = currentConfig.theme?.forceDarkMode || false;
        // Populate language selector
        const lang = currentConfig.language || 'en';
        const langSelector = document.getElementById('language-selector');
        if (langSelector) langSelector.value = lang;
    }

    async function loadDuplicateStats() {
        try {
            const count = await duplicateTracker.getHashCount();
            document.getElementById('tracked-count').textContent = count;
            
            const data = await chrome.storage.local.get(['duplicateTracking']);
            const lastCleared = data.duplicateTracking?.lastCleared;
            
            if (lastCleared) {
                const date = new Date(lastCleared).toLocaleDateString();
                document.getElementById('last-cleanup').textContent = date;
            }
        } catch (error) {
            console.error('Failed to load duplicate stats:', error);
        }
    }

    function setupEventListeners() {
        // Handler configuration
        document.getElementById('handler-selector').addEventListener('change', onHandlerChange);
        document.getElementById('test-connection').addEventListener('click', testConnection);
        
        // Unified save button
        document.getElementById('save-all-settings').addEventListener('click', saveAllSettings);
        
        // Pattern management
        document.getElementById('add-pattern').addEventListener('click', () => openPatternModal());
        
        // Filter management
        document.getElementById('add-filter').addEventListener('click', () => openFilterModal());
        
                // Duplicate tracking
        document.getElementById('cleanup-duplicates').addEventListener('click', cleanupDuplicates);
        document.getElementById('clear-duplicates').addEventListener('click', clearAllDuplicates);
        
        // Track changes to enable save button
        setupChangeTracking();
    // Save language and theme
    async function saveThemeAndLanguageSettings() {
        const button = document.getElementById('save-theme');
        button.disabled = true;
        try {
            const themeConfig = {
                forceDarkMode: document.getElementById('force-dark-mode').checked
            };
            const langSelector = document.getElementById('language-selector');
            const selectedLang = langSelector ? langSelector.value : 'en';
            currentConfig.theme = themeConfig;
            currentConfig.language = selectedLang;
            await configUtils.setConfig(currentConfig);
            showStatus('success', 'Theme and language settings saved successfully!');
            // Re-localize the page with the new language
            setTimeout(async () => {
                await localizeOptionsPage();
            }, 800);
        } catch (error) {
            showStatus('error', `Failed to save settings: ${error.message}`);
        } finally {
            button.disabled = false;
        }
    }
        
        // Settings import/export
        document.getElementById('export-settings').addEventListener('click', exportSettings);
        document.getElementById('import-settings').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        document.getElementById('import-file').addEventListener('change', importSettings);
        
        // Modal controls
        document.querySelectorAll('.modal-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) modal.style.display = 'none';
            });
        });
        
        document.getElementById('cancel-pattern').addEventListener('click', closePatternModal);
        document.getElementById('save-pattern').addEventListener('click', savePattern);
        
        // Filter modal controls
        document.getElementById('cancel-filter').addEventListener('click', closeFilterModal);
        document.getElementById('save-filter').addEventListener('click', saveFilter);
        
        // Pattern validation
        document.getElementById('pattern-regex').addEventListener('input', validatePattern);
        
        // Filter validation
        document.getElementById('filter-regex').addEventListener('input', validateFilter);
        
        // Close modal when clicking outside
        document.getElementById('pattern-modal').addEventListener('click', (e) => {
            if (e.target.id === 'pattern-modal') {
                closePatternModal();
            }
        });
        
        document.getElementById('filter-modal').addEventListener('click', (e) => {
            if (e.target.id === 'filter-modal') {
                closeFilterModal();
            }
        });
    }

    function setupHandlerSelector() {
        const selector = document.getElementById('handler-selector');
        selector.innerHTML = '';
        
        availableHandlers.forEach(handler => {
            const option = document.createElement('option');
            option.value = handler.id;
            option.textContent = handler.name;
            selector.appendChild(option);
        });
        
        // Set current selection
        selector.value = currentConfig.selectedHandler || 'qbittorrent';
        updateHandlerDescription();
    }

    function onHandlerChange() {
        const selectedHandler = document.getElementById('handler-selector').value;
        currentConfig.selectedHandler = selectedHandler;
        updateHandlerDescription();
        renderHandlerConfig();
    }

    function updateHandlerDescription() {
        const selectedHandler = document.getElementById('handler-selector').value;
        const handler = availableHandlers.find(h => h.id === selectedHandler);
        const description = document.getElementById('handler-description');
        
        if (handler) {
            description.textContent = handler.description;
        }
    }

    function renderHandlerConfig() {
        const selectedHandler = document.getElementById('handler-selector').value;
        const handler = availableHandlers.find(h => h.id === selectedHandler);
        const content = document.getElementById('handler-config-content');
        const title = document.getElementById('handler-config-title');
        
        if (!handler) return;
        
        title.textContent = `${handler.name} Configuration`;
        content.innerHTML = '';
        
        if (handler.fields.length === 0) {
            content.innerHTML = '<p>No configuration required for this handler.</p>';
            return;
        }
        
        const config = currentConfig.handlers?.[selectedHandler] || {};
        
        handler.fields.forEach(field => {
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group';
            
            let fieldHtml = '';
            switch (field) {
                case 'url':
                    fieldHtml = `
                        <label for="handler-url">Server URL</label>
                        <input type="url" id="handler-url" class="form-control" value="${config.url || ''}" placeholder="http://localhost:8080">
                        <small class="form-text">The URL of your ${handler.name} server</small>
                    `;
                    break;
                case 'username':
                    fieldHtml = `
                        <label for="handler-username">Username</label>
                        <input type="text" id="handler-username" class="form-control" value="${config.username || ''}" placeholder="admin">
                    `;
                    break;
                case 'password':
                    fieldHtml = `
                        <label for="handler-password">Password</label>
                        <input type="password" id="handler-password" class="form-control" value="${config.password || ''}" placeholder="Password">
                    `;
                    break;
                case 'defaultLabel':
                    fieldHtml = `
                        <label for="handler-defaultLabel">Default Label/Category</label>
                        <input type="text" id="handler-defaultLabel" class="form-control" value="${config.defaultLabel || ''}" placeholder="e.g., Movies, TV Shows">
                        <small class="form-text">Optional: Default label/category to assign to torrents (leave empty for none)</small>
                    `;
                    break;
            }
            
            formGroup.innerHTML = fieldHtml;
            content.appendChild(formGroup);
        });
        
        // Reinitialize original values for new handler fields
        setTimeout(() => {
            const handlerInputs = document.querySelectorAll('[id^="handler-"]');
            handlerInputs.forEach(input => {
                const value = input.type === 'checkbox' ? input.checked : input.value;
                originalValues.set(input.id, value);
                
                // Add change listeners to new fields
                const eventType = input.type === 'checkbox' ? 'change' : 'input';
                input.addEventListener(eventType, () => {
                    checkForChanges();
                });
            });
        }, 10);
    }

    function renderPatterns() {
        const patternList = document.getElementById('pattern-list');
        patternList.innerHTML = '';
        
        currentConfig.patterns.forEach(pattern => {
            const patternElement = createPatternElement(pattern);
            patternList.appendChild(patternElement);
        });
    }

    function createPatternElement(pattern) {
        const div = document.createElement('div');
        div.className = 'pattern-item';
        
        div.innerHTML = `
            <div class="pattern-item-header">
                <div class="pattern-info">
                    <h4>${escapeHtml(pattern.name)}</h4>
                    ${pattern.builtin ? '<span class="pattern-badge">Built-in</span>' : ''}
                </div>
                <div class="pattern-controls">
                    ${!pattern.builtin ? `<button class="btn btn-secondary edit-pattern-btn" data-pattern-id="${pattern.id}"><span class="icon icon-edit icon-sm"></span> Edit</button>` : ''}
                    ${!pattern.builtin ? `<button class="btn btn-danger delete-pattern-btn" data-pattern-id="${pattern.id}"><span class="icon icon-trash icon-sm"></span> Delete</button>` : ''}
                </div>
            </div>
            <div class="pattern-regex">${escapeHtml(pattern.regex)}</div>
            <div class="form-group">
                <label class="switch">
                    <input type="checkbox" ${pattern.enabled ? 'checked' : ''} 
                           class="pattern-toggle-checkbox" data-pattern-id="${pattern.id}">
                    <span class="slider"></span>
                </label>
                <div class="switch-label">
                    <strong>Enabled</strong>
                </div>
            </div>
        `;
        
        // Add event listeners to the buttons
        const editBtn = div.querySelector('.edit-pattern-btn');
        const deleteBtn = div.querySelector('.delete-pattern-btn');
        const toggleCheckbox = div.querySelector('.pattern-toggle-checkbox');
        
        if (editBtn) {
            editBtn.addEventListener('click', () => editPattern(pattern.id));
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => deletePattern(pattern.id));
        }
        
        if (toggleCheckbox) {
            toggleCheckbox.addEventListener('change', (e) => togglePattern(pattern.id, e.target.checked));
        }
        
        return div;
    }

    async function testConnection() {
        const button = document.getElementById('test-connection');
        const status = document.getElementById('connection-status');
        
        button.disabled = true;
        button.textContent = 'Testing...';
        
        try {
            const selectedHandler = document.getElementById('handler-selector').value;
            const handler = availableHandlers.find(h => h.id === selectedHandler);
            
            if (!handler) {
                throw new Error('No handler selected');
            }
            
            const handlerConfig = {};
            
            // Collect configuration from form fields
            handler.fields.forEach(field => {
                const element = document.getElementById(`handler-${field}`);
                if (element) {
                    handlerConfig[field] = element.value;
                }
            });
            
            // Validate required fields
            const requiredFields = handler.fields.filter(field => field !== 'timeout' && field !== 'defaultLabel');
            const missingFields = requiredFields.filter(field => !handlerConfig[field]);
            
            if (missingFields.length > 0 && handler.requiresAuth) {
                throw new Error(`Please fill in all required fields: ${missingFields.join(', ')}`);
            }
            
            const response = await chrome.runtime.sendMessage({
                type: 'TEST_CONNECTION',
                handlerType: selectedHandler,
                config: handlerConfig
            });
            
            if (response.success) {
                showStatus('success', response.message || 'Connection successful!', status);
            } else {
                let errorMessage = `Connection failed: ${response.error}`;
                if (response.suggestions && response.suggestions.length > 0) {
                    errorMessage += '\n\nTroubleshooting suggestions:\n' + response.suggestions.join('\n');
                }
                showStatus('error', errorMessage, status);
            }
        } catch (error) {
            showStatus('error', `Connection failed: ${error.message}`, status);
        } finally {
            button.disabled = false;
            button.textContent = 'Test Connection';
        }
    }

    async function saveHandlerConfig() {
        const button = document.getElementById('save-handler-config');
        const status = document.getElementById('connection-status');
        
        button.disabled = true;
        
        try {
            const selectedHandler = document.getElementById('handler-selector').value;
            const handler = availableHandlers.find(h => h.id === selectedHandler);
            
            if (!handler) {
                throw new Error('No handler selected');
            }
            
            const handlerConfig = {};
            
            // Collect configuration from form fields
            handler.fields.forEach(field => {
                const element = document.getElementById(`handler-${field}`);
                if (element) {
                    if (field === 'url') {
                        handlerConfig[field] = element.value.replace(/\/$/, '');
                    } else {
                        handlerConfig[field] = element.value;
                    }
                }
            });
            
            // Set default timeout if not provided
            if (!handlerConfig.timeout) {
                handlerConfig.timeout = 30000;
            }
            
            // Save handler configuration and selection
            await configUtils.updateHandlerConfig(selectedHandler, handlerConfig);
            await configUtils.setSelectedHandler(selectedHandler);
            currentConfig = await configUtils.getConfig();
            
            // Notify background script to update context menus
            try {
                await chrome.runtime.sendMessage({
                    type: 'HANDLER_CONFIG_CHANGED',
                    handlerType: selectedHandler
                });
            } catch (error) {
            }
            
            showStatus('success', 'Configuration saved successfully!', status);
        } catch (error) {
            showStatus('error', `Failed to save configuration: ${error.message}`, status);
        } finally {
            button.disabled = false;
        }
    }

    async function savePerformanceSettings() {
        const button = document.getElementById('save-performance');
        
        button.disabled = true;
        
        try {
            const performanceConfig = {
                maxLinksPerScan: parseInt(document.getElementById('max-links').value),
                chunkSize: parseInt(document.getElementById('chunk-size').value),
                debounceDelay: parseInt(document.getElementById('debounce-delay').value)
            };
            
            currentConfig.performance = performanceConfig;
            await configUtils.setConfig(currentConfig);
            
            showStatus('success', 'Performance settings saved successfully!');
        } catch (error) {
            showStatus('error', `Failed to save performance settings: ${error.message}`);
        } finally {
            button.disabled = false;
        }
    }

    async function saveThemeSettings() {
        const button = document.getElementById('save-theme');
        
        button.disabled = true;
        
        try {
            const themeConfig = {
                forceDarkMode: document.getElementById('force-dark-mode').checked
            };
            
            currentConfig.theme = themeConfig;
            await configUtils.setConfig(currentConfig);
            
            showStatus('success', 'Theme settings saved successfully!');
        } catch (error) {
            showStatus('error', `Failed to save theme settings: ${error.message}`);
        } finally {
            button.disabled = false;
        }
    }

    function setupChangeTracking() {
        // Get all form inputs that should be tracked
        const trackableSelectors = [
            '#handler-selector',
            '[id^="handler-"]',
            '#max-links',
            '#chunk-size', 
            '#debounce-delay',
            '#force-dark-mode',
            '#language-selector'
        ];

        // Store original values
        trackableSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (element) {
                    const value = element.type === 'checkbox' ? element.checked : element.value;
                    originalValues.set(element.id, value);
                }
            });
        });

        // Add event listeners for changes
        trackableSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (element) {
                    const eventType = element.type === 'checkbox' ? 'change' : 
                                    (element.tagName === 'SELECT' ? 'change' : 'input');
                    
                    element.addEventListener(eventType, () => {
                        checkForChanges();
                    });
                }
            });
        });

        // Also track dynamically added handler fields
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const handlerInputs = node.querySelectorAll('[id^="handler-"]');
                            handlerInputs.forEach(input => {
                                const eventType = input.type === 'checkbox' ? 'change' : 'input';
                                input.addEventListener(eventType, () => {
                                    checkForChanges();
                                });
                            });
                        }
                    });
                }
            });
        });

        observer.observe(document.getElementById('handler-config-content'), {
            childList: true,
            subtree: true
        });
    }

    function initializeOriginalValues() {
        // Wait a bit for dynamic content to load, then initialize values
        setTimeout(() => {
            const trackableSelectors = [
                '#handler-selector',
                '[id^="handler-"]',
                '#max-links',
                '#chunk-size', 
                '#debounce-delay',
                '#force-dark-mode',
                '#language-selector'
            ];

            // Store original values
            trackableSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element) {
                        const value = element.type === 'checkbox' ? element.checked : element.value;
                        originalValues.set(element.id, value);
                    }
                });
            });
        }, 100);
    }

    function checkForChanges() {
        const saveButton = document.getElementById('save-all-settings');
        let hasChanges = false;

        // Check all tracked elements for changes
        originalValues.forEach((originalValue, elementId) => {
            const element = document.getElementById(elementId);
            if (element) {
                const currentValue = element.type === 'checkbox' ? element.checked : element.value;
                if (currentValue !== originalValue) {
                    hasChanges = true;
                }
            }
        });

        // Check dynamically added handler fields
        const handlerInputs = document.querySelectorAll('[id^="handler-"]');
        handlerInputs.forEach(input => {
            if (!originalValues.has(input.id)) {
                // New field, store its current value as original
                const value = input.type === 'checkbox' ? input.checked : input.value;
                originalValues.set(input.id, value);
            } else {
                const originalValue = originalValues.get(input.id);
                const currentValue = input.type === 'checkbox' ? input.checked : input.value;
                if (currentValue !== originalValue) {
                    hasChanges = true;
                }
            }
        });

        hasUnsavedChanges = hasChanges;
        saveButton.disabled = !hasChanges;
        
        // Add visual indicator for unsaved changes
        if (hasChanges) {
            saveButton.classList.add('btn-highlight');
        } else {
            saveButton.classList.remove('btn-highlight');
        }
    }

    async function saveAllSettings() {
        const saveButton = document.getElementById('save-all-settings');
        
        if (!hasUnsavedChanges) {
            return;
        }

        saveButton.disabled = true;
        
        try {
            // Save handler configuration
            await saveHandlerConfigInternal();

            // Save performance settings  
            await savePerformanceSettingsInternal();

            // Save theme and language settings
            const prevLang = currentConfig.language;
            await saveThemeAndLanguageSettingsInternal();

            // Update original values to current values
            updateOriginalValues();

            hasUnsavedChanges = false;
            saveButton.classList.remove('btn-highlight');

            showStatus('success', 'All settings saved successfully!');

            // If language changed, reload the page to fully apply new language
            const newLang = currentConfig.language;
            if (prevLang !== newLang) {
                setTimeout(() => {
                    window.location.reload();
                }, 800);
            }
        } catch (error) {
            showStatus('error', `Failed to save settings: ${error.message}`);
        } finally {
            saveButton.disabled = !hasUnsavedChanges;
        }
    }

    function updateOriginalValues() {
        originalValues.forEach((value, elementId) => {
            const element = document.getElementById(elementId);
            if (element) {
                const currentValue = element.type === 'checkbox' ? element.checked : element.value;
                originalValues.set(elementId, currentValue);
            }
        });

        // Also update handler fields
        const handlerInputs = document.querySelectorAll('[id^="handler-"]');
        handlerInputs.forEach(input => {
            const value = input.type === 'checkbox' ? input.checked : input.value;
            originalValues.set(input.id, value);
        });
    }

    // Internal save functions (without button state management)
    async function saveHandlerConfigInternal() {
        const selectedHandler = document.getElementById('handler-selector').value;
        const handler = availableHandlers.find(h => h.id === selectedHandler);
        
        if (!handler) {
            throw new Error('No handler selected');
        }
        
        const handlerConfig = {};
        
        // Collect configuration from form fields
        handler.fields.forEach(field => {
            const element = document.getElementById(`handler-${field}`);
            if (element) {
                if (field === 'url') {
                    handlerConfig[field] = element.value.replace(/\/$/, '');
                } else {
                    handlerConfig[field] = element.value;
                }
            }
        });
        // Persist using configUtils helpers to ensure proper nested structure
        await configUtils.updateHandlerConfig(selectedHandler, handlerConfig);
        await configUtils.setSelectedHandler(selectedHandler);
        currentConfig = await configUtils.getConfig();
    }

    async function savePerformanceSettingsInternal() {
        const performanceConfig = {
            maxLinksPerScan: parseInt(document.getElementById('max-links').value),
            chunkSize: parseInt(document.getElementById('chunk-size').value),
            debounceDelay: parseInt(document.getElementById('debounce-delay').value)
        };
        
        currentConfig.performance = performanceConfig;
        await configUtils.setConfig(currentConfig);
    }

    async function saveThemeAndLanguageSettingsInternal() {
        const themeConfig = {
            forceDarkMode: document.getElementById('force-dark-mode').checked
        };
        const langSelector = document.getElementById('language-selector');
        const selectedLang = langSelector ? langSelector.value : 'en';
        
        currentConfig.theme = themeConfig;
        currentConfig.language = selectedLang;
        await configUtils.setConfig(currentConfig);
        
        // Re-localize the page with the new language if changed
        const currentLang = await configUtils.getConfig().then(c => c.language || 'en');
        if (selectedLang !== currentLang) {
            setTimeout(async () => {
                await localizeOptionsPage();
            }, 800);
        }
    }

    function openPatternModal(patternId = null) {
        currentPatternId = patternId;
        const modal = document.getElementById('pattern-modal');
        const title = document.getElementById('modal-title');
        
        if (patternId) {
            const pattern = currentConfig.patterns.find(p => p.id === patternId);
            title.textContent = 'Edit Pattern';
            document.getElementById('pattern-name').value = pattern.name;
            document.getElementById('pattern-regex').value = pattern.regex;
            document.getElementById('pattern-enabled').checked = pattern.enabled;
        } else {
            title.textContent = 'Add Pattern';
            document.getElementById('pattern-name').value = '';
            document.getElementById('pattern-regex').value = '';
            document.getElementById('pattern-enabled').checked = true;
        }
        
        document.getElementById('pattern-validation').innerHTML = '';
        modal.style.display = 'block';
    }

    function closePatternModal() {
        document.getElementById('pattern-modal').style.display = 'none';
        currentPatternId = null;
    }

    function validatePattern() {
        const regex = document.getElementById('pattern-regex').value;
        const validation = document.getElementById('pattern-validation');
        
        if (!regex) {
            validation.innerHTML = '';
            return;
        }
        
        const result = configUtils.validateRegexPattern(regex);
        
        if (result.valid) {
            showStatus('success', 'Valid regex pattern', validation);
        } else {
            showStatus('error', `Invalid regex: ${result.error}`, validation);
        }
    }

    async function savePattern() {
        const name = document.getElementById('pattern-name').value.trim();
        const regex = document.getElementById('pattern-regex').value.trim();
        const enabled = document.getElementById('pattern-enabled').checked;
        
        if (!name || !regex) {
            showStatus('error', 'Please fill in all fields', document.getElementById('pattern-validation'));
            return;
        }
        
        const validation = configUtils.validateRegexPattern(regex);
        if (!validation.valid) {
            showStatus('error', `Invalid regex: ${validation.error}`, document.getElementById('pattern-validation'));
            return;
        }
        
        try {
            if (currentPatternId) {
                await configUtils.updatePattern(currentPatternId, { name, regex, enabled });
            } else {
                await configUtils.addPattern({ name, regex, enabled });
            }
            
            currentConfig = await configUtils.getConfig();
            renderPatterns();
            closePatternModal();
            
            // Notify content scripts of pattern changes
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { type: 'CONFIG_UPDATED' }).catch(() => {
                        // Ignore errors for tabs that don't have content scripts
                    });
                });
            });
            
            showStatus('success', 'Pattern saved successfully!');
        } catch (error) {
            showStatus('error', `Failed to save pattern: ${error.message}`, document.getElementById('pattern-validation'));
        }
    }

    async function cleanupDuplicates() {
        const button = document.getElementById('cleanup-duplicates');
        button.disabled = true;
        button.textContent = 'Cleaning...';
        
        try {
            await duplicateTracker.cleanupOldHashes();
            await loadDuplicateStats();
            showStatus('success', 'Cleanup completed successfully!');
        } catch (error) {
            showStatus('error', `Cleanup failed: ${error.message}`);
        } finally {
            button.disabled = false;
            button.textContent = 'Cleanup Old Entries';
        }
    }

    async function clearAllDuplicates() {
        if (!confirm('Are you sure you want to clear all duplicate tracking? This cannot be undone.')) {
            return;
        }
        
        const button = document.getElementById('clear-duplicates');
        button.disabled = true;
        
        try {
            await duplicateTracker.clearAll();
            await loadDuplicateStats();
            showStatus('success', 'All duplicate tracking cleared!');
        } catch (error) {
            showStatus('error', `Failed to clear duplicates: ${error.message}`);
        } finally {
            button.disabled = false;
        }
    }

    // Global functions for pattern management
    window.editPattern = (patternId) => {
        openPatternModal(patternId);
    };

    window.deletePattern = async (patternId) => {
        if (!confirm('Are you sure you want to delete this pattern?')) {
            return;
        }
        
        try {
            await configUtils.removePattern(patternId);
            currentConfig = await configUtils.getConfig();
            renderPatterns();
            showStatus('success', 'Pattern deleted successfully!');
        } catch (error) {
            showStatus('error', `Failed to delete pattern: ${error.message}`);
        }
    };

    window.togglePattern = async (patternId, enabled) => {
        try {
            await configUtils.updatePattern(patternId, { enabled });
            currentConfig = await configUtils.getConfig();
            
            // Notify content scripts of pattern changes
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { type: 'CONFIG_UPDATED' }).catch(() => {
                        // Ignore errors for tabs that don't have content scripts
                    });
                });
            });
            
            showStatus('success', `Pattern ${enabled ? 'enabled' : 'disabled'} successfully!`);
        } catch (error) {
            showStatus('error', `Failed to update pattern: ${error.message}`);
        }
    };

    // Utility functions
    function showStatus(type, message, element = null) {
        const statusElement = element || createTempStatusElement();
        statusElement.className = `status-message ${type}`;
        statusElement.textContent = message;
        statusElement.style.display = 'block';
        
        if (!element) {
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 5000);
        }
    }

    function createTempStatusElement() {
        let statusElement = document.getElementById('temp-status');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'temp-status';
            statusElement.style.position = 'fixed';
            statusElement.style.top = '20px';
            statusElement.style.right = '20px';
            statusElement.style.zIndex = '10000';
            statusElement.style.maxWidth = '300px';
            document.body.appendChild(statusElement);
        }
        return statusElement;
    }

    // Pattern management functions
    function editPattern(patternId) {
        openPatternModal(patternId);
    }

    async function deletePattern(patternId) {
        if (confirm('Are you sure you want to delete this pattern?')) {
            try {
                await configUtils.removePattern(patternId);
                currentConfig = await configUtils.getConfig();
                renderPatterns();
                
                // Notify content scripts of pattern changes
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, { type: 'CONFIG_UPDATED' }).catch(() => {
                            // Ignore errors for tabs that don't have content scripts
                        });
                    });
                });
                
                showStatus('success', 'Pattern deleted successfully!');
            } catch (error) {
                showStatus('error', `Failed to delete pattern: ${error.message}`);
            }
        }
    }

    async function togglePattern(patternId, enabled) {
        try {
            // Show immediate feedback
            const statusContainer = document.createElement('div');
            statusContainer.className = 'status-message info';
            statusContainer.textContent = `${enabled ? 'Enabling' : 'Disabling'} pattern...`;
            statusContainer.style.position = 'fixed';
            statusContainer.style.top = '20px';
            statusContainer.style.right = '20px';
            statusContainer.style.zIndex = '10001';
            document.body.appendChild(statusContainer);
            
            await configUtils.updatePattern(patternId, { enabled });
            currentConfig = await configUtils.getConfig();
            
            // Update the visual state immediately
            renderPatterns();
            
            // Notify content scripts of pattern changes
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { type: 'CONFIG_UPDATED' }).catch(() => {
                        // Ignore errors for tabs that don't have content scripts
                    });
                });
            });
            
            // Show success message
            document.body.removeChild(statusContainer);
            showStatus('success', `Pattern ${enabled ? 'enabled' : 'disabled'} and saved successfully!`);
        } catch (error) {
            showStatus('error', `Failed to update pattern: ${error.message}`);
        }
    }

    // Filter management functions
    let currentFilterId = null;

    function renderFilters() {
        const filterList = document.getElementById('filter-list');
        filterList.innerHTML = '';
        
        if (!currentConfig.filters) {
            currentConfig.filters = [];
        }
        
        currentConfig.filters.forEach(filter => {
            const filterElement = createFilterElement(filter);
            filterList.appendChild(filterElement);
        });
    }

    function createFilterElement(filter) {
        const div = document.createElement('div');
        div.className = 'pattern-item'; // Reuse pattern styling
        
        div.innerHTML = `
            <div class="pattern-item-header">
                <div class="pattern-info">
                    <h4>${escapeHtml(filter.name)}</h4>
                    ${filter.builtin ? '<span class="pattern-badge">Built-in</span>' : ''}
                </div>
                <div class="pattern-controls">
                    ${!filter.builtin ? `<button class="btn btn-secondary edit-filter-btn" data-filter-id="${filter.id}"><span class="icon icon-edit icon-sm"></span> Edit</button>` : ''}
                    ${!filter.builtin ? `<button class="btn btn-danger delete-filter-btn" data-filter-id="${filter.id}"><span class="icon icon-trash icon-sm"></span> Delete</button>` : ''}
                </div>
            </div>
            <div class="pattern-regex">${escapeHtml(filter.regex)}</div>
            <div class="form-group">
                <label class="switch">
                    <input type="checkbox" ${filter.enabled ? 'checked' : ''} 
                           class="filter-toggle-checkbox" data-filter-id="${filter.id}">
                    <span class="slider"></span>
                </label>
                <div class="switch-label">
                    <strong>Enabled</strong>
                </div>
            </div>
        `;
        
        // Add event listeners to the buttons
        const editBtn = div.querySelector('.edit-filter-btn');
        const deleteBtn = div.querySelector('.delete-filter-btn');
        const toggleCheckbox = div.querySelector('.filter-toggle-checkbox');
        
        if (editBtn) {
            editBtn.addEventListener('click', () => editFilter(filter.id));
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => deleteFilter(filter.id));
        }
        
        if (toggleCheckbox) {
            toggleCheckbox.addEventListener('change', (e) => toggleFilter(filter.id, e.target.checked));
        }
        
        return div;
    }

    function openFilterModal(filterId = null) {
        currentFilterId = filterId;
        const modal = document.getElementById('filter-modal');
        const title = document.getElementById('filter-modal-title');
        
        if (filterId) {
            const filter = currentConfig.filters.find(f => f.id === filterId);
            title.textContent = 'Edit Filter';
            document.getElementById('filter-name').value = filter.name;
            document.getElementById('filter-regex').value = filter.regex;
            document.getElementById('filter-enabled').checked = filter.enabled;
        } else {
            title.textContent = 'Add Filter';
            document.getElementById('filter-name').value = '';
            document.getElementById('filter-regex').value = '';
            document.getElementById('filter-enabled').checked = true;
        }
        
        document.getElementById('filter-validation').innerHTML = '';
        modal.style.display = 'block';
    }

    function closeFilterModal() {
        document.getElementById('filter-modal').style.display = 'none';
        currentFilterId = null;
    }

    function validateFilter() {
        const regex = document.getElementById('filter-regex').value;
        const validation = document.getElementById('filter-validation');
        
        if (!regex) {
            validation.innerHTML = '';
            return;
        }
        
        const result = configUtils.validateRegexPattern(regex);
        
        if (result.valid) {
            showStatus('success', 'Valid regex pattern', validation);
        } else {
            showStatus('error', `Invalid regex: ${result.error}`, validation);
        }
    }

    async function saveFilter() {
        const name = document.getElementById('filter-name').value.trim();
        const regex = document.getElementById('filter-regex').value.trim();
        const enabled = document.getElementById('filter-enabled').checked;
        
        if (!name || !regex) {
            showStatus('error', 'Please fill in all fields', document.getElementById('filter-validation'));
            return;
        }
        
        const validation = configUtils.validateRegexPattern(regex);
        if (!validation.valid) {
            showStatus('error', `Invalid regex: ${validation.error}`, document.getElementById('filter-validation'));
            return;
        }
        
        try {
            if (currentFilterId) {
                await configUtils.updateFilter(currentFilterId, { name, regex, enabled });
            } else {
                await configUtils.addFilter({ name, regex, enabled });
            }
            
            currentConfig = await configUtils.getConfig();
            renderFilters();
            closeFilterModal();
            
            // Notify content scripts of filter changes
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { type: 'CONFIG_UPDATED' }).catch(() => {
                        // Ignore errors for tabs that don't have content scripts
                    });
                });
            });
            
            showStatus('success', 'Filter saved successfully!');
        } catch (error) {
            showStatus('error', `Failed to save filter: ${error.message}`, document.getElementById('filter-validation'));
        }
    }

    function editFilter(filterId) {
        openFilterModal(filterId);
    }

    async function deleteFilter(filterId) {
        if (confirm('Are you sure you want to delete this filter?')) {
            try {
                await configUtils.removeFilter(filterId);
                currentConfig = await configUtils.getConfig();
                renderFilters();
                
                // Notify content scripts of filter changes
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, { type: 'CONFIG_UPDATED' }).catch(() => {
                            // Ignore errors for tabs that don't have content scripts
                        });
                    });
                });
                
                showStatus('success', 'Filter deleted successfully!');
            } catch (error) {
                showStatus('error', `Failed to delete filter: ${error.message}`);
            }
        }
    }

    async function toggleFilter(filterId, enabled) {
        try {
            await configUtils.updateFilter(filterId, { enabled });
            currentConfig = await configUtils.getConfig();
            
            // Update the visual state immediately
            renderFilters();
            
            // Notify content scripts of filter changes
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { type: 'CONFIG_UPDATED' }).catch(() => {
                        // Ignore errors for tabs that don't have content scripts
                    });
                });
            });
            
            showStatus('success', `Filter ${enabled ? 'enabled' : 'disabled'} successfully!`);
        } catch (error) {
            showStatus('error', `Failed to update filter: ${error.message}`);
        }
    }

    // Settings Import/Export functions
    async function exportSettings() {
        const button = document.getElementById('export-settings');
        const status = document.getElementById('import-export-status');
        
        button.disabled = true;
        button.textContent = 'Exporting...';
        
        try {
            const settingsJson = await configUtils.exportSettings();
            
            // Create and trigger download
            const blob = new Blob([settingsJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `torrent-snag-settings-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showStatus('success', 'Settings exported successfully!', status);
        } catch (error) {
            showStatus('error', `Failed to export settings: ${error.message}`, status);
        } finally {
            button.disabled = false;
            button.textContent = 'Export Settings';
        }
    }

    async function importSettings(event) {
        const file = event.target.files[0];
        const status = document.getElementById('import-export-status');
        
        if (!file) return;
        
        // Reset file input
        event.target.value = '';
        
        try {
            const fileContent = await readFileAsText(file);
            const result = await configUtils.importSettings(fileContent);
            
            if (result.success) {
                // Reload configuration and update UI
                currentConfig = await configUtils.getConfig();
                await loadConfiguration();
                setupHandlerSelector();
                renderHandlerConfig();
                renderPatterns();
                renderFilters();
                
                // Notify content scripts of changes
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, { type: 'CONFIG_UPDATED' }).catch(() => {
                            // Ignore errors for tabs that don't have content scripts
                        });
                    });
                });
                
                const imported = result.imported;
                const importSummary = [
                    imported.patterns > 0 ? `${imported.patterns} custom patterns` : null,
                    imported.filters > 0 ? `${imported.filters} custom filters` : null,
                    imported.performance ? 'performance settings' : null,
                    imported.theme ? 'theme settings' : null,
                    imported.handlers ? 'handler configurations' : null,
                    imported.selectedHandler ? 'selected handler' : null
                ].filter(Boolean).join(', ');
                
                showStatus('success', 
                    `Settings imported successfully! ${importSummary ? `Imported: ${importSummary}` : 'No custom settings found.'}`, 
                    status
                );
            } else {
                showStatus('error', `Import failed: ${result.error}`, status);
            }
        } catch (error) {
            showStatus('error', `Failed to read file: ${error.message}`, status);
        }
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize About Tab with system information
    async function initializeAboutTab() {
        try {
            // Get extension version from manifest
            const manifest = chrome.runtime.getManifest();
            document.getElementById('extension-version').textContent = manifest.version;

            // Get browser version
            const browserInfo = await chrome.runtime.getPlatformInfo();
            const browserVersionElement = document.getElementById('browser-version');
            browserVersionElement.textContent = `Chrome ${navigator.userAgent.match(/Chrome\/([^\s]+)/)?.[1] || 'Unknown'}`;
            browserVersionElement.removeAttribute('data-i18n');

            // Get extension ID
            const extensionIdElement = document.getElementById('extension-id');
            extensionIdElement.textContent = chrome.runtime.id;
            extensionIdElement.removeAttribute('data-i18n');

            // Get install type
            const extensionInfo = await chrome.management.getSelf();
            const installType = extensionInfo.installType;
            let installTypeKey = 'installTypeUnknown';
            switch (installType) {
                case 'normal':
                    installTypeKey = 'installTypeWebStore';
                    break;
                case 'development':
                    installTypeKey = 'installTypeDevelopment';
                    break;
                case 'sideload':
                    installTypeKey = 'installTypeSideloaded';
                    break;
                case 'admin':
                    installTypeKey = 'installTypeAdmin';
                    break;
            }
            const installTypeElement = document.getElementById('install-type');
            
            // Get localized text for install type
            const config = await configUtils.getConfig();
            const lang = config.language || 'en';
            let installTypeText = installType; // fallback
            
            if (lang === 'en') {
                installTypeText = chrome.i18n.getMessage(installTypeKey) || installType;
            } else {
                try {
                    const resp = await fetch(`../_locales/${lang}/messages.json`);
                    const messages = await resp.json();
                    installTypeText = messages[installTypeKey]?.message || installType;
                } catch (e) {
                    // Use English fallback
                    installTypeText = chrome.i18n.getMessage(installTypeKey) || installType;
                }
            }
            
            installTypeElement.textContent = installTypeText;
            installTypeElement.removeAttribute('data-i18n');

        } catch (error) {
            console.error('Failed to initialize About tab:', error);
            // Set fallback values and remove data-i18n attributes with localized "Unknown" text
            const config = await configUtils.getConfig();
            const lang = config.language || 'en';
            let unknownText = 'Unknown';
            
            if (lang === 'en') {
                unknownText = chrome.i18n.getMessage('installTypeUnknown') || 'Unknown';
            } else {
                try {
                    const resp = await fetch(`../_locales/${lang}/messages.json`);
                    const messages = await resp.json();
                    unknownText = messages['installTypeUnknown']?.message || 'Unknown';
                } catch (e) {
                    unknownText = chrome.i18n.getMessage('installTypeUnknown') || 'Unknown';
                }
            }
            
            const browserVersionElement = document.getElementById('browser-version');
            browserVersionElement.textContent = unknownText;
            browserVersionElement.removeAttribute('data-i18n');
            
            const extensionIdElement = document.getElementById('extension-id');
            extensionIdElement.textContent = unknownText;
            extensionIdElement.removeAttribute('data-i18n');
            
            const installTypeElement = document.getElementById('install-type');
            installTypeElement.textContent = unknownText;
            installTypeElement.removeAttribute('data-i18n');
        }
    }
})();
