#!/usr/bin/env node

/**
 * Deployment script for Skid-Inc
 * Handles packaging, signing, and distribution of built applications
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

// Configuration
const DEPLOY_CONFIG = {
  outputDir: 'dist',
  releaseDir: 'releases',
  checksumAlgorithm: 'sha256',
  compressionLevel: 9,
  platforms: {
    win: {
      installer: '*.exe',
      portable: '*portable*.exe',
      extensions: ['.exe']
    },
    mac: {
      installer: '*.dmg',
      archive: '*.zip',
      extensions: ['.dmg', '.zip']
    },
    linux: {
      appimage: '*.AppImage',
      deb: '*.deb',
      rpm: '*.rpm',
      extensions: ['.AppImage', '.deb', '.rpm']
    }
  }
};

class DeployManager {
  constructor() {
    this.packageInfo = this.loadPackageInfo();
    this.version = this.packageInfo.version;
    this.releaseTag = `v${this.version}`;
  }

  loadPackageInfo() {
    try {
      return JSON.parse(fs.readFileSync('package.json', 'utf8'));
    } catch (error) {
      throw new Error('Failed to load package.json');
    }
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  async createReleaseDirectory() {
    const releaseDir = path.join(DEPLOY_CONFIG.releaseDir, this.releaseTag);
    
    if (!fs.existsSync(DEPLOY_CONFIG.releaseDir)) {
      fs.mkdirSync(DEPLOY_CONFIG.releaseDir, { recursive: true });
    }
    
    if (!fs.existsSync(releaseDir)) {
      fs.mkdirSync(releaseDir, { recursive: true });
      this.log(`Created release directory: ${releaseDir}`);
    }
    
    return releaseDir;
  }

  calculateChecksum(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash(DEPLOY_CONFIG.checksumAlgorithm);
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  async copyArtifacts(releaseDir) {
    this.log('Copying build artifacts...');
    
    if (!fs.existsSync(DEPLOY_CONFIG.outputDir)) {
      throw new Error(`Build directory not found: ${DEPLOY_CONFIG.outputDir}`);
    }
    
    const artifacts = [];
    const files = fs.readdirSync(DEPLOY_CONFIG.outputDir);
    
    for (const file of files) {
      const filePath = path.join(DEPLOY_CONFIG.outputDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        // Check if it's a distributable file
        const isDistributable = Object.values(DEPLOY_CONFIG.platforms)
          .some(platform => platform.extensions.some(ext => file.endsWith(ext)));
        
        if (isDistributable) {
          const destPath = path.join(releaseDir, file);
          fs.copyFileSync(filePath, destPath);
          
          // Calculate checksum
          const checksum = this.calculateChecksum(destPath);
          
          artifacts.push({
            name: file,
            path: destPath,
            size: stats.size,
            checksum: checksum,
            platform: this.detectPlatform(file)
          });
          
          this.log(`Copied: ${file} (${Math.round(stats.size / 1024 / 1024 * 100) / 100} MB)`);
        }
      }
    }
    
    return artifacts;
  }

  detectPlatform(filename) {
    const lower = filename.toLowerCase();
    
    if (lower.includes('setup') || lower.endsWith('.exe')) {
      return 'windows';
    } else if (lower.endsWith('.dmg') || lower.endsWith('.zip')) {
      return 'macos';
    } else if (lower.endsWith('.appimage') || lower.endsWith('.deb') || lower.endsWith('.rpm')) {
      return 'linux';
    }
    
    return 'unknown';
  }

  async generateChecksums(artifacts, releaseDir) {
    this.log('Generating checksum files...');
    
    const checksumFile = path.join(releaseDir, 'checksums.txt');
    const checksumContent = artifacts.map(artifact => 
      `${artifact.checksum}  ${artifact.name}`
    ).join('\n');
    
    fs.writeFileSync(checksumFile, checksumContent);
    this.log(`Checksums saved to: checksums.txt`);
    
    // Also create individual checksum files
    for (const artifact of artifacts) {
      const individualChecksumFile = path.join(releaseDir, `${artifact.name}.${DEPLOY_CONFIG.checksumAlgorithm}`);
      fs.writeFileSync(individualChecksumFile, `${artifact.checksum}  ${artifact.name}\n`);
    }
  }

  async generateReleaseNotes(releaseDir) {
    this.log('Generating release notes...');
    
    const releaseNotes = `# Skid-Inc ${this.releaseTag}

## Release Information

- **Version**: ${this.version}
- **Release Date**: ${new Date().toISOString().split('T')[0]}
- **Build Date**: ${new Date().toISOString()}

## Installation Instructions

### Windows
- **Installer**: Download \`Skid-Inc Setup ${this.version}.exe\` and run it
- **Portable**: Download \`Skid-Inc ${this.version}.exe\` and run directly (no installation required)

### macOS
- **DMG**: Download \`Skid-Inc-${this.version}.dmg\`, open it, and drag the app to Applications
- **ZIP**: Download \`Skid-Inc-${this.version}-mac.zip\` and extract

### Linux
- **AppImage**: Download \`Skid-Inc-${this.version}.AppImage\`, make it executable, and run
- **DEB**: Download \`skid-inc_${this.version}_amd64.deb\` and install with \`sudo dpkg -i\`
- **RPM**: Download \`skid-inc-${this.version}.x86_64.rpm\` and install with \`sudo rpm -i\`

## System Requirements

- **Windows**: Windows 10 or later (64-bit)
- **macOS**: macOS 10.15 or later (Intel and Apple Silicon)
- **Linux**: Ubuntu 18.04+ / equivalent (64-bit)

## Verification

All files include SHA256 checksums for verification:
\`\`\`bash
# Verify checksum (replace filename)
sha256sum -c filename.sha256
\`\`\`

## Support

For issues and support, please visit: https://github.com/TotomInc/skid-inc/issues

---
*This release was generated automatically by the Skid-Inc build system.*
`;

    const releaseNotesPath = path.join(releaseDir, 'RELEASE_NOTES.md');
    fs.writeFileSync(releaseNotesPath, releaseNotes);
    this.log(`Release notes saved to: RELEASE_NOTES.md`);
  }

  async generateManifest(artifacts, releaseDir) {
    this.log('Generating release manifest...');
    
    const manifest = {
      version: this.version,
      releaseTag: this.releaseTag,
      buildDate: new Date().toISOString(),
      artifacts: artifacts.map(artifact => ({
        name: artifact.name,
        platform: artifact.platform,
        size: artifact.size,
        checksum: {
          algorithm: DEPLOY_CONFIG.checksumAlgorithm,
          value: artifact.checksum
        }
      })),
      systemRequirements: {
        windows: "Windows 10 or later (64-bit)",
        macos: "macOS 10.15 or later",
        linux: "Ubuntu 18.04+ or equivalent (64-bit)"
      },
      downloadUrls: {
        github: `https://github.com/TotomInc/skid-inc/releases/tag/${this.releaseTag}`,
        latest: "https://github.com/TotomInc/skid-inc/releases/latest"
      }
    };
    
    const manifestPath = path.join(releaseDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    this.log(`Manifest saved to: manifest.json`);
    
    return manifest;
  }

  async createArchive(releaseDir) {
    this.log('Creating release archive...');
    
    try {
      const archiveName = `skid-inc-${this.version}-release.zip`;
      const archivePath = path.join(DEPLOY_CONFIG.releaseDir, archiveName);
      
      // Use built-in zip if available, otherwise skip
      try {
        if (process.platform === 'win32') {
          execSync(`powershell Compress-Archive -Path "${releaseDir}\\*" -DestinationPath "${archivePath}"`, { stdio: 'pipe' });
        } else {
          execSync(`cd "${releaseDir}" && zip -r "../${archiveName}" .`, { stdio: 'pipe' });
        }
        
        this.log(`Release archive created: ${archiveName}`);
        return archivePath;
      } catch (error) {
        this.log('Archive creation skipped (zip not available)', 'WARN');
        return null;
      }
    } catch (error) {
      this.log(`Failed to create archive: ${error.message}`, 'WARN');
      return null;
    }
  }

  async deploy() {
    try {
      this.log(`Starting deployment for version ${this.version}...`);
      
      // Create release directory
      const releaseDir = await this.createReleaseDirectory();
      
      // Copy artifacts
      const artifacts = await this.copyArtifacts(releaseDir);
      
      if (artifacts.length === 0) {
        throw new Error('No distributable artifacts found');
      }
      
      // Generate checksums
      await this.generateChecksums(artifacts, releaseDir);
      
      // Generate release notes
      await this.generateReleaseNotes(releaseDir);
      
      // Generate manifest
      const manifest = await this.generateManifest(artifacts, releaseDir);
      
      // Create archive
      const archivePath = await this.createArchive(releaseDir);
      
      // Print summary
      this.printDeploymentSummary(releaseDir, artifacts, archivePath);
      
      this.log('Deployment completed successfully!', 'SUCCESS');
      
    } catch (error) {
      this.log(`Deployment failed: ${error.message}`, 'ERROR');
      process.exit(1);
    }
  }

  printDeploymentSummary(releaseDir, artifacts, archivePath) {
    this.log('='.repeat(60));
    this.log('DEPLOYMENT SUMMARY');
    this.log('='.repeat(60));
    this.log(`Version: ${this.version}`);
    this.log(`Release directory: ${releaseDir}`);
    this.log(`Artifacts: ${artifacts.length}`);
    
    const platformCounts = artifacts.reduce((acc, artifact) => {
      acc[artifact.platform] = (acc[artifact.platform] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(platformCounts).forEach(([platform, count]) => {
      this.log(`  - ${platform}: ${count} files`);
    });
    
    const totalSize = artifacts.reduce((sum, artifact) => sum + artifact.size, 0);
    this.log(`Total size: ${Math.round(totalSize / 1024 / 1024 * 100) / 100} MB`);
    
    if (archivePath) {
      this.log(`Release archive: ${path.basename(archivePath)}`);
    }
    
    this.log('='.repeat(60));
    this.log('Files ready for distribution:');
    artifacts.forEach(artifact => {
      this.log(`  - ${artifact.name} (${artifact.platform})`);
    });
    this.log('='.repeat(60));
  }
}

// Main execution
async function main() {
  const deployManager = new DeployManager();
  await deployManager.deploy();
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
}

module.exports = { DeployManager };