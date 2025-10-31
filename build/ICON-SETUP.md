# Icon Setup for Skid-Inc

The electron-builder configuration is set up to work with or without custom icons. Currently, it uses the default Electron icon.

## Adding Custom Icons

To add custom application icons, follow these steps:

### 1. Create Icon Files

Create an `icons` directory in the project root and add the following files:

```
icons/
├── icon.png          # 512x512 or 1024x1024 PNG (recommended)
├── icon.ico          # Windows ICO file (optional)
├── icon.icns         # macOS ICNS file (optional)
└── icon-256x256.png  # 256x256 PNG (minimum requirement)
```

### 2. Update package.json

Add icon configuration to the build section:

```json
{
  "build": {
    "win": {
      "icon": "icons/icon.ico"  // or "icons/icon.png"
    },
    "mac": {
      "icon": "icons/icon.icns"  // or "icons/icon.png"
    },
    "linux": {
      "icon": "icons/icon.png"
    },
    "dmg": {
      "icon": "icons/icon.icns"
    }
  }
}
```

### 3. Icon Requirements

- **Windows**: ICO file with multiple sizes (16, 32, 48, 256) or PNG ≥256x256
- **macOS**: ICNS file with multiple sizes or PNG ≥512x512
- **Linux**: PNG file ≥256x256

### 4. Icon Generation Tools

You can use these tools to generate proper icons:

- **Online**: [favicon.io](https://favicon.io/), [realfavicongenerator.net](https://realfavicongenerator.net/)
- **CLI**: `electron-icon-builder`, `icon-gen`
- **Manual**: Use image editing software like GIMP, Photoshop, or Sketch

### 5. Current Status

The current configuration works without custom icons and will use Electron's default icon. This is perfectly fine for development and testing.

For production releases, it's recommended to add proper application icons following the steps above.

### 6. Testing Icons

After adding icons, test the build:

```bash
npm run build:dir  # Test packaging
npm run build:win  # Build Windows installer
```

The build process will validate icon files and show warnings if they don't meet requirements.