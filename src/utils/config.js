// Configuration utilities for Torrent Snag extension

const DEFAULT_CONFIG = {
  selectedHandler: 'qbittorrent',
  language: 'en',
  handlers: {
    qbittorrent: {
      url: 'http://localhost:8080',
      username: '',
      password: '',
      timeout: 30000
    },
    transmission: {
      url: 'http://localhost:9091',
      username: '',
      password: '',
      timeout: 30000
    },
    deluge: {
      url: 'http://localhost:8112',
      password: '',
      timeout: 30000
    },
    download: {
      timeout: 30000
    }
  },
  patterns: [
    {
      id: 'magnet-links',
      name: 'Magnet Links',
      regex: 'magnet:\\?xt=urn:btih:[a-fA-F0-9]{40}[^\\s]*',
      enabled: true,
      builtin: true
    },
    {
      id: 'torrent-files',
      name: 'Torrent Files',
      regex: 'https?://[^\\s]*\\.torrent(?:\\?[^\\s]*)?',
      enabled: true,
      builtin: true
    },
    {
      id: 'html-torrent-downloads',
      name: 'HTML Torrent Downloads',
      regex: 'https?://[^\\s]*(?:/torrents?/download/|/download/[^\\s]*\\.html|/torrent/[^\\s]*\\.html|[?&]action=download)',
      enabled: true,
      builtin: true
    }
  ],
  performance: {
    maxLinksPerScan: 1000,
    chunkSize: 100,
    debounceDelay: 500,
    maxDuplicateEntries: 10000
  },
  filters: [
    {
      id: 'skip-greatest-hits',
      name: 'Skip Greatest Hits',
      regex: '\\b(greatest|hits)\\b',
      enabled: true,
      builtin: true
    },
    {
      id: 'skip-live-albums',
      name: 'Skip Live Albums',
      regex: '\\b(live|concert)\\b',
      enabled: true,
      builtin: true
    }
  ],
  theme: {
    forceDarkMode: false
  }
};

const configUtils = {
  async getConfig() {
    const data = await chrome.storage.local.get(['config']);
    return { ...DEFAULT_CONFIG, ...data.config };
  },

  async setConfig(config) {
    await chrome.storage.local.set({ config });
  },

  async updateHandlerConfig(handlerType, handlerConfig) {
    const config = await this.getConfig();
    config.handlers[handlerType] = { ...config.handlers[handlerType], ...handlerConfig };
    await this.setConfig(config);
  },

  async setSelectedHandler(handlerType) {
    const config = await this.getConfig();
    config.selectedHandler = handlerType;
    await this.setConfig(config);
  },

  async getSelectedHandlerConfig() {
    const config = await this.getConfig();
    return {
      type: config.selectedHandler,
      config: config.handlers[config.selectedHandler]
    };
  },

  async addPattern(pattern) {
    const config = await this.getConfig();
    const newPattern = {
      id: `custom-${Date.now()}`,
      name: pattern.name,
      regex: pattern.regex,
      enabled: true,
      builtin: false
    };
    config.patterns.push(newPattern);
    await this.setConfig(config);
    return newPattern;
  },

  async updatePattern(patternId, updates) {
    const config = await this.getConfig();
    const patternIndex = config.patterns.findIndex(p => p.id === patternId);
    if (patternIndex !== -1) {
      config.patterns[patternIndex] = { ...config.patterns[patternIndex], ...updates };
      await this.setConfig(config);
    }
  },

  async removePattern(patternId) {
    const config = await this.getConfig();
    config.patterns = config.patterns.filter(p => p.id !== patternId || p.builtin);
    await this.setConfig(config);
  },

  async addFilter(filter) {
    const config = await this.getConfig();
    const newFilter = {
      id: `filter-${Date.now()}`,
      name: filter.name,
      regex: filter.regex,
      enabled: true,
      builtin: false
    };
    config.filters.push(newFilter);
    await this.setConfig(config);
    return newFilter;
  },

  async updateFilter(filterId, updates) {
    const config = await this.getConfig();
    const filterIndex = config.filters.findIndex(f => f.id === filterId);
    if (filterIndex !== -1) {
      config.filters[filterIndex] = { ...config.filters[filterIndex], ...updates };
      await this.setConfig(config);
    }
  },

  async removeFilter(filterId) {
    const config = await this.getConfig();
    config.filters = config.filters.filter(f => f.id !== filterId || f.builtin);
    await this.setConfig(config);
  },

  validateRegexPattern(pattern) {
    try {
      const regex = new RegExp(pattern);
      
      // Test with known problematic patterns to prevent ReDoS
      const testString = 'a'.repeat(1000);
      const startTime = Date.now();
      
      regex.test(testString);
      
      const executionTime = Date.now() - startTime;
      if (executionTime > 100) {
        throw new Error('Regex pattern takes too long to execute');
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  },

  async exportSettings() {
    const config = await this.getConfig();
    
    // Create export data with metadata
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      extensionName: 'Torrent Snag',
      settings: {
        patterns: config.patterns,
        filters: config.filters,
        performance: config.performance,
        theme: config.theme,
        handlers: config.handlers,
        selectedHandler: config.selectedHandler,
        language: config.language || 'en'
      }
    };
    
    return JSON.stringify(exportData, null, 2);
  },

  async importSettings(jsonData) {
    try {
      const importData = JSON.parse(jsonData);
      
      // Validate import data structure
      if (!importData.settings) {
        throw new Error('Invalid settings file: missing settings data');
      }
      
      if (importData.extensionName && importData.extensionName !== 'Torrent Snag') {
        throw new Error('Settings file is not for Torrent Snag extension');
      }
      
      const currentConfig = await this.getConfig();
      
      // Merge imported settings with current config
      const newConfig = { ...currentConfig };
      
      // Import patterns (merge with existing, don't replace built-ins)
      if (importData.settings.patterns && Array.isArray(importData.settings.patterns)) {
        const importedPatterns = importData.settings.patterns.filter(p => 
          !p.builtin && p.name && p.regex && typeof p.enabled === 'boolean'
        );
        // Remove existing custom patterns
        newConfig.patterns = newConfig.patterns.filter(p => p.builtin);
        // Add imported custom patterns with new IDs to avoid conflicts
        importedPatterns.forEach(pattern => {
          newConfig.patterns.push({
            ...pattern,
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            builtin: false
          });
        });
      }
      
      // Import filters (same logic as patterns)
      if (importData.settings.filters && Array.isArray(importData.settings.filters)) {
        const importedFilters = importData.settings.filters.filter(f => 
          !f.builtin && f.name && f.regex && typeof f.enabled === 'boolean'
        );
        // Remove existing custom filters
        newConfig.filters = newConfig.filters.filter(f => f.builtin);
        // Add imported custom filters with new IDs
        importedFilters.forEach(filter => {
          newConfig.filters.push({
            ...filter,
            id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            builtin: false
          });
        });
      }
      
      // Import performance settings
      if (importData.settings.performance && typeof importData.settings.performance === 'object') {
        const perfSettings = importData.settings.performance;
        const validatedPerf = {};
        
        // Validate and clamp performance values
        if (typeof perfSettings.maxLinksPerScan === 'number') {
          validatedPerf.maxLinksPerScan = Math.max(100, Math.min(5000, perfSettings.maxLinksPerScan));
        }
        if (typeof perfSettings.chunkSize === 'number') {
          validatedPerf.chunkSize = Math.max(50, Math.min(500, perfSettings.chunkSize));
        }
        if (typeof perfSettings.debounceDelay === 'number') {
          validatedPerf.debounceDelay = Math.max(100, Math.min(2000, perfSettings.debounceDelay));
        }
        if (typeof perfSettings.maxDuplicateEntries === 'number') {
          validatedPerf.maxDuplicateEntries = Math.max(1000, Math.min(50000, perfSettings.maxDuplicateEntries));
        }
        
        newConfig.performance = { ...newConfig.performance, ...validatedPerf };
      }
      
      // Import theme settings
      if (importData.settings.theme && typeof importData.settings.theme === 'object') {
        const themeSettings = importData.settings.theme;
        if (typeof themeSettings.forceDarkMode === 'boolean') {
          newConfig.theme = { ...newConfig.theme, forceDarkMode: themeSettings.forceDarkMode };
        }
      }
      
      // Import handler configurations
      if (importData.settings.handlers && typeof importData.settings.handlers === 'object') {
        // Validate and import handler configurations
        const importedHandlers = {};
        for (const [handlerType, handlerConfig] of Object.entries(importData.settings.handlers)) {
          if (handlerConfig && typeof handlerConfig === 'object') {
            // Only import valid handler configurations
            const validHandlerTypes = ['qbittorrent', 'transmission', 'deluge', 'download'];
            if (validHandlerTypes.includes(handlerType)) {
              importedHandlers[handlerType] = { ...handlerConfig };
            }
          }
        }
        newConfig.handlers = { ...newConfig.handlers, ...importedHandlers };
      }
      
      // Import selected handler
      if (importData.settings.selectedHandler && typeof importData.settings.selectedHandler === 'string') {
        const validHandlerTypes = ['qbittorrent', 'transmission', 'deluge', 'download'];
        if (validHandlerTypes.includes(importData.settings.selectedHandler)) {
          newConfig.selectedHandler = importData.settings.selectedHandler;
        }
      }

      // Import language
      if (importData.settings.language && typeof importData.settings.language === 'string') {
        newConfig.language = importData.settings.language;
      }
      
      // Validate all regex patterns before saving
      const allPatterns = [...newConfig.patterns, ...newConfig.filters];
      for (const pattern of allPatterns) {
        const validation = this.validateRegexPattern(pattern.regex);
        if (!validation.valid) {
          throw new Error(`Invalid regex pattern in "${pattern.name}": ${validation.error}`);
        }
      }
      
      await this.setConfig(newConfig);
      
      return {
        success: true,
        imported: {
          patterns: importData.settings.patterns?.filter(p => !p.builtin && p.name && p.regex).length || 0,
          filters: importData.settings.filters?.filter(f => !f.builtin && f.name && f.regex).length || 0,
          performance: !!(importData.settings.performance && typeof importData.settings.performance === 'object'),
          theme: !!(importData.settings.theme && typeof importData.settings.theme === 'object'),
          handlers: !!(importData.settings.handlers && typeof importData.settings.handlers === 'object'),
          selectedHandler: !!(importData.settings.selectedHandler && typeof importData.settings.selectedHandler === 'string')
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.configUtils = configUtils;
  window.DEFAULT_CONFIG = DEFAULT_CONFIG;
}
