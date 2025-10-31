/**
 * Save Manager UI - Handles the save management interface
 * Provides UI for listing, loading, deleting, and managing save files
 */
skidinc.saveManagerUI = {
    saves: [],
    filteredSaves: [],
    isLoading: false,
    
    /**
     * Initialize the save manager UI
     */
    init: function() {
        // Show save manager menu item only in Electron
        if (typeof window.electronAPI !== 'undefined') {
            $('#nav-save-manager').show();
        }
        
        // Bind event handlers
        this.bindEvents();
        
        console.log('Save Manager UI initialized');
    },
    
    /**
     * Bind event handlers
     */
    bindEvents: function() {
        // Modal events
        $('#modal-save-manager').on('show.bs.modal', () => {
            this.loadSaveList();
        });
        
        // Manual save button
        $('#save-manager-manual-save').on('click', () => {
            this.createManualSave();
        });
        
        // Create backup button
        $('#save-manager-create-backup').on('click', () => {
            this.createBackup();
        });
        
        // Search functionality
        $('#save-manager-search').on('input', (e) => {
            this.filterSaves(e.target.value);
        });
        
        // Clear search on escape
        $('#save-manager-search').on('keydown', (e) => {
            if (e.key === 'Escape') {
                e.target.value = '';
                this.filterSaves('');
            }
        });
    },
    
    /**
     * Load the list of save files
     */
    async loadSaveList() {
        if (!window.saveStateManager || !window.saveStateManager.isElectron) {
            this.showError('Save management is only available in Electron mode');
            return;
        }
        
        this.isLoading = true;
        this.showLoading();
        
        try {
            const saves = await window.saveStateManager.getSaveList();
            this.saves = saves.sort((a, b) => new Date(b.modified) - new Date(a.modified));
            this.filteredSaves = [...this.saves];
            
            this.renderSaveList();
            this.updateStats();
        } catch (error) {
            console.error('Error loading save list:', error);
            this.showError('Failed to load save files: ' + error.message);
        } finally {
            this.isLoading = false;
        }
    },
    
    /**
     * Filter saves based on search query
     * @param {string} query - Search query
     */
    filterSaves(query) {
        if (!query.trim()) {
            this.filteredSaves = [...this.saves];
        } else {
            const lowerQuery = query.toLowerCase();
            this.filteredSaves = this.saves.filter(save => 
                save.filename.toLowerCase().includes(lowerQuery) ||
                save.displayName?.toLowerCase().includes(lowerQuery) ||
                new Date(save.modified).toLocaleString().toLowerCase().includes(lowerQuery)
            );
        }
        
        this.renderSaveList();
    },
    
    /**
     * Render the save list
     */
    renderSaveList() {
        const container = $('#save-manager-list');
        
        if (this.filteredSaves.length === 0) {
            if (this.saves.length === 0) {
                container.html(this.getEmptyStateHTML());
            } else {
                container.html(this.getNoResultsHTML());
            }
            return;
        }
        
        const html = this.filteredSaves.map(save => this.renderSaveItem(save)).join('');
        container.html(html);
        
        // Bind action buttons
        this.bindSaveItemActions();
    },
    
    /**
     * Render a single save item
     * @param {Object} save - Save file object
     * @returns {string} HTML string
     */
    renderSaveItem(save) {
        const date = new Date(save.modified);
        const formattedDate = date.toLocaleString();
        const relativeTime = this.getRelativeTime(date);
        const typeClass = save.isBackup ? 'backup' : 'regular';
        const typeLabel = save.isBackup ? 'Backup' : 'Save';
        
        return `
            <div class="save-item ${save.isBackup ? 'backup' : ''}" data-filename="${save.filename}">
                <div class="save-item-header">
                    <h6 class="save-item-title">${save.displayName || save.filename}</h6>
                    <span class="save-item-type ${typeClass}">${typeLabel}</span>
                </div>
                
                <div class="save-item-info">
                    <div>
                        <span class="save-item-date" title="${formattedDate}">${relativeTime}</span>
                    </div>
                    <div>
                        <span class="save-item-size">${save.formattedSize || this.formatBytes(save.size || 0)}</span>
                    </div>
                </div>
                
                <div class="save-item-actions">
                    <button class="btn btn-primary btn-sm load-save" data-filename="${save.filename}">
                        <i class="fa fa-download" aria-hidden="true"></i> Load
                    </button>
                    ${!save.isBackup ? `
                        <button class="btn btn-info btn-sm duplicate-save" data-filename="${save.filename}">
                            <i class="fa fa-copy" aria-hidden="true"></i> Duplicate
                        </button>
                    ` : ''}
                    <button class="btn btn-danger btn-sm delete-save" data-filename="${save.filename}">
                        <i class="fa fa-trash" aria-hidden="true"></i> Delete
                    </button>
                </div>
            </div>
        `;
    },
    
    /**
     * Bind save item action buttons
     */
    bindSaveItemActions() {
        // Load save
        $('.load-save').off('click').on('click', (e) => {
            const filename = $(e.currentTarget).data('filename');
            this.loadSave(filename);
        });
        
        // Duplicate save
        $('.duplicate-save').off('click').on('click', (e) => {
            const filename = $(e.currentTarget).data('filename');
            this.duplicateSave(filename);
        });
        
        // Delete save
        $('.delete-save').off('click').on('click', (e) => {
            const filename = $(e.currentTarget).data('filename');
            this.deleteSave(filename);
        });
    },
    
    /**
     * Load a specific save file
     * @param {string} filename - Filename to load
     */
    async loadSave(filename) {
        if (!window.saveStateManager) {
            this.showError('Save system not available');
            return;
        }
        
        try {
            await window.saveStateManager.loadSpecificSave(filename);
            $('#modal-save-manager').modal('hide');
            
            if (window.notificationManager) {
                window.notificationManager.showLoadSuccess(filename);
            }
        } catch (error) {
            console.error('Error loading save:', error);
            if (window.notificationManager) {
                window.notificationManager.showLoadError(error.message);
            }
        }
    },
    
    /**
     * Duplicate a save file
     * @param {string} filename - Filename to duplicate
     */
    async duplicateSave(filename) {
        if (!window.saveStateManager) {
            this.showError('Save system not available');
            return;
        }
        
        try {
            // Load the save first
            const result = await window.electronAPI.loadSpecificSave(filename);
            if (!result.success) {
                throw new Error(result.error);
            }
            
            // Create a new save with the loaded data
            const saveResult = await window.electronAPI.saveGameState(result.gameState);
            if (saveResult.success) {
                if (window.notificationManager) {
                    window.notificationManager.showNotification(`Save duplicated: ${saveResult.filename}`, 'success');
                }
                this.loadSaveList(); // Refresh the list
            } else {
                throw new Error(saveResult.error);
            }
        } catch (error) {
            console.error('Error duplicating save:', error);
            if (window.notificationManager) {
                window.notificationManager.showNotification(`Failed to duplicate save: ${error.message}`, 'error');
            }
        }
    },
    
    /**
     * Delete a save file
     * @param {string} filename - Filename to delete
     */
    async deleteSave(filename) {
        // Confirm deletion
        if (!confirm(`Are you sure you want to delete "${filename}"?\n\nThis action cannot be undone.`)) {
            return;
        }
        
        if (!window.saveStateManager) {
            this.showError('Save system not available');
            return;
        }
        
        try {
            await window.saveStateManager.deleteSave(filename);
            this.loadSaveList(); // Refresh the list
        } catch (error) {
            console.error('Error deleting save:', error);
            if (window.notificationManager) {
                window.notificationManager.showNotification(`Failed to delete save: ${error.message}`, 'error');
            }
        }
    },
    
    /**
     * Create a manual save
     */
    async createManualSave() {
        if (!window.saveStateManager) {
            this.showError('Save system not available');
            return;
        }
        
        try {
            await window.saveStateManager.handleSaveRequest();
            this.loadSaveList(); // Refresh the list
        } catch (error) {
            console.error('Error creating manual save:', error);
        }
    },
    
    /**
     * Create a backup
     */
    async createBackup() {
        if (!window.saveStateManager) {
            this.showError('Save system not available');
            return;
        }
        
        try {
            await window.saveStateManager.createManualBackup();
            this.loadSaveList(); // Refresh the list
        } catch (error) {
            console.error('Error creating backup:', error);
        }
    },
    
    /**
     * Update statistics display
     */
    updateStats() {
        const totalSaves = this.saves.filter(s => !s.isBackup).length;
        const totalBackups = this.saves.filter(s => s.isBackup).length;
        const displayCount = this.filteredSaves.length;
        
        $('#save-manager-count').text(displayCount);
        $('#save-manager-stats').text(`Total: ${totalSaves} saves, ${totalBackups} backups`);
    },
    
    /**
     * Show loading state
     */
    showLoading() {
        $('#save-manager-list').html(`
            <div class="save-manager-loading">
                <i class="fa fa-spinner fa-spin" aria-hidden="true"></i>
                Loading save files...
            </div>
        `);
        $('#save-manager-count').text('...');
        $('#save-manager-stats').text('Loading...');
    },
    
    /**
     * Show error state
     * @param {string} message - Error message
     */
    showError(message) {
        $('#save-manager-list').html(`
            <div class="save-manager-error">
                <i class="fa fa-exclamation-triangle" aria-hidden="true"></i>
                <div>${message}</div>
            </div>
        `);
        $('#save-manager-count').text('0');
        $('#save-manager-stats').text('Error loading saves');
    },
    
    /**
     * Get empty state HTML
     * @returns {string} HTML string
     */
    getEmptyStateHTML() {
        return `
            <div class="save-list-empty">
                <i class="fa fa-floppy-o" aria-hidden="true"></i>
                <div>No save files found</div>
                <small>Create your first save to get started</small>
            </div>
        `;
    },
    
    /**
     * Get no results HTML
     * @returns {string} HTML string
     */
    getNoResultsHTML() {
        return `
            <div class="save-list-empty">
                <i class="fa fa-search" aria-hidden="true"></i>
                <div>No saves match your search</div>
                <small>Try a different search term</small>
            </div>
        `;
    },
    
    /**
     * Get relative time string
     * @param {Date} date - Date object
     * @returns {string} Relative time string
     */
    getRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    },
    
    /**
     * Format bytes to human readable string
     * @param {number} bytes - Number of bytes
     * @returns {string} Formatted string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
};

// Initialize when DOM is ready
$(document).ready(function() {
    skidinc.saveManagerUI.init();
});