const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App ready check
  appReady: () => ipcRenderer.invoke('app-ready'),
  
  // Menu event listeners
  onMenuSaveGame: (callback) => ipcRenderer.on('menu-save-game', callback),
  onMenuLoadGame: (callback) => ipcRenderer.on('menu-load-game', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Save system IPC methods
  saveGameState: (gameState) => ipcRenderer.invoke('save-game-state', gameState),
  loadGameState: () => ipcRenderer.invoke('load-game-state'),
  loadSpecificSave: (filename) => ipcRenderer.invoke('load-specific-save', filename),
  getSaveList: () => ipcRenderer.invoke('get-save-list'),
  deleteSave: (filename) => ipcRenderer.invoke('delete-save', filename),
  
  // Auto-save system methods
  startAutoSave: (options) => ipcRenderer.invoke('start-auto-save', options),
  stopAutoSave: () => ipcRenderer.invoke('stop-auto-save'),
  updateAutoSaveConfig: (config) => ipcRenderer.invoke('update-auto-save-config', config),
  
  // Backup system methods
  createManualBackup: (gameState, backupName) => ipcRenderer.invoke('create-manual-backup', gameState, backupName),
  getBackupFiles: () => ipcRenderer.invoke('get-backup-files'),
  
  // Statistics and monitoring
  getSaveStatistics: () => ipcRenderer.invoke('get-save-statistics'),
  
  // Startup optimization methods
  getStartupStatistics: () => ipcRenderer.invoke('get-startup-statistics'),
  loadSaveOptimized: (filename) => ipcRenderer.invoke('load-save-optimized', filename),
  getPreloadedSaves: () => ipcRenderer.invoke('get-preloaded-saves'),
  clearStartupCaches: () => ipcRenderer.invoke('clear-startup-caches'),
  updateStartupConfig: (config) => ipcRenderer.invoke('update-startup-config', config),
  
  // Migration system methods
  checkMigrationStatus: () => ipcRenderer.invoke('check-migration-status'),
  importFromLocalStorage: (localStorageData, customFilename) => ipcRenderer.invoke('import-from-localstorage', localStorageData, customFilename),
  getMigrationStatistics: () => ipcRenderer.invoke('get-migration-statistics'),
  resetMigrationStatus: () => ipcRenderer.invoke('reset-migration-status'),
  decodeLocalStorageData: (encodedData) => ipcRenderer.invoke('decode-localstorage-data', encodedData),
  
  // Event listeners
  onSaveStatus: (callback) => ipcRenderer.on('save-status', callback),
  onAutoSaveEvent: (callback) => ipcRenderer.on('auto-save-event', callback),
  onMigrationPrompt: (callback) => ipcRenderer.on('migration-prompt', callback),
  onMigrationStatus: (callback) => ipcRenderer.on('migration-status', callback),
  
  // Remove specific listeners
  removeSaveStatusListener: () => ipcRenderer.removeAllListeners('save-status'),
  removeAutoSaveEventListener: () => ipcRenderer.removeAllListeners('auto-save-event'),
  removeMigrationPromptListener: () => ipcRenderer.removeAllListeners('migration-prompt'),
  removeMigrationStatusListener: () => ipcRenderer.removeAllListeners('migration-status')
});