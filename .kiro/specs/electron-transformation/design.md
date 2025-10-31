# Design Document - Transformation Electron avec Sauvegarde Automatique

## Overview

Cette conception détaille la transformation de SkidInc d'une application web en application Electron native avec un système de sauvegarde automatique robuste. L'approche préserve l'architecture existante du jeu tout en ajoutant les capacités desktop et un système de persistance amélioré.

## Architecture

### Architecture Globale

```
┌─────────────────────────────────────────┐
│           Electron Application          │
├─────────────────────────────────────────┤
│  Main Process (Node.js)                 │
│  ├── Window Management                  │
│  ├── Auto-Save System                  │
│  ├── File System Operations            │
│  └── IPC Communication                 │
├─────────────────────────────────────────┤
│  Renderer Process (Chromium)           │
│  ├── Existing SkidInc Game Logic       │
│  ├── Save State Manager                │
│  ├── UI Notifications                  │
│  └── IPC Client                        │
└─────────────────────────────────────────┘
```

### Processus Principal (Main Process)

Le processus principal Electron gère :
- Création et gestion de la fenêtre de l'application
- Système de sauvegarde automatique avec accès au système de fichiers
- Communication IPC avec le processus de rendu
- Gestion des menus et raccourcis clavier
- Migration des données depuis localStorage

### Processus de Rendu (Renderer Process)

Le processus de rendu contient :
- L'application SkidInc existante (HTML/CSS/JS)
- Interface de communication avec le système de sauvegarde
- Notifications utilisateur pour l'état des sauvegardes
- Gestionnaire d'état pour synchroniser avec le Main Process

## Components and Interfaces

### 1. Main Process Components

#### ElectronApp (main.js)
```javascript
class ElectronApp {
  constructor()
  createWindow()
  setupMenu()
  handleAppEvents()
}
```

#### AutoSaveManager
```javascript
class AutoSaveManager {
  constructor(saveDirectory)
  startAutoSave(interval = 30000)
  stopAutoSave()
  saveGameState(gameState)
  loadGameState()
  createBackup(gameState)
  cleanOldBackups()
  validateSaveData(data)
}
```

#### FileSystemManager
```javascript
class FileSystemManager {
  constructor(appDataPath)
  ensureSaveDirectory()
  writeGameData(filename, data)
  readGameData(filename)
  listSaveFiles()
  deleteSaveFile(filename)
  getFileStats(filename)
}
```

#### MigrationManager
```javascript
class MigrationManager {
  detectLocalStorageData()
  importFromLocalStorage()
  convertDataFormat(localStorageData)
  validateImportedData(data)
}
```

### 2. Renderer Process Components

#### SaveStateManager (renderer-save.js)
```javascript
class SaveStateManager {
  constructor()
  initializeIPC()
  getCurrentGameState()
  handleSaveRequest()
  handleLoadRequest()
  notifyStateChange()
}
```

#### NotificationManager (renderer-notifications.js)
```javascript
class NotificationManager {
  constructor()
  showSaveSuccess()
  showSaveError(error)
  showLastSaveTime(timestamp)
  showMigrationPrompt()
}
```

### 3. IPC Communication Interface

```javascript
// Main -> Renderer
ipcMain.handle('save-game-state', async (event, gameState) => {})
ipcMain.handle('load-game-state', async (event) => {})
ipcMain.handle('get-save-list', async (event) => {})
ipcMain.handle('delete-save', async (event, filename) => {})

// Renderer -> Main
ipcRenderer.invoke('save-game-state', gameState)
ipcRenderer.invoke('load-game-state')
ipcRenderer.on('save-status', (event, status) => {})
ipcRenderer.on('migration-prompt', (event, data) => {})
```

## Data Models

### GameState Model
```javascript
const GameStateSchema = {
  version: "string",           // Version du jeu
  timestamp: "number",         // Timestamp de la sauvegarde
  player: {
    username: "string",
    money: "number",
    totalMoney: "number",
    exp: "number",
    totalExp: "number",
    expReq: "number",
    level: "number",
    botnet: "number",
    prestigeCount: "number"
  },
  script: {
    unlocked: "array",
    completed: "array",
    totalCompleted: "number",
    available: "array",
    current: "object",
    time: "number",
    maxTime: "number"
  },
  server: {
    owned: "array"
  },
  battery: {
    level: "number",
    time: "number"
  },
  achievements: {
    owned: "array"
  },
  autoscript: {
    unlocked: "array"
  },
  options: {
    typed: "boolean"
  },
  tutorial: {
    finish: "boolean"
  },
  console: {
    grammarly: "boolean"
  }
}
```

### SaveFile Model
```javascript
const SaveFileSchema = {
  filename: "string",          // Nom du fichier
  timestamp: "number",         // Date de création
  gameState: "GameState",      // État du jeu
  checksum: "string",          // Checksum pour validation
  isBackup: "boolean",         // Indique si c'est une sauvegarde de backup
  size: "number"               // Taille du fichier
}
```

### SaveMetadata Model
```javascript
const SaveMetadataSchema = {
  lastSave: "number",          // Timestamp de la dernière sauvegarde
  autoSaveEnabled: "boolean",  // Sauvegarde automatique activée
  autoSaveInterval: "number",  // Intervalle en millisecondes
  backupCount: "number",       // Nombre de backups à conserver
  totalSaves: "number",        // Nombre total de sauvegardes
  migrationCompleted: "boolean" // Migration depuis localStorage terminée
}
```

## Error Handling

### Stratégies de Gestion d'Erreurs

#### 1. Erreurs de Sauvegarde
```javascript
class SaveErrorHandler {
  handleSaveError(error, retryCount = 0) {
    if (retryCount < 3) {
      // Retry avec délai exponentiel
      setTimeout(() => this.retrySave(retryCount + 1), Math.pow(2, retryCount) * 1000)
    } else {
      // Notifier l'utilisateur et passer en mode dégradé
      this.notifyUser('Échec de sauvegarde après 3 tentatives')
      this.enableFallbackMode()
    }
  }
}
```

#### 2. Erreurs de Corruption de Données
```javascript
class DataIntegrityManager {
  validateGameState(gameState) {
    // Validation du schéma
    // Vérification des types
    // Validation des valeurs critiques
  }
  
  repairCorruptedData(gameState) {
    // Tentative de réparation automatique
    // Utilisation des valeurs par défaut pour les champs manquants
    // Validation post-réparation
  }
}
```

#### 3. Erreurs de Migration
```javascript
class MigrationErrorHandler {
  handleMigrationError(error, localStorageData) {
    // Log détaillé de l'erreur
    // Sauvegarde des données originales
    // Proposition de migration manuelle
    // Mode de récupération
  }
}
```

## Testing Strategy

### 1. Tests Unitaires

#### Main Process Tests
- **AutoSaveManager**: Test des cycles de sauvegarde, gestion des erreurs, nettoyage des backups
- **FileSystemManager**: Test des opérations de fichiers, permissions, gestion d'espace disque
- **MigrationManager**: Test de conversion de données, validation, gestion des cas d'erreur

#### Renderer Process Tests
- **SaveStateManager**: Test de synchronisation d'état, communication IPC
- **NotificationManager**: Test d'affichage des notifications, gestion des états

### 2. Tests d'Intégration

#### IPC Communication Tests
```javascript
describe('IPC Communication', () => {
  test('should save game state successfully', async () => {
    const gameState = createMockGameState()
    const result = await ipcRenderer.invoke('save-game-state', gameState)
    expect(result.success).toBe(true)
  })
  
  test('should handle save errors gracefully', async () => {
    // Test avec système de fichiers en lecture seule
    // Vérification de la gestion d'erreur
  })
})
```

#### End-to-End Tests
```javascript
describe('Auto-Save System E2E', () => {
  test('should auto-save every 30 seconds', async () => {
    // Démarrer l'application
    // Modifier l'état du jeu
    // Attendre 30 secondes
    // Vérifier que la sauvegarde a eu lieu
  })
  
  test('should migrate localStorage data on first run', async () => {
    // Simuler des données localStorage existantes
    // Démarrer l'application
    // Vérifier la migration
  })
})
```

### 3. Tests de Performance

#### Memory Usage Tests
```javascript
describe('Memory Performance', () => {
  test('should maintain memory usage under 200MB', async () => {
    // Monitoring de l'usage mémoire pendant 1 heure
    // Vérification des fuites mémoire
  })
})
```

#### File System Performance Tests
```javascript
describe('File System Performance', () => {
  test('should save large game states within 1 second', async () => {
    const largeGameState = createLargeGameState()
    const startTime = Date.now()
    await saveManager.saveGameState(largeGameState)
    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(1000)
  })
})
```

### 4. Tests de Robustesse

#### Failure Recovery Tests
```javascript
describe('Failure Recovery', () => {
  test('should recover from corrupted save files', async () => {
    // Corrompre un fichier de sauvegarde
    // Tenter de charger
    // Vérifier la récupération depuis backup
  })
  
  test('should handle disk full scenarios', async () => {
    // Simuler un disque plein
    // Tenter de sauvegarder
    // Vérifier la gestion gracieuse
  })
})
```

## Implementation Phases

### Phase 1: Configuration Electron de Base
- Configuration du projet Electron
- Création de la fenêtre principale
- Intégration de l'application SkidInc existante

### Phase 2: Système de Sauvegarde Core
- Implémentation du FileSystemManager
- Création du système de sauvegarde de base
- Tests de persistance des données

### Phase 3: Sauvegarde Automatique
- Implémentation de l'AutoSaveManager
- Système de backup avec rotation
- Gestion des erreurs et retry logic

### Phase 4: Migration et Interface Utilisateur
- Système de migration depuis localStorage
- Interface utilisateur pour la gestion des sauvegardes
- Notifications et feedback utilisateur

### Phase 5: Optimisation et Tests
- Tests de performance et robustesse
- Optimisation de l'usage mémoire
- Finalisation de la gestion d'erreurs