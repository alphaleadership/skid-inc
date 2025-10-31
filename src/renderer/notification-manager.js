/**
 * NotificationManager - Handles user notifications for save operations and system events
 * Provides a centralized notification system for the renderer process
 */
class NotificationManager {
  constructor() {
    this.notifications = [];
    this.maxNotifications = 5;
    this.defaultDuration = 3000;
    this.container = null;
    this.notificationId = 0;
    
    this.initializeContainer();
  }

  /**
   * Initialize the notification container
   */
  initializeContainer() {
    // Create notification container if it doesn't exist
    this.container = document.getElementById('notification-container');
    
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'notification-container';
      this.container.className = 'notification-container';
      
      // Style the container
      Object.assign(this.container.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: '10000',
        pointerEvents: 'none',
        maxWidth: '350px'
      });
      
      document.body.appendChild(this.container);
    }
  }

  /**
   * Show a success notification
   * @param {string} message - Success message
   * @param {number} duration - Duration in milliseconds
   */
  showSaveSuccess(message = 'Game saved successfully', duration = this.defaultDuration) {
    this.showNotification(message, 'success', duration);
  }

  /**
   * Show an error notification
   * @param {string} error - Error message
   * @param {number} duration - Duration in milliseconds
   */
  showSaveError(error, duration = 5000) {
    this.showNotification(`Save failed: ${error}`, 'error', duration);
  }

  /**
   * Show last save time notification
   * @param {number} timestamp - Timestamp of last save
   * @param {number} duration - Duration in milliseconds
   */
  showLastSaveTime(timestamp, duration = 2000) {
    const date = new Date(timestamp);
    const timeString = date.toLocaleTimeString();
    this.showNotification(`Last saved: ${timeString}`, 'info', duration);
  }

  /**
   * Show migration prompt notification
   * @param {Object} data - Migration data
   */
  showMigrationPrompt(data) {
    const message = 'Previous save data found. Would you like to migrate it?';
    this.showNotification(message, 'warning', 10000, {
      persistent: true,
      actions: [
        {
          text: 'Migrate',
          action: () => this.handleMigrationAccept(data)
        },
        {
          text: 'Skip',
          action: () => this.handleMigrationDecline(data)
        }
      ]
    });
  }

  /**
   * Show auto-save status notification
   * @param {boolean} enabled - Whether auto-save is enabled
   */
  showAutoSaveStatus(enabled) {
    const message = `Auto-save ${enabled ? 'enabled' : 'disabled'}`;
    const type = enabled ? 'success' : 'warning';
    this.showNotification(message, type, 2000);
  }

  /**
   * Show backup creation notification
   * @param {string} filename - Backup filename
   */
  showBackupCreated(filename) {
    this.showNotification(`Backup created: ${filename}`, 'info', 3000);
  }

  /**
   * Show disk space warning
   * @param {number} usagePercentage - Disk usage percentage
   */
  showDiskSpaceWarning(usagePercentage) {
    const message = `Disk space warning: ${Math.round(usagePercentage)}% used`;
    const actions = usagePercentage > 90 ? [
      {
        text: 'Clean Up',
        action: () => this.triggerCleanup()
      },
      {
        text: 'View Files',
        action: () => this.openSaveManager()
      }
    ] : [];
    
    this.showNotification(message, 'warning', 8000, {
      persistent: usagePercentage > 95,
      actions: actions
    });
  }

  /**
   * Show auto-save status notification
   * @param {string} status - Auto-save status
   * @param {Object} data - Additional data
   */
  showAutoSaveStatus(status, data = {}) {
    switch (status) {
      case 'enabled':
        this.showNotification('Auto-save enabled', 'success', 2000);
        break;
      case 'disabled':
        this.showNotification('Auto-save disabled', 'warning', 2000);
        break;
      case 'paused':
        this.showNotification('Auto-save paused', 'warning', 3000);
        break;
      case 'resumed':
        this.showNotification('Auto-save resumed', 'info', 2000);
        break;
      case 'config-updated':
        this.showNotification('Auto-save settings updated', 'info', 2000);
        break;
    }
  }

  /**
   * Show save operation progress
   * @param {string} operation - Operation type
   * @param {number} progress - Progress percentage (0-100)
   */
  showSaveProgress(operation, progress) {
    const message = `${operation}: ${Math.round(progress)}%`;
    this.showNotification(message, 'info', 0, { persistent: true });
  }

  /**
   * Show batch operation result
   * @param {string} operation - Operation type
   * @param {Object} results - Operation results
   */
  showBatchOperationResult(operation, results) {
    const { success, failed, total } = results;
    let message = `${operation} completed: ${success}/${total} successful`;
    
    if (failed > 0) {
      message += `, ${failed} failed`;
    }
    
    const type = failed > 0 ? 'warning' : 'success';
    this.showNotification(message, type, 4000);
  }

  /**
   * Trigger cleanup action
   */
  triggerCleanup() {
    if (window.saveStateManager && typeof window.saveStateManager.cleanupOldSaves === 'function') {
      window.saveStateManager.cleanupOldSaves();
    } else {
      console.warn('Cleanup function not available');
    }
  }

  /**
   * Open save manager
   */
  openSaveManager() {
    $('#modal-save-manager').modal('show');
  }

  /**
   * Show load success notification
   * @param {string} filename - Loaded filename
   */
  showLoadSuccess(filename) {
    this.showNotification(`Game loaded: ${filename}`, 'success', 2000);
  }

  /**
   * Show load error notification
   * @param {string} error - Error message
   */
  showLoadError(error) {
    this.showNotification(`Load failed: ${error}`, 'error', 5000);
  }

  /**
   * Show generic notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, error, warning, info)
   * @param {number} duration - Duration in milliseconds
   * @param {Object} options - Additional options
   */
  showNotification(message, type = 'info', duration = this.defaultDuration, options = {}) {
    // Limit number of notifications
    if (this.notifications.length >= this.maxNotifications) {
      this.removeOldestNotification();
    }

    const notificationId = ++this.notificationId;
    const notification = this.createNotificationElement(message, type, notificationId, options);
    
    // Add to container
    this.container.appendChild(notification);
    
    // Add to tracking array
    this.notifications.push({
      id: notificationId,
      element: notification,
      type: type,
      message: message,
      timestamp: Date.now()
    });

    // Auto-remove after duration (unless persistent)
    if (!options.persistent && duration > 0) {
      setTimeout(() => {
        this.removeNotification(notificationId);
      }, duration);
    }

    // Animate in
    requestAnimationFrame(() => {
      notification.style.transform = 'translateX(0)';
      notification.style.opacity = '1';
    });

    return notificationId;
  }

  /**
   * Create notification DOM element
   * @param {string} message - Notification message
   * @param {string} type - Notification type
   * @param {number} id - Notification ID
   * @param {Object} options - Additional options
   * @returns {HTMLElement} Notification element
   */
  createNotificationElement(message, type, id, options = {}) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.dataset.notificationId = id;
    
    // Base styles
    Object.assign(notification.style, {
      backgroundColor: this.getTypeColor(type),
      color: 'white',
      padding: '12px 16px',
      marginBottom: '8px',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      transform: 'translateX(100%)',
      opacity: '0',
      transition: 'all 0.3s ease-out',
      pointerEvents: 'auto',
      cursor: 'pointer',
      position: 'relative',
      wordWrap: 'break-word',
      maxWidth: '100%'
    });

    // Create message container
    const messageContainer = document.createElement('div');
    messageContainer.textContent = message;
    messageContainer.style.marginBottom = options.actions ? '8px' : '0';
    notification.appendChild(messageContainer);

    // Add actions if provided
    if (options.actions && options.actions.length > 0) {
      const actionsContainer = document.createElement('div');
      actionsContainer.style.display = 'flex';
      actionsContainer.style.gap = '8px';
      actionsContainer.style.marginTop = '8px';

      options.actions.forEach(action => {
        const button = document.createElement('button');
        button.textContent = action.text;
        button.onclick = (e) => {
          e.stopPropagation();
          action.action();
          this.removeNotification(id);
        };
        
        Object.assign(button.style, {
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '4px',
          padding: '4px 8px',
          fontSize: '12px',
          cursor: 'pointer',
          transition: 'background-color 0.2s'
        });
        
        button.onmouseover = () => {
          button.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
        };
        
        button.onmouseout = () => {
          button.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        };

        actionsContainer.appendChild(button);
      });

      notification.appendChild(actionsContainer);
    }

    // Add close button for persistent notifications
    if (options.persistent) {
      const closeButton = document.createElement('button');
      closeButton.innerHTML = '×';
      closeButton.onclick = (e) => {
        e.stopPropagation();
        this.removeNotification(id);
      };
      
      Object.assign(closeButton.style, {
        position: 'absolute',
        top: '4px',
        right: '8px',
        backgroundColor: 'transparent',
        color: 'white',
        border: 'none',
        fontSize: '18px',
        cursor: 'pointer',
        padding: '0',
        width: '20px',
        height: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      });

      notification.appendChild(closeButton);
    }

    // Click to dismiss (if not persistent or has actions)
    if (!options.persistent && (!options.actions || options.actions.length === 0)) {
      notification.onclick = () => {
        this.removeNotification(id);
      };
    }

    return notification;
  }

  /**
   * Get color for notification type
   * @param {string} type - Notification type
   * @returns {string} CSS color value
   */
  getTypeColor(type) {
    const colors = {
      success: '#4CAF50',
      error: '#f44336',
      warning: '#ff9800',
      info: '#2196F3'
    };
    return colors[type] || colors.info;
  }

  /**
   * Remove notification by ID
   * @param {number} notificationId - ID of notification to remove
   */
  removeNotification(notificationId) {
    const notificationIndex = this.notifications.findIndex(n => n.id === notificationId);
    
    if (notificationIndex === -1) {
      return;
    }

    const notification = this.notifications[notificationIndex];
    
    // Animate out
    notification.element.style.transform = 'translateX(100%)';
    notification.element.style.opacity = '0';
    
    // Remove from DOM after animation
    setTimeout(() => {
      if (notification.element.parentNode) {
        notification.element.parentNode.removeChild(notification.element);
      }
      
      // Remove from tracking array
      this.notifications.splice(notificationIndex, 1);
    }, 300);
  }

  /**
   * Remove oldest notification
   */
  removeOldestNotification() {
    if (this.notifications.length > 0) {
      const oldest = this.notifications[0];
      this.removeNotification(oldest.id);
    }
  }

  /**
   * Clear all notifications
   */
  clearAllNotifications() {
    const notificationIds = this.notifications.map(n => n.id);
    notificationIds.forEach(id => this.removeNotification(id));
  }

  /**
   * Handle migration acceptance
   * @param {Object} data - Migration data
   */
  handleMigrationAccept(data) {
    console.log('Migration accepted:', data);
    this.showNotification('Starting migration...', 'info', 2000);
    
    // Trigger migration process
    if (window.saveStateManager && typeof window.saveStateManager.startMigration === 'function') {
      window.saveStateManager.startMigration(data);
    }
  }

  /**
   * Handle migration decline
   * @param {Object} data - Migration data
   */
  handleMigrationDecline(data) {
    console.log('Migration declined:', data);
    this.showNotification('Migration skipped', 'info', 2000);
  }

  /**
   * Get notification statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    return {
      activeNotifications: this.notifications.length,
      maxNotifications: this.maxNotifications,
      totalNotifications: this.notificationId,
      notificationTypes: this.notifications.reduce((acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
      }, {})
    };
  }

  /**
   * Update notification settings
   * @param {Object} settings - Settings object
   */
  updateSettings(settings) {
    if (settings.maxNotifications !== undefined) {
      this.maxNotifications = Math.max(1, Math.min(10, settings.maxNotifications));
    }
    
    if (settings.defaultDuration !== undefined) {
      this.defaultDuration = Math.max(1000, settings.defaultDuration);
    }
  }

  /**
   * Cleanup method
   */
  cleanup() {
    this.clearAllNotifications();
    
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    this.notifications = [];
    this.container = null;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotificationManager;
}

// Make available globally
window.NotificationManager = NotificationManager;