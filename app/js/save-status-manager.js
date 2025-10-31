/**
 * Save Status Manager - Handles save status indicator and notifications
 * Provides discrete save status feedback and integrates with the notification system
 */
skidinc.saveStatusManager = {
    indicator: null,
    statusText: null,
    statusTime: null,
    currentTimeout: null,
    lastSaveTime: null,
    notificationSettings: {
        showSuccessNotifications: true,
        showErrorNotifications: true,
        showAutoSaveNotifications: true,
        discreteMode: false
    },
    
    /**
     * Initialize the save status manager
     */
    init: function() {
        this.indicator = $('#save-status-indicator');
        this.statusText = $('#save-status-text');
        this.statusTime = $('#save-status-time');
        
        // Load user preferences
        this.loadNotificationSettings();
        
        // Show indicator only in Electron mode
        if (typeof window.electronAPI !== 'undefined') {
            this.setupElectronIntegration();
        }
        
        console.log('Save Status Manager initialized');
    },
    
    /**
     * Setup Electron integration
     */
    setupElectronIntegration() {
        // Listen for save state manager events
        if (window.saveStateManager) {
            // Add listeners for save events
            window.saveStateManager.addSaveStatusListener((status) => {
                this.handleSaveStatus(status);
            });
            
            window.saveStateManager.addAutoSaveEventListener((eventData) => {
                this.handleAutoSaveEvent(eventData);
            });
        }
        
        // Show the indicator
        this.showIndicator('Ready', 'info');
        setTimeout(() => this.hideIndicator(), 2000);
    },
    
    /**
     * Handle save status from save state manager
     * @param {Object} status - Save status object
     */
    handleSaveStatus(status) {
        if (status.success) {
            this.lastSaveTime = status.timestamp || Date.now();
            
            if (status.type === 'manual') {
                this.showSaveSuccess('Manual save completed');
                if (this.notificationSettings.showSuccessNotifications) {
                    this.showNotification('Game saved successfully', 'success', 3000);
                }
            } else if (status.type === 'auto') {
                this.showAutoSaveSuccess();
                if (this.notificationSettings.showAutoSaveNotifications && !this.notificationSettings.discreteMode) {
                    this.showNotification('Auto-saved', 'info', 2000);
                }
            }
        } else {
            this.showSaveError(status.error);
            if (this.notificationSettings.showErrorNotifications) {
                this.showNotification(`Save failed: ${status.error}`, 'error', 5000);
            }
        }
    },
    
    /**
     * Handle auto-save events
     * @param {Object} eventData - Auto-save event data
     */
    handleAutoSaveEvent(eventData) {
        const { type, data } = eventData;
        
        switch (type) {
            case 'save-success':
                if (data.saveType === 'periodic' || data.saveType === 'quick') {
                    this.showAutoSaveSuccess();
                    if (this.notificationSettings.showAutoSaveNotifications && !this.notificationSettings.discreteMode) {
                        this.showNotification('Auto-saved', 'info', 1500);
                    }
                }
                break;
                
            case 'save-failed':
                this.showSaveError(data.error);
                if (this.notificationSettings.showErrorNotifications) {
                    this.showNotification(`Auto-save failed: ${data.error}`, 'error', 4000);
                }
                break;
                
            case 'save-retry':
                this.showSaving(`Retrying... (${data.retryCount}/${data.maxRetries})`);
                break;
                
            case 'backup-created':
                if (this.notificationSettings.showSuccessNotifications) {
                    this.showNotification(`Backup created: ${data.filename}`, 'info', 3000);
                }
                break;
                
            case 'backup-cleanup':
                if (data.cleanedCount > 0) {
                    this.showNotification(`Cleaned up ${data.cleanedCount} old backups`, 'info', 2000);
                }
                break;
                
            case 'disk-space-warning':
                this.showDiskSpaceWarning(data.usagePercentage);
                break;
                
            case 'auto-save-error':
                this.showSaveError(data.error);
                if (this.notificationSettings.showErrorNotifications) {
                    this.showNotification(`Auto-save system error: ${data.error}`, 'error', 6000);
                }
                break;
        }
    },
    
    /**
     * Show save success indicator
     * @param {string} message - Success message
     */
    showSaveSuccess(message = 'Saved') {
        this.showIndicator(message, 'success', 3000);
    },
    
    /**
     * Show auto-save success indicator (more discrete)
     */
    showAutoSaveSuccess() {
        if (this.notificationSettings.discreteMode) {
            this.showIndicator('Auto-saved', 'success', 1500);
        } else {
            this.showIndicator('Auto-saved', 'success', 2000);
        }
    },
    
    /**
     * Show save error indicator
     * @param {string} error - Error message
     */
    showSaveError(error) {
        this.showIndicator(`Save failed: ${error}`, 'error', 5000);
    },
    
    /**
     * Show saving indicator
     * @param {string} message - Saving message
     */
    showSaving(message = 'Saving...') {
        this.showIndicator(message, 'saving', 0); // No auto-hide for saving state
    },
    
    /**
     * Show disk space warning
     * @param {number} usagePercentage - Disk usage percentage
     */
    showDiskSpaceWarning(usagePercentage) {
        const message = `Disk space: ${Math.round(usagePercentage)}% used`;
        this.showIndicator(message, 'error', 8000);
        
        if (this.notificationSettings.showErrorNotifications) {
            this.showNotification(`Warning: ${message}`, 'warning', 8000);
        }
    },
    
    /**
     * Show last save time
     */
    showLastSaveTime() {
        if (this.lastSaveTime) {
            const date = new Date(this.lastSaveTime);
            const timeString = date.toLocaleTimeString();
            this.showIndicator(`Last saved: ${timeString}`, 'info', 4000);
        } else {
            this.showIndicator('No recent saves', 'info', 3000);
        }
    },
    
    /**
     * Show status indicator
     * @param {string} message - Status message
     * @param {string} type - Status type (success, error, saving, info)
     * @param {number} duration - Duration in milliseconds (0 = no auto-hide)
     */
    showIndicator(message, type = 'info', duration = 3000) {
        // Clear existing timeout
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }
        
        // Update content
        this.statusText.text(message);
        
        // Update timestamp if it's a save success
        if (type === 'success' && this.lastSaveTime) {
            const date = new Date(this.lastSaveTime);
            this.statusTime.text(date.toLocaleTimeString());
        } else {
            this.statusTime.text('');
        }
        
        // Update classes
        this.indicator.removeClass('saving error info success fade-in fade-out');
        this.indicator.addClass(type);
        
        // Show with animation
        if (!this.indicator.is(':visible')) {
            this.indicator.addClass('fade-in').show();
        }
        
        // Auto-hide after duration
        if (duration > 0) {
            this.currentTimeout = setTimeout(() => {
                this.hideIndicator();
            }, duration);
        }
    },
    
    /**
     * Hide status indicator
     */
    hideIndicator() {
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }
        
        this.indicator.addClass('fade-out');
        setTimeout(() => {
            this.indicator.hide().removeClass('fade-out');
        }, 300);
    },
    
    /**
     * Show notification using the notification manager
     * @param {string} message - Notification message
     * @param {string} type - Notification type
     * @param {number} duration - Duration in milliseconds
     */
    showNotification(message, type, duration) {
        if (window.notificationManager) {
            window.notificationManager.showNotification(message, type, duration);
        } else {
            // Fallback to console
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    },
    
    /**
     * Toggle notification settings
     * @param {string} setting - Setting name
     * @param {boolean} value - Setting value
     */
    updateNotificationSetting(setting, value) {
        if (this.notificationSettings.hasOwnProperty(setting)) {
            this.notificationSettings[setting] = value;
            this.saveNotificationSettings();
            
            // Show feedback
            const settingName = setting.replace(/([A-Z])/g, ' $1').toLowerCase();
            this.showNotification(`${settingName} ${value ? 'enabled' : 'disabled'}`, 'info', 2000);
        }
    },
    
    /**
     * Load notification settings from localStorage
     */
    loadNotificationSettings() {
        try {
            const saved = localStorage.getItem('saveNotificationSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                Object.assign(this.notificationSettings, settings);
            }
        } catch (error) {
            console.warn('Error loading notification settings:', error);
        }
    },
    
    /**
     * Save notification settings to localStorage
     */
    saveNotificationSettings() {
        try {
            localStorage.setItem('saveNotificationSettings', JSON.stringify(this.notificationSettings));
        } catch (error) {
            console.warn('Error saving notification settings:', error);
        }
    },
    
    /**
     * Get current notification settings
     * @returns {Object} Current settings
     */
    getNotificationSettings() {
        return { ...this.notificationSettings };
    },
    
    /**
     * Manual trigger for testing
     */
    testNotifications() {
        this.showSaving('Testing save...');
        
        setTimeout(() => {
            this.showSaveSuccess('Test save completed');
            this.showNotification('Test notification: Save successful', 'success', 3000);
        }, 2000);
        
        setTimeout(() => {
            this.showLastSaveTime();
        }, 4000);
    },
    
    /**
     * Get save statistics for display
     * @returns {Object} Statistics object
     */
    async getStatistics() {
        if (window.saveStateManager && window.saveStateManager.getSaveStatistics) {
            return await window.saveStateManager.getSaveStatistics();
        }
        
        return {
            lastSaveTime: this.lastSaveTime,
            notificationSettings: this.notificationSettings
        };
    }
};

// Initialize when DOM is ready
$(document).ready(function() {
    skidinc.saveStatusManager.init();
});

// Add keyboard shortcut to show last save time (Ctrl+Shift+S)
$(document).on('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        if (skidinc.saveStatusManager) {
            skidinc.saveStatusManager.showLastSaveTime();
        }
    }
});