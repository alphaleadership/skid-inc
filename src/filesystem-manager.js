const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');
const SaveMetadataManager = require('./save-metadata-manager');

/**
 * FileSystemManager - Handles all file system operations for game saves
 * Manages save directory, file operations, and disk space validation
 */
class FileSystemManager {
  constructor(appDataPath = null, performanceManager = null) {
    // Use provided path or default to Electron's userData directory
    this.appDataPath = appDataPath || app.getPath('userData');
    this.saveDirectory = path.join(this.appDataPath, 'saves');
    this.metadataFile = path.join(this.saveDirectory, 'metadata.json');
    this.maxDiskUsage = 100 * 1024 * 1024; // 100MB limit as per requirements
    this.performanceManager = performanceManager; // Optional performance manager for compression
    
    // Initialize save directory on construction
    this.ensureSaveDirectory().then(() => {
      // Initialize metadata manager after directory is ready
      this.metadataManager = new SaveMetadataManager(this.saveDirectory);
    });
  }

  /**
   * Ensures the save directory exists and has proper permissions
   * Creates the directory structure if it doesn't exist
   */
  async ensureSaveDirectory() {
    try {
      await fs.access(this.saveDirectory);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(this.saveDirectory, { recursive: true });
        console.log(`Created save directory: ${this.saveDirectory}`);
      } else {
        throw new Error(`Cannot access save directory: ${error.message}`);
      }
    }

    // Verify write permissions
    await this.validatePermissions();
  }

  /**
   * Validates that we have read/write permissions to the save directory
   * @throws {Error} If permissions are insufficient
   */
  async validatePermissions() {
    try {
      const testFile = path.join(this.saveDirectory, '.permission_test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
    } catch (error) {
      throw new Error(`Insufficient permissions for save directory: ${error.message}`);
    }
  }

  /**
   * Validates available disk space before writing
   * @param {number} requiredBytes - Bytes needed for the operation
   * @throws {Error} If insufficient disk space
   */
  async validateDiskSpace(requiredBytes = 0) {
    try {
      const stats = await fs.stat(this.saveDirectory);
      const currentUsage = await this.calculateDirectorySize(this.saveDirectory);
      
      if (currentUsage + requiredBytes > this.maxDiskUsage) {
        throw new Error(`Insufficient disk space. Current usage: ${Math.round(currentUsage / 1024 / 1024)}MB, Required: ${Math.round(requiredBytes / 1024 / 1024)}MB, Limit: ${Math.round(this.maxDiskUsage / 1024 / 1024)}MB`);
      }
    } catch (error) {
      if (error.message.includes('Insufficient disk space')) {
        throw error;
      }
      // If we can't check disk space, log warning but don't fail
      console.warn(`Could not validate disk space: ${error.message}`);
    }
  }

  /**
   * Calculates the total size of a directory
   * @param {string} dirPath - Directory path to calculate
   * @returns {Promise<number>} Total size in bytes
   */
  async calculateDirectorySize(dirPath) {
    let totalSize = 0;
    
    try {
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isDirectory()) {
          totalSize += await this.calculateDirectorySize(filePath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      console.warn(`Error calculating directory size for ${dirPath}: ${error.message}`);
    }
    
    return totalSize;
  }

  /**
   * Writes game data to a file with validation, compression, and error handling
   * @param {string} filename - Name of the file to write
   * @param {Object} data - Game data to save
   * @returns {Promise<Object>} Save result with success status and metadata
   */
  async writeGameData(filename, data) {
    try {
      // Ensure filename is safe
      const safeFilename = this.sanitizeFilename(filename);
      const filePath = path.join(this.saveDirectory, safeFilename);
      
      // Serialize data
      const jsonData = JSON.stringify(data, null, 2);
      let finalData = jsonData;
      let compressionResult = null;
      let isCompressed = false;
      
      // Apply compression if performance manager is available
      if (this.performanceManager) {
        compressionResult = await this.performanceManager.compressData(jsonData);
        if (compressionResult.compressed) {
          finalData = compressionResult.data;
          isCompressed = true;
          
          // Add compression metadata to the data object
          data._compressionMetadata = {
            compressed: true,
            originalSize: compressionResult.originalSize,
            compressedSize: compressionResult.compressedSize,
            compressionRatio: compressionResult.compressionRatio,
            compressionTime: compressionResult.compressionTime,
            timestamp: Date.now()
          };
        }
      }
      
      const dataBuffer = Buffer.isBuffer(finalData) ? finalData : Buffer.from(finalData, 'utf8');
      
      // Validate disk space before writing
      await this.validateDiskSpace(dataBuffer.length);
      
      // Write file atomically (write to temp file first, then rename)
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, dataBuffer);
      await fs.rename(tempPath, filePath);
      
      // Get file stats for metadata
      const stats = await fs.stat(filePath);
      
      const result = {
        success: true,
        filename: safeFilename,
        path: filePath,
        size: stats.size,
        timestamp: Date.now(),
        checksum: this.calculateChecksum(dataBuffer),
        compressed: isCompressed,
        compressionResult: compressionResult
      };

      // Register the save file with metadata manager if available
      if (this.metadataManager) {
        const saveInfo = {
          size: stats.size,
          gameVersion: data.version || 'unknown',
          playerLevel: data.player?.level || 0,
          compressed: isCompressed,
          originalSize: compressionResult?.originalSize || stats.size
        };
        await this.metadataManager.registerSaveFile(safeFilename, saveInfo);
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to write game data to ${filename}: ${error.message}`);
    }
  }

  /**
   * Reads game data from a file with validation and decompression support
   * @param {string} filename - Name of the file to read
   * @returns {Promise<Object>} Parsed game data
   */
  async readGameData(filename) {
    try {
      const safeFilename = this.sanitizeFilename(filename);
      const filePath = path.join(this.saveDirectory, safeFilename);
      
      // Check if file exists
      await fs.access(filePath);
      
      // Validate file integrity if metadata manager is available
      if (this.metadataManager) {
        const validation = await this.metadataManager.validateSaveFileIntegrity(safeFilename);
        if (!validation.valid) {
          console.warn(`File integrity check failed for ${safeFilename}: ${validation.reason}`);
        }
      }
      
      // Read file content
      const fileBuffer = await fs.readFile(filePath);
      let fileContent;
      let isCompressed = false;
      let decompressionResult = null;
      
      // Try to detect if file is compressed (gzip magic number: 1f 8b)
      if (fileBuffer.length >= 2 && fileBuffer[0] === 0x1f && fileBuffer[1] === 0x8b) {
        // File appears to be gzip compressed
        if (this.performanceManager) {
          decompressionResult = await this.performanceManager.decompressData(fileBuffer);
          if (decompressionResult.success) {
            fileContent = decompressionResult.data;
            isCompressed = true;
          } else {
            throw new Error(`Decompression failed: ${decompressionResult.error}`);
          }
        } else {
          throw new Error('File appears to be compressed but no performance manager available for decompression');
        }
      } else {
        // File is not compressed, read as text
        fileContent = fileBuffer.toString('utf8');
      }
      
      // Parse JSON data
      const data = JSON.parse(fileContent);
      
      // Validate checksum if available (use original buffer for compressed files)
      const checksumBuffer = isCompressed ? fileBuffer : Buffer.from(fileContent, 'utf8');
      const currentChecksum = this.calculateChecksum(checksumBuffer);
      
      // Record load operation in metadata
      if (this.metadataManager) {
        await this.metadataManager.recordLoadOperation(safeFilename);
      }
      
      return {
        success: true,
        data: data,
        filename: safeFilename,
        checksum: currentChecksum,
        compressed: isCompressed,
        decompressionResult: decompressionResult,
        timestamp: Date.now()
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Save file not found: ${filename}`);
      } else if (error instanceof SyntaxError) {
        throw new Error(`Corrupted save file: ${filename}`);
      } else {
        throw new Error(`Failed to read game data from ${filename}: ${error.message}`);
      }
    }
  }

  /**
   * Lists all save files in the save directory
   * @returns {Promise<Array>} Array of save file information
   */
  async listSaveFiles() {
    try {
      const files = await fs.readdir(this.saveDirectory);
      const saveFiles = [];
      
      for (const file of files) {
        // Skip metadata and temporary files
        if (file === 'metadata.json' || file.endsWith('.tmp') || file.startsWith('.')) {
          continue;
        }
        
        const filePath = path.join(this.saveDirectory, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          saveFiles.push({
            filename: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            isBackup: file.includes('backup_')
          });
        }
      }
      
      // Sort by modification time (newest first)
      return saveFiles.sort((a, b) => b.modified - a.modified);
    } catch (error) {
      throw new Error(`Failed to list save files: ${error.message}`);
    }
  }

  /**
   * Deletes a save file
   * @param {string} filename - Name of the file to delete
   * @returns {Promise<Object>} Deletion result
   */
  async deleteSaveFile(filename) {
    try {
      const safeFilename = this.sanitizeFilename(filename);
      const filePath = path.join(this.saveDirectory, safeFilename);
      
      // Check if file exists before deletion
      await fs.access(filePath);
      
      // Get file stats before deletion for logging
      const stats = await fs.stat(filePath);
      
      // Delete the file
      await fs.unlink(filePath);
      
      // Unregister from metadata manager if available
      if (this.metadataManager) {
        await this.metadataManager.unregisterSaveFile(safeFilename);
      }
      
      return {
        success: true,
        filename: safeFilename,
        deletedSize: stats.size,
        timestamp: Date.now()
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Save file not found: ${filename}`);
      } else {
        throw new Error(`Failed to delete save file ${filename}: ${error.message}`);
      }
    }
  }

  /**
   * Gets detailed statistics for a specific file
   * @param {string} filename - Name of the file
   * @returns {Promise<Object>} File statistics
   */
  async getFileStats(filename) {
    try {
      const safeFilename = this.sanitizeFilename(filename);
      const filePath = path.join(this.saveDirectory, safeFilename);
      
      const stats = await fs.stat(filePath);
      
      return {
        filename: safeFilename,
        path: filePath,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filename}`);
      } else {
        throw new Error(`Failed to get file stats for ${filename}: ${error.message}`);
      }
    }
  }

  /**
   * Sanitizes filename to prevent directory traversal and invalid characters
   * @param {string} filename - Original filename
   * @returns {string} Sanitized filename
   */
  sanitizeFilename(filename) {
    // Remove path separators and invalid characters
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\.\./g, '_')
      .replace(/^\./, '_')
      .substring(0, 255); // Limit filename length
  }

  /**
   * Calculates SHA-256 checksum for data integrity validation
   * @param {Buffer} data - Data to calculate checksum for
   * @returns {string} Hexadecimal checksum
   */
  calculateChecksum(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Gets the current save directory path
   * @returns {string} Save directory path
   */
  getSaveDirectory() {
    return this.saveDirectory;
  }

  /**
   * Gets current disk usage statistics
   * @returns {Promise<Object>} Disk usage information
   */
  async getDiskUsage() {
    try {
      const currentUsage = await this.calculateDirectorySize(this.saveDirectory);
      const files = await this.listSaveFiles();
      
      return {
        currentUsage: currentUsage,
        maxUsage: this.maxDiskUsage,
        usagePercentage: (currentUsage / this.maxDiskUsage) * 100,
        availableSpace: this.maxDiskUsage - currentUsage,
        fileCount: files.length,
        directory: this.saveDirectory
      };
    } catch (error) {
      throw new Error(`Failed to get disk usage: ${error.message}`);
    }
  }

  /**
   * Gets the metadata manager instance
   * @returns {SaveMetadataManager|null} Metadata manager instance
   */
  getMetadataManager() {
    return this.metadataManager || null;
  }

  /**
   * Gets comprehensive save system statistics
   * @returns {Promise<Object>} Combined file system and metadata statistics
   */
  async getSystemStatistics() {
    try {
      const diskUsage = await this.getDiskUsage();
      const metadataStats = this.metadataManager ? this.metadataManager.getStatistics() : {};
      
      return {
        ...diskUsage,
        ...metadataStats,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to get system statistics: ${error.message}`);
    }
  }

  /**
   * Validates integrity of all save files
   * @returns {Promise<Object>} Validation results
   */
  async validateAllFiles() {
    if (!this.metadataManager) {
      throw new Error('Metadata manager not initialized');
    }
    
    try {
      return await this.metadataManager.validateAllSaveFiles();
    } catch (error) {
      throw new Error(`Failed to validate files: ${error.message}`);
    }
  }

  /**
   * Cleans up orphaned metadata entries
   * @returns {Promise<number>} Number of cleaned entries
   */
  async cleanupMetadata() {
    if (!this.metadataManager) {
      return 0;
    }
    
    try {
      return await this.metadataManager.cleanupOrphanedMetadata();
    } catch (error) {
      console.error('Failed to cleanup metadata:', error.message);
      return 0;
    }
  }
}

module.exports = FileSystemManager;