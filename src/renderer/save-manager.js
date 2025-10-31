/**
 * SaveStateManager - Handles communication between the game and Electron's save system
 * Manages game state synchronization, auto-save notifications, and save/load operations
 */
class SaveStateManager {
  constructor() {
    this.isElectron = typeof window.electronAPI !== 'undefined';
    this.gameStateCache = null;
    this.lastSaveTime = null;
    this.autoSaveEnabled = false;
    this.autoLoadEnabled = true; // Enable auto-load by default
    this.stateChangeListeners = [];
    this.saveStatusListeners = [];
    this.autoSaveEventListeners = [];
    
    // Debounce settings for state change detection
    this.stateChangeDebounceMs = 1000; // 1 second debounce
    this.stateChangeTimer = null;
    
    // Statistics
    this.stats = {
      totalSaves: 0,
      totalLoads: 0,
      lastSaveAttempt: null,
      lastLoadAttempt: null,
      lastError: null
    };
    
    // Load user preferences
    this.loadUserPreferences();
    
    this.initializeElectronIntegration();
  }

  /**
   * Initialize Electron integration and event listeners
   */
  initializeElectronIntegration() {
    if (!this.isElectron) {
      console.log('Running in web mode - Electron features disabled');
      return;
    }

    console.log('Electron integration initialized');
    
    // Set up menu event listeners
    window.electronAPI.onMenuSaveGame(() => {
      console.log('Save game requested from menu');
      this.handleSaveRequest();
    });

    window.electronAPI.onMenuLoadGame(() => {
      console.log('Load game requested from menu');
      this.handleLoadRequest();
    });

    // Set up save status listener
    window.electronAPI.onSaveStatus((event, status) => {
      this.handleSaveStatus(status);
    });

    // Set up auto-save event listener
    window.electronAPI.onAutoSaveEvent((event, eventData) => {
      this.handleAutoSaveEvent(eventData);
    });

    // Set up migration prompt listener
    window.electronAPI.onMigrationPrompt((event, data) => {
      this.handleMigrationPrompt(data);
    });

    // Check if app is ready and initialize auto-save
    window.electronAPI.appReady().then(result => {
      console.log('Electron app ready:', result);
      this.initializeAutoSave();
    }).catch(error => {
      console.error('Failed to check app ready status:', error);
    });
  }

  /**
   * Initialize auto-save system
   */
  async initializeAutoSave() {
    try {
      const result = await window.electronAPI.startAutoSave({
        periodicInterval: 30000, // 30 seconds
        quickSaveDelay: 5000,    // 5 seconds
        enabled: true
      });
      
      if (result.success) {
        this.autoSaveEnabled = true;
        console.log('Auto-save system initialized successfully');
        
        // Start monitoring game state changes
        this.startStateMonitoring();
        
        // Load the latest save automatically
        await this.loadLatestSaveOnStartup();
      } else {
        console.error('Failed to initialize auto-save:', result.error);
      }
    } catch (error) {
      console.error('Error initializing auto-save:', error);
    }
  }

  /**
   * Load user preferences from localStorage
   */
  loadUserPreferences() {
    try {
      const preferences = localStorage.getItem('electronSavePreferences');
      if (preferences) {
        const parsed = JSON.parse(preferences);
        this.autoLoadEnabled = parsed.autoLoadEnabled !== undefined ? parsed.autoLoadEnabled : true;
        console.log('User preferences loaded:', { autoLoadEnabled: this.autoLoadEnabled });
      }
    } catch (error) {
      console.warn('Error loading user preferences:', error);
      this.autoLoadEnabled = true; // Default to enabled
    }
  }

  /**
   * Save user preferences to localStorage
   */
  saveUserPreferences() {
    try {
      const preferences = {
        autoLoadEnabled: this.autoLoadEnabled
      };
      localStorage.setItem('electronSavePreferences', JSON.stringify(preferences));
      console.log('User preferences saved:', preferences);
    } catch (error) {
      console.warn('Error saving user preferences:', error);
    }
  }

  /**
   * Load the latest save file automatically on startup with optimization
   */
  async loadLatestSaveOnStartup() {
    if (!this.autoLoadEnabled) {
      console.log('Auto-load disabled by user preference');
      return;
    }

    try {
      console.log('Checking for latest save to load on startup...');
      
      // First try to get preloaded saves for faster access
      const preloadedResult = await window.electronAPI.getPreloadedSaves();
      
      let saveToLoad = null;
      
      if (preloadedResult.success && preloadedResult.preloadedSaves.length > 0) {
        console.log(`Found ${preloadedResult.totalPreloaded} preloaded saves`);
        
        // Use the most recent preloaded save
        const regularPreloaded = preloadedResult.preloadedSaves.filter(save => !save.isBackup);
        if (regularPreloaded.length > 0) {
          regularPreloaded.sort((a, b) => new Date(b.modified) - new Date(a.modified));
          saveToLoad = regularPreloaded[0];
          console.log(`Using preloaded save: ${saveToLoad.filename}`);
        }
      }
      
      // Fallback to regular save list if no preloaded saves
      if (!saveToLoad) {
        const saveListResult = await window.electronAPI.getSaveList();
        
        if (!saveListResult.success || !saveListResult.saves || saveListResult.saves.length === 0) {
          console.log('No save files found, starting with default game state');
          return;
        }

        // Find the most recent save file (excluding backups)
        const regularSaves = saveListResult.saves.filter(save => !save.isBackup);
        
        if (regularSaves.length === 0) {
          console.log('No regular save files found, starting with default game state');
          return;
        }

        // Sort by modification date (most recent first)
        regularSaves.sort((a, b) => new Date(b.modified) - new Date(a.modified));
        saveToLoad = regularSaves[0];
      }

      if (!saveToLoad) {
        console.log('No suitable save file found');
        return;
      }

      console.log(`Loading latest save: ${saveToLoad.filename}`);
      
      // Use optimized loading if available
      const loadResult = await this.loadSaveOptimized(saveToLoad.filename);
      
      if (loadResult.success) {
        this.applyGameState(loadResult.gameState);
        
        // Force tutorial completion after loading save
        this.ensureTutorialCompleted();
        
        console.log(`Latest save loaded successfully: ${saveToLoad.filename} (${loadResult.wasPreloaded ? 'preloaded' : 'regular'}, ${loadResult.loadTime}ms)`);
        
        // Show a subtle notification with performance info
        const perfInfo = loadResult.wasPreloaded ? ' (fast)' : '';
        this.showNotification(`Loaded: ${saveToLoad.displayName || saveToLoad.filename}${perfInfo}`, 'info', 2000);
        
        // Update statistics
        this.stats.totalLoads++;
        this.stats.lastLoadAttempt = Date.now();
      } else {
        console.error('Failed to load latest save:', loadResult.error);
        this.showNotification(`Failed to load latest save: ${loadResult.error}`, 'warning', 4000);
      }
    } catch (error) {
      console.error('Error loading latest save on startup:', error);
      this.showNotification('Error loading latest save', 'warning', 3000);
    }
  }

  /**
   * Toggle auto-load on startup
   * @param {boolean} enabled - Whether to enable auto-load
   */
  setAutoLoadEnabled(enabled) {
    this.autoLoadEnabled = enabled;
    this.saveUserPreferences();
    console.log(`Auto-load ${enabled ? 'enabled' : 'disabled'}`);
    this.showNotification(`Auto-load on startup ${enabled ? 'enabled' : 'disabled'}`, 'info', 2000);
  }

  /**
   * Start monitoring game state changes for auto-save
   */
  startStateMonitoring() {
    // Monitor game state changes every 2 seconds
    setInterval(() => {
      if (this.autoSaveEnabled) {
        this.checkForStateChanges();
      }
    }, 2000);
  }

  /**
   * Check for game state changes and trigger auto-save if needed
   */
  checkForStateChanges() {
    try {
      const currentState = this.getCurrentGameState();
      
      if (currentState && this.hasStateChanged(currentState)) {
        this.notifyStateChange(currentState);
      }
    } catch (error) {
      console.error('Error checking state changes:', error);
    }
  }

  /**
   * Check if game state has changed compared to cached state
   * @param {Object} currentState - Current game state
   * @returns {boolean} True if state has changed
   */
  hasStateChanged(currentState) {
    if (!this.gameStateCache) {
      this.gameStateCache = this.deepClone(currentState);
      return true;
    }

    // Compare critical properties that indicate meaningful changes
    const criticalProps = ['player', 'script', 'server', 'battery', 'achievements'];
    
    for (const prop of criticalProps) {
      if (JSON.stringify(currentState[prop]) !== JSON.stringify(this.gameStateCache[prop])) {
        this.gameStateCache = this.deepClone(currentState);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Extract current game state from the game
   * @returns {Object} Current game state
   */
  getCurrentGameState() {
    try {
      // Check if SkidInc game object exists
      if (typeof window.skidinc !== 'undefined' && window.skidinc) {
        return {
          version: window.skidinc.version || '0.33',
          timestamp: Date.now(),
          player: {
            username: window.skidinc.player?.username || 'kiddie',
            money: window.skidinc.player?.money || 0,
            totalMoney: window.skidinc.player?.totalMoney || 0,
            exp: window.skidinc.player?.exp || 0,
            totalExp: window.skidinc.player?.totalExp || 0,
            expReq: window.skidinc.player?.expReq || 100,
            level: window.skidinc.player?.level || 1,
            botnet: window.skidinc.player?.botnet || 0,
            prestigeCount: window.skidinc.player?.prestigeCount || 0
          },
          script: {
            unlocked: window.skidinc.script?.unlocked || [],
            completed: window.skidinc.script?.completed || [],
            totalCompleted: window.skidinc.script?.totalCompleted || 0,
            available: window.skidinc.script?.available || [],
            current: window.skidinc.script?.current || null,
            time: window.skidinc.script?.time || 0,
            maxTime: window.skidinc.script?.maxTime || 0
          },
          server: {
            owned: window.skidinc.server?.owned || []
          },
          battery: {
            level: window.skidinc.battery?.level || 1,
            time: window.skidinc.battery?.time || 0
          },
          achievements: {
            owned: window.skidinc.achievements?.owned || []
          },
          autoscript: {
            unlocked: window.skidinc.autoscript?.unlocked || []
          },
          options: {
            typed: window.skidinc.options?.typed !== undefined ? window.skidinc.options.typed : true
          },
          tutorial: {
            finish: true // Always mark tutorial as finished in saves
          },
          console: {
            grammarly: window.skidinc.console?.grammarly || false
          }
        };
      }
      
      // Check if generic game object exists
      if (typeof window.game !== 'undefined' && window.game) {
        return {
          version: '1.0.0',
          timestamp: Date.now(),
          player: {
            username: window.game.player?.username || 'Player',
            money: window.game.player?.money || 0,
            totalMoney: window.game.player?.totalMoney || 0,
            exp: window.game.player?.exp || 0,
            totalExp: window.game.player?.totalExp || 0,
            expReq: window.game.player?.expReq || 100,
            level: window.game.player?.level || 1,
            botnet: window.game.player?.botnet || 0,
            prestigeCount: window.game.player?.prestigeCount || 0
          },
          script: {
            unlocked: window.game.script?.unlocked || [],
            completed: window.game.script?.completed || [],
            totalCompleted: window.game.script?.totalCompleted || 0,
            available: window.game.script?.available || [],
            current: window.game.script?.current || null,
            time: window.game.script?.time || 0,
            maxTime: window.game.script?.maxTime || 0
          },
          server: {
            owned: window.game.server?.owned || []
          },
          battery: {
            level: window.game.battery?.level || 100,
            time: window.game.battery?.time || 0
          },
          achievements: {
            owned: window.game.achievements?.owned || []
          },
          autoscript: {
            unlocked: window.game.autoscript?.unlocked || []
          },
          options: {
            typed: window.game.options?.typed || false
          },
          tutorial: {
            finish: true // Always mark tutorial as finished in saves
          },
          console: {
            grammarly: window.game.console?.grammarly || false
          }
        };
      }
      
      // Fallback: try to get state from localStorage if game object not available
      const localStorageState = this.getStateFromLocalStorage();
      if (localStorageState) {
        return localStorageState;
      }
      
      // Return minimal default state if nothing is available
      return this.getDefaultGameState();
    } catch (error) {
      console.error('Error extracting game state:', error);
      return this.getDefaultGameState();
    }
  }

  /**
   * Get game state from localStorage (fallback method)
   * @returns {Object|null} Game state from localStorage or null
   */
  getStateFromLocalStorage() {
    try {
      const keys = ['player', 'script', 'server', 'battery', 'achievements', 'autoscript', 'options', 'tutorial', 'console'];
      const state = { version: '1.0.0', timestamp: Date.now() };
      
      let hasData = false;
      for (const key of keys) {
        const data = localStorage.getItem(key);
        if (data) {
          state[key] = JSON.parse(data);
          hasData = true;
        }
      }
      
      return hasData ? state : null;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  }

  /**
   * Get default game state
   * @returns {Object} Default game state
   */
  getDefaultGameState() {
    return {
      version: '1.0.0',
      timestamp: Date.now(),
      player: {
        username: 'Player',
        money: 0,
        totalMoney: 0,
        exp: 0,
        totalExp: 0,
        expReq: 100,
        level: 1,
        botnet: 0,
        prestigeCount: 0
      },
      script: {
        unlocked: [],
        completed: [],
        totalCompleted: 0,
        available: [],
        current: null,
        time: 0,
        maxTime: 0
      },
      server: {
        owned: []
      },
      battery: {
        level: 100,
        time: 0
      },
      achievements: {
        owned: []
      },
      autoscript: {
        unlocked: []
      },
      options: {
        typed: false
      },
      tutorial: {
        finish: true // Default to tutorial finished
      },
      console: {
        grammarly: false
      }
    };
  }

  /**
   * Apply loaded game state to the game
   * @param {Object} gameState - Game state to apply
   */
  applyGameState(gameState) {
    try {
      // Check if SkidInc game object exists
      if (typeof window.skidinc !== 'undefined' && window.skidinc) {
        console.log('Applying game state to SkidInc game object');
        
        // Apply player data
        if (gameState.player && window.skidinc.player) {
          Object.assign(window.skidinc.player, gameState.player);
        }
        
        // Apply script data
        if (gameState.script && window.skidinc.script) {
          Object.assign(window.skidinc.script, gameState.script);
        }
        
        // Apply server data
        if (gameState.server && window.skidinc.server) {
          Object.assign(window.skidinc.server, gameState.server);
        }
        
        // Apply battery data
        if (gameState.battery && window.skidinc.battery) {
          Object.assign(window.skidinc.battery, gameState.battery);
        }
        
        // Apply achievements data
        if (gameState.achievements && window.skidinc.achievements) {
          Object.assign(window.skidinc.achievements, gameState.achievements);
        }
        
        // Apply autoscript data
        if (gameState.autoscript && window.skidinc.autoscript) {
          Object.assign(window.skidinc.autoscript, gameState.autoscript);
        }
        
        // Apply options data
        if (gameState.options && window.skidinc.options) {
          Object.assign(window.skidinc.options, gameState.options);
        }
        
        // Apply tutorial data and ensure tutorial is marked as finished when loading a save
        if (gameState.tutorial && window.skidinc.tutorial) {
          Object.assign(window.skidinc.tutorial, gameState.tutorial);
          // Force tutorial to be finished when loading any save
          window.skidinc.tutorial.finish = true;
        } else if (window.skidinc.tutorial) {
          // If no tutorial data in save, still mark tutorial as finished
          window.skidinc.tutorial.finish = true;
        }
        
        // Apply console data
        if (gameState.console && window.skidinc.console) {
          Object.assign(window.skidinc.console, gameState.console);
        }
        
        // Hide tutorial elements if they exist
        this.hideTutorialElements();
        
        // Update the game display
        if (typeof window.skidinc.stats === 'function') {
          window.skidinc.stats();
        }
        
        console.log('Game state applied to SkidInc successfully (tutorial disabled)');
      } else if (typeof window.game !== 'undefined' && window.game) {
        // Fallback for generic game object
        console.log('Applying game state to generic game object');
        
        if (gameState.player) {
          Object.assign(window.game.player, gameState.player);
        }
        if (gameState.script) {
          Object.assign(window.game.script, gameState.script);
        }
        if (gameState.server) {
          Object.assign(window.game.server, gameState.server);
        }
        if (gameState.battery) {
          Object.assign(window.game.battery, gameState.battery);
        }
        if (gameState.achievements) {
          Object.assign(window.game.achievements, gameState.achievements);
        }
        if (gameState.autoscript) {
          Object.assign(window.game.autoscript, gameState.autoscript);
        }
        if (gameState.options) {
          Object.assign(window.game.options, gameState.options);
        }
        if (gameState.tutorial) {
          Object.assign(window.game.tutorial, gameState.tutorial);
          // Force tutorial to be finished when loading any save
          window.game.tutorial.finish = true;
        } else if (window.game.tutorial) {
          // If no tutorial data in save, still mark tutorial as finished
          window.game.tutorial.finish = true;
        }
        if (gameState.console) {
          Object.assign(window.game.console, gameState.console);
        }
        
        // Hide tutorial elements if they exist
        this.hideTutorialElements();
        
        // Trigger game update if available
        if (typeof window.game.update === 'function') {
          window.game.update();
        }
        
        console.log('Game state applied to generic game successfully (tutorial disabled)');
      } else {
        // Fallback: save to localStorage and wait for game to load
        console.log('Game object not ready, saving to localStorage as fallback');
        this.saveStateToLocalStorage(gameState);
        
        // Also save tutorial completion to localStorage
        localStorage.setItem('tutorial', JSON.stringify({ finish: true }));
      }
      
      // Update cached state
      this.gameStateCache = this.deepClone(gameState);
      
      // Notify listeners
      this.notifyStateChangeListeners('state-loaded', gameState);
    } catch (error) {
      console.error('Error applying game state:', error);
      throw error;
    }
  }

  /**
   * Save game state to localStorage (fallback method)
   * @param {Object} gameState - Game state to save
   */
  saveStateToLocalStorage(gameState) {
    try {
      const keys = ['player', 'script', 'server', 'battery', 'achievements', 'autoscript', 'options', 'tutorial', 'console'];
      
      for (const key of keys) {
        if (gameState[key]) {
          localStorage.setItem(key, JSON.stringify(gameState[key]));
        }
      }
      
      // Ensure tutorial is marked as finished in localStorage
      localStorage.setItem('tutorial', JSON.stringify({ finish: true }));
      
      console.log('Game state saved to localStorage');
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  /**
   * Hide tutorial elements from the UI when loading a save
   */
  hideTutorialElements() {
    try {
      // Hide SkidInc intro screen specifically
      const introElement = document.querySelector('.intro');
      if (introElement) {
        introElement.style.display = 'none';
        introElement.style.visibility = 'hidden';
        introElement.classList.add('tutorial-hidden');
      }
      
      // Show game screen
      const gameElement = document.querySelector('.game');
      if (gameElement) {
        gameElement.style.display = 'block';
        gameElement.style.visibility = 'visible';
        gameElement.style.opacity = '1';
      }
      
      // Hide common tutorial elements by class names and IDs
      const tutorialSelectors = [
        '.tutorial',
        '.tutorial-overlay',
        '.tutorial-popup',
        '.tutorial-highlight',
        '.tutorial-arrow',
        '.tutorial-text',
        '#tutorial',
        '#tutorial-overlay',
        '#tutorial-popup',
        '[data-tutorial]',
        '.intro-tutorial',
        '.game-tutorial',
        '.help-tutorial',
        '.intro.default' // SkidInc specific intro class
      ];
      
      tutorialSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          element.style.display = 'none';
          element.style.visibility = 'hidden';
          element.classList.add('tutorial-hidden');
        });
      });
      
      // Remove tutorial event listeners if they exist
      if (typeof window.removeTutorialListeners === 'function') {
        window.removeTutorialListeners();
      }
      
      // Call SkidInc specific tutorial disable functions
      if (typeof window.skidinc !== 'undefined' && window.skidinc) {
        if (typeof window.skidinc.disableTutorial === 'function') {
          window.skidinc.disableTutorial();
        }
        if (typeof window.skidinc.hideTutorial === 'function') {
          window.skidinc.hideTutorial();
        }
        if (typeof window.skidinc.tutorial !== 'undefined' && window.skidinc.tutorial) {
          if (typeof window.skidinc.tutorial.skip === 'function') {
            window.skidinc.tutorial.skip();
          }
          if (typeof window.skidinc.tutorial.finished === 'function') {
            window.skidinc.tutorial.finished();
          }
        }
      }
      
      // Generic game tutorial disable
      if (typeof window.game !== 'undefined' && window.game) {
        if (typeof window.game.disableTutorial === 'function') {
          window.game.disableTutorial();
        }
        if (typeof window.game.hideTutorial === 'function') {
          window.game.hideTutorial();
        }
      }
      
      // Global tutorial disable functions
      if (typeof window.disableTutorial === 'function') {
        window.disableTutorial();
      }
      if (typeof window.hideTutorial === 'function') {
        window.hideTutorial();
      }
      
      console.log('Tutorial elements hidden after save load');
    } catch (error) {
      console.warn('Error hiding tutorial elements:', error.message);
    }
  }

  /**
   * Ensure tutorial is marked as completed and hidden
   */
  ensureTutorialCompleted() {
    try {
      // Set tutorial as completed in SkidInc game object
      if (typeof window.skidinc !== 'undefined' && window.skidinc && window.skidinc.tutorial) {
        window.skidinc.tutorial.enabled = false;
        window.skidinc.tutorial.finish = true;
        window.skidinc.tutorial.step = 3; // Set to final step
        
        // Call the tutorial finished method if it exists
        if (typeof window.skidinc.tutorial.finished === 'function') {
          window.skidinc.tutorial.finished();
        }
        
        // Call the skip method if it exists
        if (typeof window.skidinc.tutorial.skip === 'function') {
          window.skidinc.tutorial.skip();
        }
      }
      
      // Set tutorial as completed in generic game object
      if (typeof window.game !== 'undefined' && window.game && window.game.tutorial) {
        window.game.tutorial.finish = true;
        window.game.tutorial.enabled = false;
      }
      
      // Set in localStorage as well
      localStorage.setItem('tutorial', JSON.stringify({ 
        finish: true, 
        enabled: false, 
        step: 3 
      }));
      
      // Hide intro screen if it exists
      const introElement = document.querySelector('.intro');
      if (introElement) {
        introElement.style.display = 'none';
        introElement.remove();
      }
      
      // Show game screen if it exists
      const gameElement = document.querySelector('.game');
      if (gameElement) {
        gameElement.style.display = 'block';
        gameElement.style.opacity = '1';
      }
      
      // Focus on command input if it exists
      const commandInput = document.querySelector('#command-input');
      if (commandInput) {
        commandInput.focus();
      }
      
      // Enable console input if skidinc console exists
      if (typeof window.skidinc !== 'undefined' && window.skidinc && window.skidinc.console) {
        window.skidinc.console.inputEnabled = true;
      }
      
      // Hide tutorial elements
      this.hideTutorialElements();
      
      // Wait a moment and ensure tutorial is still disabled (in case of race conditions)
      setTimeout(() => {
        this.hideTutorialElements();
        
        // Double-check tutorial state
        if (typeof window.skidinc !== 'undefined' && window.skidinc && window.skidinc.tutorial) {
          window.skidinc.tutorial.enabled = false;
          window.skidinc.tutorial.finish = true;
        }
        
        // Ensure game is visible
        const gameEl = document.querySelector('.game');
        if (gameEl) {
          gameEl.style.display = 'block';
        }
        
        const introEl = document.querySelector('.intro');
        if (introEl) {
          introEl.style.display = 'none';
        }
      }, 1000);
      
      console.log('Tutorial completion ensured after save load - tutorial disabled');
    } catch (error) {
      console.warn('Error ensuring tutorial completion:', error.message);
    }
  }

  /**
   * Handle save request from menu or manual trigger
   */
  async handleSaveRequest() {
    if (!this.isElectron) {
      console.log('Save not available in web mode');
      return;
    }

    try {
      this.stats.totalSaves++;
      this.stats.lastSaveAttempt = Date.now();
      
      const gameState = this.getCurrentGameState();
      const result = await window.electronAPI.saveGameState(gameState);
      
      if (result.success) {
        this.lastSaveTime = result.timestamp;
        console.log('Manual save successful:', result.filename);
        this.showNotification('Game saved successfully', 'success');
      } else {
        console.error('Manual save failed:', result.error);
        this.showNotification(`Save failed: ${result.error}`, 'error');
        this.stats.lastError = result.error;
      }
    } catch (error) {
      console.error('Error during manual save:', error);
      this.showNotification(`Save error: ${error.message}`, 'error');
      this.stats.lastError = error.message;
    }
  }

  /**
   * Handle load request from menu or manual trigger
   */
  async handleLoadRequest() {
    if (!this.isElectron) {
      console.log('Load not available in web mode');
      return;
    }

    try {
      this.stats.totalLoads++;
      this.stats.lastLoadAttempt = Date.now();
      
      const result = await window.electronAPI.loadGameState();
      
      if (result.success) {
        this.applyGameState(result.gameState);
        
        // Force tutorial completion after loading save
        this.ensureTutorialCompleted();
        
        console.log('Game loaded successfully from:', result.filename);
        this.showNotification('Game loaded successfully', 'success');
      } else {
        console.error('Load failed:', result.error);
        this.showNotification(`Load failed: ${result.error}`, 'error');
        this.stats.lastError = result.error;
      }
    } catch (error) {
      console.error('Error during load:', error);
      this.showNotification(`Load error: ${error.message}`, 'error');
      this.stats.lastError = error.message;
    }
  }

  /**
   * Load a specific save file
   * @param {string} filename - Filename to load
   */
  async loadSpecificSave(filename) {
    if (!this.isElectron) {
      console.log('Load not available in web mode');
      return;
    }

    try {
      const result = await window.electronAPI.loadSpecificSave(filename);
      
      if (result.success) {
        this.applyGameState(result.gameState);
        
        // Force tutorial completion after loading save
        this.ensureTutorialCompleted();
        
        console.log('Specific save loaded successfully:', filename);
        this.showNotification(`Loaded: ${filename}`, 'success');
        return result;
      } else {
        console.error('Load specific save failed:', result.error);
        this.showNotification(`Load failed: ${result.error}`, 'error');
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error loading specific save:', error);
      this.showNotification(`Load error: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Load a save file with optimization (uses preloaded data if available)
   * @param {string} filename - Filename to load
   * @returns {Promise<Object>} Load result with performance metrics
   */
  async loadSaveOptimized(filename) {
    if (!this.isElectron) {
      console.log('Optimized load not available in web mode');
      return await this.loadSpecificSave(filename);
    }

    try {
      const startTime = Date.now();
      
      // Try optimized loading first
      const result = await window.electronAPI.loadSaveOptimized(filename);
      
      if (result.success) {
        this.applyGameState(result.gameState);
        
        // Force tutorial completion after loading save
        this.ensureTutorialCompleted();
        
        const totalTime = Date.now() - startTime;
        console.log(`Optimized save loaded: ${filename} (${result.wasPreloaded ? 'preloaded' : 'regular'}, ${result.loadTime || totalTime}ms)`);
        
        // Show notification with performance info
        const perfInfo = result.wasPreloaded ? ' (fast)' : '';
        this.showNotification(`Loaded: ${filename}${perfInfo}`, 'success');
        
        return {
          ...result,
          totalTime: totalTime
        };
      } else {
        console.error('Optimized load failed, falling back to regular load:', result.error);
        // Fallback to regular loading
        return await this.loadSpecificSave(filename);
      }
    } catch (error) {
      console.error('Error in optimized load, falling back to regular load:', error);
      // Fallback to regular loading
      return await this.loadSpecificSave(filename);
    }
  }

  /**
   * Get startup optimization statistics
   * @returns {Promise<Object>} Startup statistics
   */
  async getStartupStatistics() {
    if (!this.isElectron) {
      return { available: false, message: 'Startup optimization not available in web mode' };
    }

    try {
      const result = await window.electronAPI.getStartupStatistics();
      
      if (result.success) {
        return {
          available: true,
          ...result.statistics
        };
      } else {
        console.error('Failed to get startup statistics:', result.error);
        return { available: false, error: result.error };
      }
    } catch (error) {
      console.error('Error getting startup statistics:', error);
      return { available: false, error: error.message };
    }
  }

  /**
   * Get list of preloaded saves
   * @returns {Promise<Array>} List of preloaded save files
   */
  async getPreloadedSaves() {
    if (!this.isElectron) {
      return [];
    }

    try {
      const result = await window.electronAPI.getPreloadedSaves();
      return result.success ? result.preloadedSaves : [];
    } catch (error) {
      console.error('Error getting preloaded saves:', error);
      return [];
    }
  }

  /**
   * Clear startup caches to free memory
   * @returns {Promise<boolean>} Success status
   */
  async clearStartupCaches() {
    if (!this.isElectron) {
      return false;
    }

    try {
      const result = await window.electronAPI.clearStartupCaches();
      
      if (result.success) {
        console.log('Startup caches cleared successfully');
        this.showNotification('Startup caches cleared', 'info', 2000);
        return true;
      } else {
        console.error('Failed to clear startup caches:', result.error);
        this.showNotification(`Failed to clear caches: ${result.error}`, 'error');
        return false;
      }
    } catch (error) {
      console.error('Error clearing startup caches:', error);
      this.showNotification(`Cache clear error: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Update startup optimization configuration
   * @param {Object} config - Configuration object
   * @returns {Promise<boolean>} Success status
   */
  async updateStartupConfig(config) {
    if (!this.isElectron) {
      return false;
    }

    try {
      const result = await window.electronAPI.updateStartupConfig(config);
      
      if (result.success) {
        console.log('Startup configuration updated');
        this.showNotification('Startup settings updated', 'success', 2000);
        return true;
      } else {
        console.error('Failed to update startup config:', result.error);
        this.showNotification(`Config update failed: ${result.error}`, 'error');
        return false;
      }
    } catch (error) {
      console.error('Error updating startup config:', error);
      this.showNotification(`Config error: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Notify about game state changes for auto-save
   * @param {Object} gameState - Current game state
   */
  notifyStateChange(gameState) {
    if (!this.isElectron || !this.autoSaveEnabled) {
      return;
    }

    // Debounce state change notifications
    if (this.stateChangeTimer) {
      clearTimeout(this.stateChangeTimer);
    }

    this.stateChangeTimer = setTimeout(() => {
      // The auto-save manager in the main process will handle the actual saving
      // We just need to ensure the current state is available when requested
      this.gameStateCache = this.deepClone(gameState);
      
      // Notify listeners about state change
      this.notifyStateChangeListeners('state-changed', gameState);
    }, this.stateChangeDebounceMs);
  }

  /**
   * Handle save status notifications from main process
   * @param {Object} status - Save status information
   */
  handleSaveStatus(status) {
    if (status.success) {
      this.lastSaveTime = status.timestamp;
      console.log(`Auto-save successful: ${status.filename} (${status.type})`);
      
      if (status.type === 'auto') {
        this.showNotification('Auto-saved', 'info', 2000);
      }
    } else {
      console.error(`Save failed: ${status.error} (${status.type})`);
      this.showNotification(`Save failed: ${status.error}`, 'error');
      this.stats.lastError = status.error;
    }
    
    // Notify listeners
    this.notifySaveStatusListeners(status);
  }

  /**
   * Handle auto-save events from main process
   * @param {Object} eventData - Auto-save event data
   */
  handleAutoSaveEvent(eventData) {
    const { type, data } = eventData;
    
    switch (type) {
      case 'save-success':
        console.log(`Auto-save success: ${data.filename} (${data.saveType})`);
        if (data.saveType === 'periodic' || data.saveType === 'quick') {
          this.showNotification('Auto-saved', 'info', 1500);
        }
        break;
        
      case 'save-failed':
        console.error(`Auto-save failed: ${data.error} (${data.saveType})`);
        this.showNotification(`Auto-save failed: ${data.error}`, 'error');
        break;
        
      case 'save-retry':
        console.warn(`Auto-save retry ${data.retryCount}/${data.maxRetries}: ${data.error}`);
        break;
        
      case 'backup-created':
        console.log(`Backup created: ${data.filename}`);
        break;
        
      case 'backup-cleanup':
        console.log(`Backup cleanup: ${data.cleanedCount} files removed`);
        break;
        
      case 'auto-save-error':
        console.error(`Auto-save system error: ${data.error}`);
        this.showNotification(`Auto-save error: ${data.error}`, 'error');
        break;
    }
    
    // Notify listeners
    this.notifyAutoSaveEventListeners(eventData);
  }

  /**
   * Handle migration prompt from main process
   * @param {Object} data - Migration data
   */
  handleMigrationPrompt(data) {
    console.log('Migration prompt received:', data);
    // This would typically show a UI dialog to the user
    // For now, just log the event
    this.showNotification('Migration available - check console', 'info');
  }

  /**
   * Show notification to user
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, error, info, warning)
   * @param {number} duration - Duration in milliseconds (default: 3000)
   */
  showNotification(message, type = 'info', duration = 3000) {
    // Create a simple notification system
    const notification = document.createElement('div');
    notification.className = `save-notification save-notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '10px 15px',
      borderRadius: '5px',
      color: 'white',
      fontWeight: 'bold',
      zIndex: '10000',
      fontSize: '14px',
      maxWidth: '300px',
      wordWrap: 'break-word'
    });
    
    // Set background color based on type
    const colors = {
      success: '#4CAF50',
      error: '#f44336',
      warning: '#ff9800',
      info: '#2196F3'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
    // Remove notification after duration
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, duration);
  }

  /**
   * Get save list from main process
   * @returns {Promise<Array>} List of save files
   */
  async getSaveList() {
    if (!this.isElectron) {
      return [];
    }

    try {
      const result = await window.electronAPI.getSaveList();
      return result.success ? result.saves : [];
    } catch (error) {
      console.error('Error getting save list:', error);
      return [];
    }
  }

  /**
   * Get the most recent save file
   * @returns {Promise<Object|null>} Most recent save file or null
   */
  async getLatestSave() {
    try {
      const saves = await this.getSaveList();
      const regularSaves = saves.filter(save => !save.isBackup);
      
      if (regularSaves.length === 0) {
        return null;
      }

      // Sort by modification date (most recent first)
      regularSaves.sort((a, b) => new Date(b.modified) - new Date(a.modified));
      return regularSaves[0];
    } catch (error) {
      console.error('Error getting latest save:', error);
      return null;
    }
  }

  /**
   * Delete a save file
   * @param {string} filename - Filename to delete
   */
  async deleteSave(filename) {
    if (!this.isElectron) {
      return;
    }

    try {
      const result = await window.electronAPI.deleteSave(filename);
      
      if (result.success) {
        console.log('Save deleted successfully:', filename);
        this.showNotification(`Deleted: ${filename}`, 'success');
      } else {
        console.error('Delete failed:', result.error);
        this.showNotification(`Delete failed: ${result.error}`, 'error');
      }
      
      return result;
    } catch (error) {
      console.error('Error deleting save:', error);
      this.showNotification(`Delete error: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Create manual backup
   * @param {string} backupName - Optional backup name
   */
  async createManualBackup(backupName = null) {
    if (!this.isElectron) {
      return;
    }

    try {
      const gameState = this.getCurrentGameState();
      const result = await window.electronAPI.createManualBackup(gameState, backupName);
      
      if (result.success) {
        console.log('Manual backup created:', result.filename);
        this.showNotification('Backup created successfully', 'success');
      } else {
        console.error('Backup creation failed:', result.error);
        this.showNotification(`Backup failed: ${result.error}`, 'error');
      }
      
      return result;
    } catch (error) {
      console.error('Error creating backup:', error);
      this.showNotification(`Backup error: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Get save statistics
   * @returns {Promise<Object>} Save statistics
   */
  async getSaveStatistics() {
    if (!this.isElectron) {
      return this.stats;
    }

    try {
      const result = await window.electronAPI.getSaveStatistics();
      
      if (result.success) {
        return {
          ...this.stats,
          ...result.statistics
        };
      } else {
        console.error('Failed to get statistics:', result.error);
        return this.stats;
      }
    } catch (error) {
      console.error('Error getting statistics:', error);
      return this.stats;
    }
  }

  /**
   * Add state change listener
   * @param {Function} callback - Callback function
   */
  addStateChangeListener(callback) {
    this.stateChangeListeners.push(callback);
  }

  /**
   * Remove state change listener
   * @param {Function} callback - Callback function to remove
   */
  removeStateChangeListener(callback) {
    const index = this.stateChangeListeners.indexOf(callback);
    if (index > -1) {
      this.stateChangeListeners.splice(index, 1);
    }
  }

  /**
   * Add save status listener
   * @param {Function} callback - Callback function
   */
  addSaveStatusListener(callback) {
    this.saveStatusListeners.push(callback);
  }

  /**
   * Remove save status listener
   * @param {Function} callback - Callback function to remove
   */
  removeSaveStatusListener(callback) {
    const index = this.saveStatusListeners.indexOf(callback);
    if (index > -1) {
      this.saveStatusListeners.splice(index, 1);
    }
  }

  /**
   * Add auto-save event listener
   * @param {Function} callback - Callback function
   */
  addAutoSaveEventListener(callback) {
    this.autoSaveEventListeners.push(callback);
  }

  /**
   * Remove auto-save event listener
   * @param {Function} callback - Callback function to remove
   */
  removeAutoSaveEventListener(callback) {
    const index = this.autoSaveEventListeners.indexOf(callback);
    if (index > -1) {
      this.autoSaveEventListeners.splice(index, 1);
    }
  }

  /**
   * Notify state change listeners
   * @param {string} eventType - Type of event
   * @param {Object} data - Event data
   */
  notifyStateChangeListeners(eventType, data) {
    this.stateChangeListeners.forEach(callback => {
      try {
        callback(eventType, data);
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });
  }

  /**
   * Notify save status listeners
   * @param {Object} status - Save status
   */
  notifySaveStatusListeners(status) {
    this.saveStatusListeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in save status listener:', error);
      }
    });
  }

  /**
   * Notify auto-save event listeners
   * @param {Object} eventData - Event data
   */
  notifyAutoSaveEventListeners(eventData) {
    this.autoSaveEventListeners.forEach(callback => {
      try {
        callback(eventData);
      } catch (error) {
        console.error('Error in auto-save event listener:', error);
      }
    });
  }

  /**
   * Deep clone an object
   * @param {Object} obj - Object to clone
   * @returns {Object} Cloned object
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Enable or disable auto-save
   * @param {boolean} enabled - Whether to enable auto-save
   */
  async setAutoSaveEnabled(enabled) {
    if (!this.isElectron) {
      return;
    }

    try {
      const result = await window.electronAPI.updateAutoSaveConfig({ enabled });
      
      if (result.success) {
        this.autoSaveEnabled = enabled;
        console.log(`Auto-save ${enabled ? 'enabled' : 'disabled'}`);
        this.showNotification(`Auto-save ${enabled ? 'enabled' : 'disabled'}`, 'info');
      } else {
        console.error('Failed to update auto-save config:', result.error);
      }
    } catch (error) {
      console.error('Error updating auto-save config:', error);
    }
  }

  /**
   * Update auto-save configuration
   * @param {Object} config - Configuration object
   */
  async updateAutoSaveConfig(config) {
    if (!this.isElectron) {
      return;
    }

    try {
      const result = await window.electronAPI.updateAutoSaveConfig(config);
      
      if (result.success) {
        if (config.enabled !== undefined) {
          this.autoSaveEnabled = config.enabled;
        }
        console.log('Auto-save configuration updated');
        this.showNotification('Auto-save settings updated', 'success');
      } else {
        console.error('Failed to update auto-save config:', result.error);
      }
    } catch (error) {
      console.error('Error updating auto-save config:', error);
    }
  }

  /**
   * Get current save manager statistics
   * @returns {Object} Statistics object
   */
  getLocalStatistics() {
    return {
      ...this.stats,
      isElectron: this.isElectron,
      autoSaveEnabled: this.autoSaveEnabled,
      lastSaveTime: this.lastSaveTime,
      hasGameStateCache: !!this.gameStateCache,
      listenerCounts: {
        stateChange: this.stateChangeListeners.length,
        saveStatus: this.saveStatusListeners.length,
        autoSaveEvent: this.autoSaveEventListeners.length
      }
    };
  }

  /**
   * Cleanup method to remove all listeners
   */
  cleanup() {
    if (this.isElectron) {
      window.electronAPI.removeSaveStatusListener();
      window.electronAPI.removeAutoSaveEventListener();
      window.electronAPI.removeMigrationPromptListener();
    }
    
    this.stateChangeListeners = [];
    this.saveStatusListeners = [];
    this.autoSaveEventListeners = [];
    
    if (this.stateChangeTimer) {
      clearTimeout(this.stateChangeTimer);
      this.stateChangeTimer = null;
    }
  }
}

// Initialize the save manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
  // Initialize notification manager first
  window.notificationManager = new NotificationManager();
  
  // Initialize migration UI manager
  window.migrationUIManager = new MigrationUIManager();
  
  // Initialize save state manager
  window.saveStateManager = new SaveStateManager();
  
  // Connect notification manager to save state manager
  if (window.saveStateManager && window.notificationManager) {
    // Override the showNotification method to use NotificationManager
    window.saveStateManager.showNotification = (message, type, duration) => {
      switch (type) {
        case 'success':
          window.notificationManager.showSaveSuccess(message, duration);
          break;
        case 'error':
          window.notificationManager.showSaveError(message.replace('Save failed: ', '').replace('Load failed: ', '').replace('Save error: ', '').replace('Load error: ', ''), duration);
          break;
        case 'warning':
          window.notificationManager.showNotification(message, 'warning', duration);
          break;
        case 'info':
        default:
          window.notificationManager.showNotification(message, 'info', duration);
          break;
      }
    };
  }
  
  // Check for migration after a short delay to ensure game is loaded
  setTimeout(() => {
    if (window.migrationUIManager) {
      window.migrationUIManager.checkAndPromptMigration().catch(error => {
        console.error('Error during migration check:', error);
      });
    }
  }, 2000);
  
  // Wait for the game to be fully loaded before initializing save system
  // SkidInc has a 3.5 second loading screen, so we wait a bit longer
  setTimeout(() => {
    if (window.saveStateManager && window.saveStateManager.isElectron) {
      console.log('Initializing Electron save system after game load');
      // The save system initialization will trigger auto-load if enabled
      
      // Add a listener for when saves are loaded to ensure tutorial is disabled
      window.saveStateManager.addStateChangeListener((eventType, data) => {
        if (eventType === 'state-loaded') {
          // Wait a moment for the game to process the loaded state
          setTimeout(() => {
            window.saveStateManager.ensureTutorialCompleted();
          }, 500);
        }
      });
    }
  }, 4000);
  
  // Also add a global listener for when the SkidInc game object is ready
  const checkGameReady = () => {
    if (typeof window.skidinc !== 'undefined' && window.skidinc && window.saveStateManager) {
      // If we have a save state manager and the game is loaded, check if we need to disable tutorial
      if (window.saveStateManager.gameStateCache) {
        console.log('Game loaded with existing save data, ensuring tutorial is disabled');
        window.saveStateManager.ensureTutorialCompleted();
      }
    } else {
      // Check again in 500ms
      setTimeout(checkGameReady, 500);
    }
  };
  
  // Start checking after initial load
  setTimeout(checkGameReady, 5000);
});