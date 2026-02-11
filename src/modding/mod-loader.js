const fs = require('fs/promises');
const path = require('path');
const { app } = require('electron');

const REQUIRED_MANIFEST_FIELDS = ['id', 'name', 'version', 'entry'];

class HookRegistry {
  constructor(logger) {
    this.logger = logger;
    this.listeners = new Map();
  }

  register(modId, hookName, handler) {
    if (typeof hookName !== 'string' || !hookName.trim()) {
      throw new Error('Hook name must be a non-empty string');
    }

    if (typeof handler !== 'function') {
      throw new Error('Hook handler must be a function');
    }

    if (!this.listeners.has(hookName)) {
      this.listeners.set(hookName, []);
    }

    this.listeners.get(hookName).push({ modId, handler });
    this.logger(modId, 'hook-register', `Hook "${hookName}" registered`);

    return () => this.unregister(modId, hookName, handler);
  }

  unregister(modId, hookName, handler) {
    const current = this.listeners.get(hookName);
    if (!current || current.length === 0) {
      return;
    }

    const filtered = current.filter(listener => listener.modId !== modId || listener.handler !== handler);

    if (filtered.length === 0) {
      this.listeners.delete(hookName);
    } else {
      this.listeners.set(hookName, filtered);
    }

    this.logger(modId, 'hook-unregister', `Hook "${hookName}" unregistered`);
  }

  clearByMod(modId) {
    for (const [hookName, entries] of this.listeners.entries()) {
      const filtered = entries.filter(entry => entry.modId !== modId);
      if (filtered.length === 0) {
        this.listeners.delete(hookName);
      } else {
        this.listeners.set(hookName, filtered);
      }
    }

    this.logger(modId, 'hook-clear', 'All hooks removed');
  }

  async emit(hookName, payload = {}) {
    const listeners = this.listeners.get(hookName) || [];
    const results = [];

    for (const listener of listeners) {
      try {
        const value = await listener.handler(payload);
        results.push({ modId: listener.modId, ok: true, value });
      } catch (error) {
        this.logger(listener.modId, 'hook-error', `Hook "${hookName}" failed`, error);
        results.push({ modId: listener.modId, ok: false, error: error.message });
      }
    }

    return results;
  }

  getRegisteredHooks() {
    const summary = {};

    for (const [hookName, entries] of this.listeners.entries()) {
      summary[hookName] = entries.map(entry => entry.modId);
    }

    return summary;
  }
}

class ModLoader {
  constructor() {
    this.modsDirectory = path.join(app.getPath('userData'), 'mods');
    this.modRegistry = new Map();
    this.hookRegistry = new HookRegistry(this.logForMod.bind(this));
  }

  async initialize() {
    await fs.mkdir(this.modsDirectory, { recursive: true });
    const modFolders = await this.getModFolders();

    for (const folderPath of modFolders) {
      await this.loadModFromDirectory(folderPath);
    }

    return this.getStateSnapshot();
  }

  async getModFolders() {
    const entries = await fs.readdir(this.modsDirectory, { withFileTypes: true });
    return entries.filter(entry => entry.isDirectory()).map(entry => path.join(this.modsDirectory, entry.name));
  }

  async loadModFromDirectory(modDirectory) {
    const manifestPath = path.join(modDirectory, 'mod.json');

    let manifest;
    try {
      const rawManifest = await fs.readFile(manifestPath, 'utf8');
      manifest = JSON.parse(rawManifest);
      this.validateManifest(manifest, manifestPath);
    } catch (error) {
      this.logForMod('unknown', 'manifest-error', `Skipping invalid manifest at ${manifestPath}`, error);
      return;
    }

    const modId = manifest.id;

    if (this.modRegistry.has(modId)) {
      this.logForMod(modId, 'manifest-error', 'Duplicate mod id detected, skipping mod');
      return;
    }

    const modState = {
      manifest,
      directory: modDirectory,
      status: 'disabled',
      module: null,
      errors: []
    };

    this.modRegistry.set(modId, modState);

    try {
      const entryPath = path.resolve(modDirectory, manifest.entry);

      if (!entryPath.startsWith(modDirectory)) {
        throw new Error('Entry path must stay inside the mod directory');
      }

      modState.module = require(entryPath);

      await this.runLifecycle(modId, 'onLoad');
      await this.enableMod(modId);
    } catch (error) {
      modState.status = 'error';
      modState.errors.push(error.message);
      this.logForMod(modId, 'load-error', 'Failed to load mod entry', error);
    }
  }

  validateManifest(manifest, manifestPath) {
    if (!manifest || typeof manifest !== 'object') {
      throw new Error(`Manifest in ${manifestPath} is not a JSON object`);
    }

    for (const field of REQUIRED_MANIFEST_FIELDS) {
      if (!manifest[field] || typeof manifest[field] !== 'string') {
        throw new Error(`Manifest in ${manifestPath} is missing required string field "${field}"`);
      }
    }
  }

  async enableMod(modId) {
    const modState = this.modRegistry.get(modId);
    if (!modState || modState.status === 'enabled') {
      return;
    }

    try {
      await this.runLifecycle(modId, 'onEnable');
      modState.status = 'enabled';
      this.logForMod(modId, 'enable', 'Mod enabled');
    } catch (error) {
      modState.status = 'error';
      modState.errors.push(error.message);
      this.logForMod(modId, 'enable-error', 'Failed to enable mod', error);
    }
  }

  async disableMod(modId) {
    const modState = this.modRegistry.get(modId);
    if (!modState || modState.status !== 'enabled') {
      return;
    }

    try {
      await this.runLifecycle(modId, 'onDisable');
      modState.status = 'disabled';
      this.hookRegistry.clearByMod(modId);
      this.logForMod(modId, 'disable', 'Mod disabled');
    } catch (error) {
      modState.status = 'error';
      modState.errors.push(error.message);
      this.logForMod(modId, 'disable-error', 'Failed to disable mod', error);
    }
  }

  async unloadAllMods() {
    for (const modId of this.modRegistry.keys()) {
      const modState = this.modRegistry.get(modId);

      if (!modState) {
        continue;
      }

      if (modState.status === 'enabled') {
        await this.disableMod(modId);
      }

      try {
        await this.runLifecycle(modId, 'onUnload');
      } catch (error) {
        modState.status = 'error';
        modState.errors.push(error.message);
        this.logForMod(modId, 'unload-error', 'Failed to unload mod', error);
      }
    }
  }

  async runLifecycle(modId, phase) {
    const modState = this.modRegistry.get(modId);
    if (!modState || !modState.module) {
      return;
    }

    const handler = modState.module[phase];
    if (typeof handler !== 'function') {
      return;
    }

    this.logForMod(modId, phase, `Running lifecycle phase ${phase}`);

    const context = {
      manifest: modState.manifest,
      hooks: {
        on: (hookName, hookHandler) => this.hookRegistry.register(modId, hookName, hookHandler),
        emit: (hookName, payload) => this.hookRegistry.emit(hookName, payload)
      },
      logger: {
        info: (message, details) => this.logForMod(modId, phase, message, details),
        error: (message, details) => this.logForMod(modId, `${phase}-error`, message, details)
      }
    };

    await handler(context);
  }

  getStateSnapshot() {
    const mods = [];

    for (const [modId, state] of this.modRegistry.entries()) {
      mods.push({
        id: modId,
        name: state.manifest.name,
        version: state.manifest.version,
        status: state.status,
        errors: [...state.errors]
      });
    }

    return {
      modsDirectory: this.modsDirectory,
      mods,
      hooks: this.hookRegistry.getRegisteredHooks()
    };
  }

  async emitHook(hookName, payload = {}) {
    return this.hookRegistry.emit(hookName, payload);
  }

  logForMod(modId, phase, message, error) {
    const logEntry = {
      modId,
      timestamp: new Date().toISOString(),
      phase,
      message
    };

    if (error) {
      logEntry.error = {
        message: error.message || String(error),
        stack: error.stack || null
      };
    }

    console.log('[ModLoader]', JSON.stringify(logEntry));
  }
}

module.exports = ModLoader;
