skidinc.options = {};
skidinc.options.options = [{
    id: 'theme',
    desc: 'change the terminal theme (text colors, background).',
    accept: ['default', 'stardust', 'matrix'],
    exec: 'skidinc.options.switchTheme'
}, {
    id: 'invert',
    desc: 'toggle color/background inversion on the terminal.',
    accept: ['enable', 'disable'],
    exec: 'skidinc.options.switchInversion'
}, {
    id: 'typed',
    desc: 'toggle the typed text effect.',
    accept: ['enable', 'disable'],
    exec: 'skidinc.options.switchTyped'
}];
skidinc.options.themesUnlocked = [true, false, false];
skidinc.options.typed = true;
skidinc.options.matrixEnabled = false;

skidinc.options.tab = 'overview';
skidinc.options.tabs = ['overview', 'autoscripts', 'battery', 'prestige'];

skidinc.options.secondArgs = [];
skidinc.options.thirdArgs = [];

skidinc.options.list = function() {
    var str = '<y>OPTIONS LIST</y>:<br>';
    
    for (var option in skidinc.options.options) {
        var i = option,
            option = skidinc.options.options[i];
        
        str += '<b>-</b> <z>' + option.id + '</z>: ' + option.desc + ' (<b>' + option.accept.join(', ') + '</b>)<br>';
    };
    
    return skidinc.console.print(str);
};

skidinc.options.help = function() {
    var str = '<y>OPTION HELP</y> change in-game options using this command:<br>' +
        '<b>-</b> Options commands require <b>2 arguments</b>.<br>' +
        '<b>-</b> First argument is the option name.<br>' +
        '<b>-</b> Second argument is one of the supported arguments, displayed with <b>option -l/-list</b> command, between parentheses.';
    
    return skidinc.console.print(str);
};

skidinc.options.execute = function(args) {
    var exists = false,
        o;
    
    for (var option in skidinc.options.options) {
        var i = option,
            option = skidinc.options.options[i];
        
        if (args[0] == option.id) {
            exists = true;
            o = option;
        };
    };
    
    if (!exists)
        return skidinc.console.print('<x>ERR</x> <b>' + args[0] + '</b> is not a valid option name.');
    
    if (exists && args.length == 2)
        return eval(o.exec)(o, args[1]);
};

skidinc.options.switchTheme = function(opt, theme) {
    if (opt.accept.indexOf(theme) == -1)
        return skidinc.console.print('<x>ERR</x> <b>' + theme + '</b> theme doesn\'t exist.');
    
    if (!skidinc.options.themesUnlocked[opt.accept.indexOf(theme)])
        return skidinc.console.print('<x>ERR</x> you need to unlock <b>' + theme + '</b> theme. Themes are only available on the Kongregate version.');
    
    if ($('body').hasClass('inverted'))
        $('body').removeClass().addClass('noselect inverted ' + theme);
    else
        $('body').removeClass().addClass('noselect ' + theme);
    
    $('.game').removeClass().addClass('game ' + theme);
    $('.intro').removeClass().addClass('intro ' + theme);
    
    if (theme == 'matrix' && !skidinc.options.matrixEnabled) {
        skidinc.options.matrixEnabled = true;
        M.initBackground();
    };
    
    if (theme !== 'matrix' && skidinc.options.matrixEnabled) {
        skidinc.options.matrixEnabled = false;
        M.removeBackground();
    };
    
    return skidinc.console.print('<b>' + theme + '</b> theme enabled.');
};

skidinc.options.switchInversion = function(opt, invert, direct) {
    // called from an UI element
    if (direct) {
        if (!$('body').hasClass('inverted')) {
            $('body').addClass('inverted');
            $('.terminal').removeClass().addClass('terminal inverted');
        }
        else {
            $('body').removeClass('inverted');
            $('.terminal').removeClass().addClass('terminal');
        };
        
        return;
    };
    
    if (opt.accept.indexOf(invert) == -1)
        return skidinc.console.print('<x>ERR</x> <b>' + invert + '</b> is not a valid argument for <b>inversion</b> option.');
    
    if (invert == 'disable') {
        if (!$('body').hasClass('inverted'))
            $('body').addClass('inverted');
        $('.terminal').removeClass().addClass('terminal inverted');
    }
    else {
        $('body').removeClass('inverted');
        $('.terminal').removeClass().addClass('terminal');
    }
    
    return skidinc.console.print('Terminal inversion <b>' + invert + 'd</b>.');
};

skidinc.options.switchTyped = function(opt, typed, direct) {
    // called from an UI element
    if (direct) {
        skidinc.options.typed = !skidinc.options.typed;
        return;
    };
    
    if (opt.accept.indexOf(typed) == -1)
        return skidinc.console.print('<x>ERR</x> <b>' + typed + '</b> is not a valid argument for <b>typed</b> option.');
    
    typed == 'enable' ? skidinc.options.typed = true : skidinc.options.typed = false;
    
    return skidinc.console.print('Typed text effect <b>' + typed + 'd</b>.');
};

skidinc.options.changeTab = function(how) {
    if (how == 'right') {
        var i = skidinc.options.tabs.indexOf(skidinc.options.tab),
            tab = (typeof skidinc.options.tabs[i + 1] == 'string') ? skidinc.options.tabs[i + 1] : skidinc.options.tabs[i];
    };

    if (how == 'left') {
        var i = skidinc.options.tabs.indexOf(skidinc.options.tab),
            tab = (typeof skidinc.options.tabs[i - 1] == 'string') ? skidinc.options.tabs[i - 1] : skidinc.options.tabs[i];
    };

    skidinc.options.tab = tab;

    $('.nav-tabs a[href="#stats-' + tab + '"]').tab('show');
};

skidinc.options.domInit = function() {
    $('#option-inversion').on('click', function() {
        skidinc.options.switchInversion(null, null, true)
    });
    
    $('#option-typed').on('click', function() {
        skidinc.options.switchTyped(null, null, true)
    });
    
    $('#option-save').on('click', function() {
        skidinc.save.saveNow(true);
    });
    
    $('#option-erase').on('click', function() {
        skidinc.save.eraseNow();
    });
    
    // Electron-specific options
    if (typeof window.electronAPI !== 'undefined') {
        $('#electron-migration-options').show();
        $('#electron-save-options').show();
        $('#electron-notification-options').show();
        $('#electron-notification-mode').show();
        
        // Migration options
        $('#option-migrate').on('click', function() {
            skidinc.options.triggerMigration();
        });
        
        $('#option-migration-stats').on('click', function() {
            skidinc.options.showMigrationStats();
        });
        
        // Save options
        $('#option-auto-load').on('click', function() {
            skidinc.options.toggleAutoLoad();
        });
        
        $('#option-save-list').on('click', function() {
            skidinc.options.showSaveList();
        });
        
        // Notification options
        $('#option-success-notifications').on('click', function() {
            skidinc.options.toggleSuccessNotifications();
        });
        
        $('#option-error-notifications').on('click', function() {
            skidinc.options.toggleErrorNotifications();
        });
        
        $('#option-auto-save-notifications').on('click', function() {
            skidinc.options.toggleAutoSaveNotifications();
        });
        
        $('#option-discrete-mode').on('click', function() {
            skidinc.options.toggleDiscreteMode();
        });
        
        $('#option-show-last-save').on('click', function() {
            skidinc.options.showLastSaveTime();
        });
        
        // Update button states
        skidinc.options.updateAutoLoadButton();
        skidinc.options.updateNotificationButtons();
    }
    
    $('#option-version').html('v' + skidinc.version.toFixed(2));
};

// Migration-related functions for Electron
skidinc.options.triggerMigration = function() {
    if (typeof window.migrationUIManager !== 'undefined') {
        window.migrationUIManager.manualMigrationCheck().then(() => {
            console.log('Manual migration check completed');
        }).catch(error => {
            console.error('Manual migration check failed:', error);
        });
    } else {
        console.warn('Migration UI Manager not available');
    }
};

skidinc.options.showMigrationStats = function() {
    if (typeof window.migrationUIManager !== 'undefined') {
        window.migrationUIManager.getMigrationStatistics().then(stats => {
            let message = '<y>MIGRATION STATISTICS</y>:<br>';
            
            if (stats.error) {
                message += '<x>Error:</x> ' + stats.error + '<br>';
            } else {
                message += '<b>Migration Completed:</b> ' + (stats.migrationCompleted ? 'Yes' : 'No') + '<br>';
                message += '<b>Migrated Files:</b> ' + (stats.migratedFilesCount || 0) + '<br>';
                message += '<b>Backup Files:</b> ' + (stats.backupFilesCount || 0) + '<br>';
                message += '<b>Total Size:</b> ' + skidinc.options.formatBytes(stats.totalMigratedSize || 0) + '<br>';
                
                if (stats.migratedFiles && stats.migratedFiles.length > 0) {
                    message += '<b>Files:</b><br>';
                    stats.migratedFiles.forEach(file => {
                        message += '  - ' + file.filename + ' (' + file.type + ', ' + skidinc.options.formatBytes(file.size) + ')<br>';
                    });
                }
            }
            
            if (typeof skidinc.console !== 'undefined' && skidinc.console.print) {
                skidinc.console.print(message);
            } else {
                console.log('Migration Statistics:', stats);
            }
        }).catch(error => {
            console.error('Failed to get migration statistics:', error);
            if (typeof skidinc.console !== 'undefined' && skidinc.console.print) {
                skidinc.console.print('<x>Error:</x> Failed to get migration statistics: ' + error.message);
            }
        });
    } else {
        console.warn('Migration UI Manager not available');
        if (typeof skidinc.console !== 'undefined' && skidinc.console.print) {
            skidinc.console.print('<x>Error:</x> Migration system not available');
        }
    }
};

skidinc.options.formatBytes = function(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Test function for auto-load (for debugging)
skidinc.options.testAutoLoad = function() {
    if (typeof window.saveStateManager !== 'undefined') {
        console.log('Testing auto-load functionality...');
        window.saveStateManager.loadLatestSaveOnStartup().then(() => {
            console.log('Auto-load test completed');
            if (typeof skidinc.console !== 'undefined' && skidinc.console.print) {
                skidinc.console.print('<z>AUTO-LOAD</z> test completed successfully.');
            }
        }).catch(error => {
            console.error('Auto-load test failed:', error);
            if (typeof skidinc.console !== 'undefined' && skidinc.console.print) {
                skidinc.console.print('<x>Error:</x> Auto-load test failed: ' + error.message);
            }
        });
    } else {
        console.warn('Save State Manager not available for testing');
        if (typeof skidinc.console !== 'undefined' && skidinc.console.print) {
            skidinc.console.print('<x>Error:</x> Save system not available for testing');
        }
    }
};

// Auto-load toggle function
skidinc.options.toggleAutoLoad = function() {
    if (typeof window.saveStateManager !== 'undefined') {
        const currentState = window.saveStateManager.autoLoadEnabled;
        window.saveStateManager.setAutoLoadEnabled(!currentState);
        skidinc.options.updateAutoLoadButton();
    } else {
        console.warn('Save State Manager not available');
        if (typeof skidinc.console !== 'undefined' && skidinc.console.print) {
            skidinc.console.print('<x>Error:</x> Save system not available');
        }
    }
};

// Update auto-load button text
skidinc.options.updateAutoLoadButton = function() {
    if (typeof window.saveStateManager !== 'undefined') {
        const isEnabled = window.saveStateManager.autoLoadEnabled;
        const button = $('#option-auto-load');
        const text = $('#auto-load-text');
        
        if (isEnabled) {
            text.text('Disable Auto-load');
            button.removeClass('btn-outline-warning').addClass('btn-outline-success');
        } else {
            text.text('Enable Auto-load');
            button.removeClass('btn-outline-success').addClass('btn-outline-warning');
        }
    }
};

// Show save files list
skidinc.options.showSaveList = function() {
    if (typeof window.saveStateManager !== 'undefined') {
        window.saveStateManager.getSaveList().then(saves => {
            let message = '<y>SAVE FILES LIST</y>:<br>';
            
            if (saves.length === 0) {
                message += '<b>No save files found.</b><br>';
            } else {
                message += '<b>Total files:</b> ' + saves.length + '<br><br>';
                
                saves.forEach((save, index) => {
                    const date = new Date(save.modified).toLocaleString();
                    const type = save.isBackup ? '[BACKUP]' : '[SAVE]';
                    message += '<b>' + (index + 1) + '.</b> ' + type + ' ' + save.filename + '<br>';
                    message += '   Size: ' + save.formattedSize + ', Modified: ' + date + '<br>';
                });
            }
            
            if (typeof skidinc.console !== 'undefined' && skidinc.console.print) {
                skidinc.console.print(message);
            } else {
                console.log('Save Files:', saves);
            }
        }).catch(error => {
            console.error('Failed to get save list:', error);
            if (typeof skidinc.console !== 'undefined' && skidinc.console.print) {
                skidinc.console.print('<x>Error:</x> Failed to get save list: ' + error.message);
            }
        });
    } else {
        console.warn('Save State Manager not available');
        if (typeof skidinc.console !== 'undefined' && skidinc.console.print) {
            skidinc.console.print('<x>Error:</x> Save system not available');
        }
    }
};

// Notification management functions
skidinc.options.toggleSuccessNotifications = function() {
    if (typeof window.skidinc.saveStatusManager !== 'undefined') {
        const current = window.skidinc.saveStatusManager.getNotificationSettings().showSuccessNotifications;
        window.skidinc.saveStatusManager.updateNotificationSetting('showSuccessNotifications', !current);
        skidinc.options.updateNotificationButtons();
    }
};

skidinc.options.toggleErrorNotifications = function() {
    if (typeof window.skidinc.saveStatusManager !== 'undefined') {
        const current = window.skidinc.saveStatusManager.getNotificationSettings().showErrorNotifications;
        window.skidinc.saveStatusManager.updateNotificationSetting('showErrorNotifications', !current);
        skidinc.options.updateNotificationButtons();
    }
};

skidinc.options.toggleAutoSaveNotifications = function() {
    if (typeof window.skidinc.saveStatusManager !== 'undefined') {
        const current = window.skidinc.saveStatusManager.getNotificationSettings().showAutoSaveNotifications;
        window.skidinc.saveStatusManager.updateNotificationSetting('showAutoSaveNotifications', !current);
        skidinc.options.updateNotificationButtons();
    }
};

skidinc.options.toggleDiscreteMode = function() {
    if (typeof window.skidinc.saveStatusManager !== 'undefined') {
        const current = window.skidinc.saveStatusManager.getNotificationSettings().discreteMode;
        window.skidinc.saveStatusManager.updateNotificationSetting('discreteMode', !current);
        skidinc.options.updateNotificationButtons();
    }
};

skidinc.options.showLastSaveTime = function() {
    if (typeof window.skidinc.saveStatusManager !== 'undefined') {
        window.skidinc.saveStatusManager.showLastSaveTime();
    } else {
        console.warn('Save Status Manager not available');
        if (typeof skidinc.console !== 'undefined' && skidinc.console.print) {
            skidinc.console.print('<x>Error:</x> Save system not available');
        }
    }
};

// Update notification button states
skidinc.options.updateNotificationButtons = function() {
    if (typeof window.skidinc.saveStatusManager !== 'undefined') {
        const settings = window.skidinc.saveStatusManager.getNotificationSettings();
        
        // Success notifications
        const successBtn = $('#option-success-notifications');
        const successText = $('#success-notifications-text');
        if (settings.showSuccessNotifications) {
            successText.text('Success: ON');
            successBtn.removeClass('btn-outline-success').addClass('btn-success');
        } else {
            successText.text('Success: OFF');
            successBtn.removeClass('btn-success').addClass('btn-outline-success');
        }
        
        // Error notifications
        const errorBtn = $('#option-error-notifications');
        const errorText = $('#error-notifications-text');
        if (settings.showErrorNotifications) {
            errorText.text('Errors: ON');
            errorBtn.removeClass('btn-outline-danger').addClass('btn-danger');
        } else {
            errorText.text('Errors: OFF');
            errorBtn.removeClass('btn-danger').addClass('btn-outline-danger');
        }
        
        // Auto-save notifications
        const autoSaveBtn = $('#option-auto-save-notifications');
        const autoSaveText = $('#auto-save-notifications-text');
        if (settings.showAutoSaveNotifications) {
            autoSaveText.text('Auto-save: ON');
            autoSaveBtn.removeClass('btn-outline-info').addClass('btn-info');
        } else {
            autoSaveText.text('Auto-save: OFF');
            autoSaveBtn.removeClass('btn-info').addClass('btn-outline-info');
        }
        
        // Discrete mode
        const discreteBtn = $('#option-discrete-mode');
        const discreteText = $('#discrete-mode-text');
        if (settings.discreteMode) {
            discreteText.text('Discrete: ON');
            discreteBtn.removeClass('btn-outline-secondary').addClass('btn-secondary');
        } else {
            discreteText.text('Discrete: OFF');
            discreteBtn.removeClass('btn-secondary').addClass('btn-outline-secondary');
        }
    }
};

skidinc.options.init = function() {
    skidinc.options.options.forEach(function(i) {
        skidinc.options.secondArgs.push(i.id);
    });
    
    skidinc.options.thirdArgs.push('enable', 'disable');
};