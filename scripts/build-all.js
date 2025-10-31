#!/usr/bin/env node

/**
 * Automated build script for Skid-Inc
 * Builds the application for all platforms with proper error handling and logging
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const BUILD_CONFIG = {
  platforms: ['win', 'mac', 'linux'],
  outputDir: 'dist',
  logFile: 'build.log',
  maxRetries: 3,
  timeout: 300000 // 5 minutes per platform
};

// Logging utilities
class Logger {
  constructor(logFile) {
    this.logFile = logFile;
    this.startTime = Date.now();
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    
    console.log(logMessage);
    
    // Append to log file
    try {
      fs.appendFileSync(this.logFile, logMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  info(message) { this.log(message, 'INFO'); }
  warn(message) { this.log(message, 'WARN'); }
  error(message) { this.log(message, 'ERROR'); }
  success(message) { this.log(message, 'SUCCESS'); }

  getDuration() {
    return Math.round((Date.now() - this.startTime) / 1000);
  }
}

// Build utilities
class BuildManager {
  constructor(logger) {
    this.logger = logger;
    this.results = {
      success: [],
      failed: [],
      skipped: []
    };
  }

  async validateEnvironment() {
    this.logger.info('Validating build environment...');
    
    // Check Node.js version
    const nodeVersion = process.version;
    this.logger.info(`Node.js version: ${nodeVersion}`);
    
    // Check if package.json exists
    if (!fs.existsSync('package.json')) {
      throw new Error('package.json not found');
    }
    
    // Check if electron-builder is installed
    try {
      execSync('npx electron-builder --version', { stdio: 'pipe' });
      this.logger.info('electron-builder is available');
    } catch (error) {
      throw new Error('electron-builder not found. Run: npm install');
    }
    
    // Check if main files exist
    const requiredFiles = ['src/main.js', 'index.html'];
    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }
    
    this.logger.success('Environment validation passed');
  }

  async cleanBuildDirectory() {
    this.logger.info('Cleaning build directory...');
    
    if (fs.existsSync(BUILD_CONFIG.outputDir)) {
      try {
        fs.rmSync(BUILD_CONFIG.outputDir, { recursive: true, force: true });
        this.logger.info('Build directory cleaned');
      } catch (error) {
        this.logger.warn(`Failed to clean build directory: ${error.message}`);
      }
    }
  }

  async buildPlatform(platform, attempt = 1) {
    this.logger.info(`Building for ${platform} (attempt ${attempt}/${BUILD_CONFIG.maxRetries})...`);
    
    return new Promise((resolve, reject) => {
      const buildCommand = `npm run build:${platform}`;
      const startTime = Date.now();
      
      const buildProcess = spawn('npm', ['run', `build:${platform}`], {
        stdio: 'pipe',
        shell: true
      });
      
      let stdout = '';
      let stderr = '';
      
      buildProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      buildProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      // Set timeout
      const timeout = setTimeout(() => {
        buildProcess.kill();
        reject(new Error(`Build timeout for ${platform}`));
      }, BUILD_CONFIG.timeout);
      
      buildProcess.on('close', (code) => {
        clearTimeout(timeout);
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        if (code === 0) {
          this.logger.success(`${platform} build completed in ${duration}s`);
          this.results.success.push({ platform, duration, attempt });
          resolve({ platform, success: true, duration });
        } else {
          this.logger.error(`${platform} build failed (exit code: ${code})`);
          if (stderr) {
            this.logger.error(`Error output: ${stderr.slice(-500)}`); // Last 500 chars
          }
          
          if (attempt < BUILD_CONFIG.maxRetries) {
            this.logger.info(`Retrying ${platform} build...`);
            setTimeout(() => {
              this.buildPlatform(platform, attempt + 1)
                .then(resolve)
                .catch(reject);
            }, 2000); // Wait 2 seconds before retry
          } else {
            this.results.failed.push({ platform, error: stderr, attempts: attempt });
            reject(new Error(`${platform} build failed after ${attempt} attempts`));
          }
        }
      });
      
      buildProcess.on('error', (error) => {
        clearTimeout(timeout);
        this.logger.error(`Failed to start ${platform} build: ${error.message}`);
        reject(error);
      });
    });
  }

  async buildAll() {
    this.logger.info('Starting automated build process...');
    
    try {
      await this.validateEnvironment();
      await this.cleanBuildDirectory();
      
      // Determine which platforms to build based on current OS
      const currentPlatform = os.platform();
      let platformsToBuild = BUILD_CONFIG.platforms;
      
      // On non-macOS systems, skip macOS builds (requires Xcode)
      if (currentPlatform !== 'darwin') {
        platformsToBuild = platformsToBuild.filter(p => p !== 'mac');
        this.logger.warn('Skipping macOS build (requires macOS with Xcode)');
        this.results.skipped.push({ platform: 'mac', reason: 'Not running on macOS' });
      }
      
      // Build each platform
      for (const platform of platformsToBuild) {
        try {
          await this.buildPlatform(platform);
        } catch (error) {
          this.logger.error(`Failed to build ${platform}: ${error.message}`);
          // Continue with other platforms
        }
      }
      
      this.generateBuildReport();
      
    } catch (error) {
      this.logger.error(`Build process failed: ${error.message}`);
      process.exit(1);
    }
  }

  generateBuildReport() {
    this.logger.info('Generating build report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      duration: this.getDuration(),
      results: this.results,
      artifacts: this.listArtifacts()
    };
    
    // Write report to file
    const reportPath = path.join(BUILD_CONFIG.outputDir, 'build-report.json');
    try {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      this.logger.info(`Build report saved to ${reportPath}`);
    } catch (error) {
      this.logger.warn(`Failed to save build report: ${error.message}`);
    }
    
    // Print summary
    this.printSummary();
  }

  listArtifacts() {
    const artifacts = [];
    
    if (fs.existsSync(BUILD_CONFIG.outputDir)) {
      try {
        const files = fs.readdirSync(BUILD_CONFIG.outputDir);
        for (const file of files) {
          const filePath = path.join(BUILD_CONFIG.outputDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.isFile() && (file.endsWith('.exe') || file.endsWith('.dmg') || file.endsWith('.AppImage') || file.endsWith('.deb') || file.endsWith('.rpm'))) {
            artifacts.push({
              name: file,
              size: stats.size,
              created: stats.birthtime
            });
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to list artifacts: ${error.message}`);
      }
    }
    
    return artifacts;
  }

  printSummary() {
    const totalDuration = this.getDuration();
    
    this.logger.info('='.repeat(60));
    this.logger.info('BUILD SUMMARY');
    this.logger.info('='.repeat(60));
    this.logger.info(`Total duration: ${totalDuration}s`);
    this.logger.info(`Successful builds: ${this.results.success.length}`);
    this.logger.info(`Failed builds: ${this.results.failed.length}`);
    this.logger.info(`Skipped builds: ${this.results.skipped.length}`);
    
    if (this.results.success.length > 0) {
      this.logger.success('Successful platforms:');
      this.results.success.forEach(result => {
        this.logger.success(`  - ${result.platform} (${result.duration}s)`);
      });
    }
    
    if (this.results.failed.length > 0) {
      this.logger.error('Failed platforms:');
      this.results.failed.forEach(result => {
        this.logger.error(`  - ${result.platform} (${result.attempts} attempts)`);
      });
    }
    
    if (this.results.skipped.length > 0) {
      this.logger.warn('Skipped platforms:');
      this.results.skipped.forEach(result => {
        this.logger.warn(`  - ${result.platform} (${result.reason})`);
      });
    }
    
    const artifacts = this.listArtifacts();
    if (artifacts.length > 0) {
      this.logger.info('Generated artifacts:');
      artifacts.forEach(artifact => {
        const sizeMB = Math.round(artifact.size / 1024 / 1024 * 100) / 100;
        this.logger.info(`  - ${artifact.name} (${sizeMB} MB)`);
      });
    }
    
    this.logger.info('='.repeat(60));
    
    if (this.results.failed.length === 0) {
      this.logger.success('All builds completed successfully!');
      process.exit(0);
    } else {
      this.logger.error('Some builds failed. Check the log for details.');
      process.exit(1);
    }
  }

  getDuration() {
    return this.logger.getDuration();
  }
}

// Main execution
async function main() {
  const logger = new Logger(BUILD_CONFIG.logFile);
  const buildManager = new BuildManager(logger);
  
  logger.info('Skid-Inc Automated Build Script');
  logger.info(`Platform: ${os.platform()} ${os.arch()}`);
  logger.info(`Node.js: ${process.version}`);
  
  await buildManager.buildAll();
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\nBuild process interrupted by user');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Build script failed:', error);
    process.exit(1);
  });
}

module.exports = { BuildManager, Logger };