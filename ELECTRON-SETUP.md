# Electron Setup Documentation

## Project Structure

```
skid-inc/
├── src/                          # Electron source files
│   ├── main.js                   # Main Electron process
│   ├── preload.js               # Preload script for secure IPC
│   └── renderer/                # Renderer process files
│       └── save-manager.js      # Save system integration
├── app/                         # Original game files
├── index.html                   # Main game HTML file
├── package.json                 # Updated with Electron config
└── favicon.png                  # App icon
```

## Available Scripts

- `npm run electron` - Start Electron app in production mode
- `npm run electron-dev` - Start Electron app in development mode (with DevTools)
- `npm run build` - Build distributable packages for all platforms
- `npm run build:win` - Build for Windows only
- `npm run build:mac` - Build for macOS only  
- `npm run build:linux` - Build for Linux only

## Development Mode

Run `npm run electron-dev` to start the app with developer tools enabled.

## Configuration

The Electron app is configured with:
- Minimum window size: 1024x768 pixels
- Default window size: 1200x800 pixels
- Context isolation enabled for security
- Node integration disabled in renderer
- Preload script for secure IPC communication

## Build Configuration

The app can be built for Windows (NSIS installer), macOS (DMG), and Linux (AppImage) using electron-builder.