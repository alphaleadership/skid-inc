#!/usr/bin/env node

/**
 * Enhanced Error Handler for Build Process
 * 
 * Captures and logs detailed error information during builds
 */

const fs = require('fs');
const path = require('path');

// Enhanced error logging
function logBuildError(error, context = {}) {
  const timestamp = new Date().toISOString();
  const errorLog = {
    timestamp,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    },
    context: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memory: {
        total: require('os').totalmem(),
        free: require('os').freemem()
      },
      ...context
    }
  };

  // Create error logs directory if it doesn't exist
  const errorLogsDir = path.join(process.cwd(), 'build-logs');
  if (!fs.existsSync(errorLogsDir)) {
    fs.mkdirSync(errorLogsDir, { recursive: true });
  }

  // Write error log
  const errorLogFile = path.join(errorLogsDir, `build-error-${Date.now()}.json`);
  fs.writeFileSync(errorLogFile, JSON.stringify(errorLog, null, 2));

  console.error(`\n❌ Build Error Details:`);
  console.error(`📝 Error logged to: ${errorLogFile}`);
  console.error(`🔍 Error: ${error.message}`);
  console.error(`⏰ Time: ${timestamp}`);
  
  if (error.stack) {
    console.error(`📚 Stack trace available in log file`);
  }

  // Provide troubleshooting suggestions
  console.error(`\n💡 Troubleshooting:`);
  
  if (error.message.includes('memory') || error.message.includes('allocate')) {
    console.error(`- Memory issue detected. Try: npm run build:win (portable only)`);
    console.error(`- Close other applications or restart your computer`);
  }
  
  if (error.message.includes('ENOENT') || error.message.includes('file not found')) {
    console.error(`- Missing file. Run: npm run build:debug to check required files`);
    console.error(`- Ensure all required files exist: icons/icon.png, favicon.png`);
  }
  
  if (error.message.includes('permission')) {
    console.error(`- Permission issue. Try running as administrator`);
    console.error(`- Check if dist/ directory is writable`);
  }
  
  console.error(`- Run: npm run build:debug for comprehensive analysis`);
  console.error(`- Check build logs: ${errorLogFile}`);
}

// Export for use in other scripts
module.exports = { logBuildError };

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logBuildError(error, { type: 'uncaughtException' });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logBuildError(new Error(reason), { type: 'unhandledRejection', promise });
  process.exit(1);
});
