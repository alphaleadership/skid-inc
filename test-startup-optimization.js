/**
 * Test script to verify startup optimization features
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

// Import the classes we want to test
const StartupOptimizer = require('./src/startup-optimizer');
const FileSystemManager = require('./src/filesystem-manager');
const AutoSaveManager = require('./src/auto-save-manager');

async function testStartupOptimization() {
  console.log('Testing startup optimization features...');
  
  try {
    // Initialize managers
    const fileSystemManager = new FileSystemManager();
    await fileSystemManager.ensureSaveDirectory();
    
    const autoSaveManager = new AutoSaveManager();
    const startupOptimizer = new StartupOptimizer(fileSystemManager, autoSaveManager);
    
    // Test 1: Startup optimization
    console.log('\n1. Testing optimized startup...');
    const startupResult = await startupOptimizer.startOptimizedStartup();
    
    console.log(`Startup completed in ${startupResult.totalTime}ms`);
    console.log(`Target time: ${startupResult.targetTime}ms`);
    console.log(`Within target: ${startupResult.withinTarget}`);
    console.log(`Cache hit rate: ${startupResult.cacheStats.hitRate.toFixed(1)}%`);
    console.log(`Files preloaded: ${startupResult.preloadStats.filesPreloaded}`);
    
    // Test 2: Metadata caching
    console.log('\n2. Testing metadata caching...');
    const stats = startupOptimizer.getStartupStatistics();
    console.log(`Cache enabled: ${stats.cache.enabled}`);
    console.log(`Cache size: ${stats.cache.size} entries`);
    console.log(`Preloading enabled: ${stats.preloading.enabled}`);
    
    // Test 3: Performance score
    console.log('\n3. Performance metrics...');
    console.log(`Startup score: ${stats.performance.startupScore}/100`);
    console.log(`Average startup time: ${stats.performance.averageStartupTime}ms`);
    
    // Test 4: Cache operations
    console.log('\n4. Testing cache operations...');
    await startupOptimizer.performMaintenance();
    console.log('Cache maintenance completed');
    
    // Test 5: Configuration update
    console.log('\n5. Testing configuration update...');
    startupOptimizer.updateConfiguration({
      targetStartupTime: 2000,
      enableAsyncLoading: true,
      enableMetadataCache: true,
      enablePreloading: true
    });
    console.log('Configuration updated successfully');
    
    console.log('\n✅ All startup optimization tests passed!');
    
    // Cleanup
    startupOptimizer.cleanup();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  app.whenReady().then(async () => {
    await testStartupOptimization();
    app.quit();
  });
}

module.exports = { testStartupOptimization };