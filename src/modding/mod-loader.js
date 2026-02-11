const fs = require('fs/promises');
const path = require('path');
const vm = require('vm');
const { app } = require('electron');

const CURRENT_MOD_API_VERSION = '1.0.0';
const REQUIRED_MANIFEST_FIELDS = ['id', 'name', 'version', 'entry', 'apiVersion', 'gameVersionRange', 'permissions'];
const ALLOWED_MANIFEST_FIELDS = new Set(REQUIRED_MANIFEST_FIELDS);
const ALLOWED_PERMISSIONS = new Set(['hooks:register', 'hooks:emit', 'logger']);

class ManifestValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ManifestValidationError';
    this.details = details;
  }
}

function normalizeVersion(version) {
  if (typeof version !== 'string') {
    return null;
  }

  const cleaned = version.trim().replace(/^v/i, '');
  if (!/^\d+(\.\d+){0,2}$/.test(cleaned)) {
    return null;
  }

  const parts = cleaned.split('.').map((part) => Number(part));
  while (parts.length < 3) {
    parts.push(0);
  }

  return parts;
}

function compareVersions(leftVersion, rightVersion) {
  const left = normalizeVersion(leftVersion);
  const right = normalizeVersion(rightVersion);

  if (!left || !right) {
    return null;
  }

  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) {
      return 1;
    }

    if (left[index] < right[index]) {
      return -1;
    }
  }

  return 0;
}

function satisfiesSimpleRange(version, rangeExpression) {
  if (typeof rangeExpression !== 'string' || !rangeExpression.trim()) {
    return false;
  }

  const rules = rangeExpression.split(' ').map((rule) => rule.trim()).filter(Boolean);
  if (rules.length === 0) {
    return false;
  }

  return rules.every((rule) => {
    let operator = '==';
    let value = rule;

    if (rule.startsWith('>=')) {
      operator = '>=';
      value = rule.slice(2);
    } else if (rule.startsWith('<=')) {
      operator = '<=';
      value = rule.slice(2);
    } else if (rule.startsWith('>')) {
      operator = '>';
      value = rule.slice(1);
    } else if (rule.startsWith('<')) {
      operator = '<';
      value = rule.slice(1);
    } else if (rule.startsWith('=')) {
      operator = '==';
      value = rule.slice(1);
    }

    const comparison = compareVersions(version, value);
    if (comparison === null) {
      return false;
    }

    switch (operator) {
      case '>=':
        return comparison >= 0;
      case '<=':
        return comparison <= 0;
      case '>':
        return comparison > 0;
      case '<':
        return comparison < 0;
      default:
        return comparison === 0;
    }
  });
}

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
  constructor(options = {}) {
    this.modsDirectory = path.join(app.getPath('userData'), 'mods');
    this.modRegistry = new Map();
    this.hookRegistry = new HookRegistry(this.logForMod.bind(this));
    this.options = {
      appVersion: options.appVersion || app.getVersion(),
      gameVersion: options.gameVersion || '0.0.0',
      safeStart: Boolean(options.safeStart)
    };
  }

  async initialize() {
    await fs.mkdir(this.modsDirectory, { recursive: true });

    if (this.options.safeStart) {
      console.warn('[ModLoader] Safe-start active, all mods disabled for this session.');
      return this.getStateSnapshot();
    }

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
      const normalizedModDir = path.normalize(modDirectory) + path.sep;
      const normalizedEntry = path.normalize(entryPath);

      if (!normalizedEntry.startsWith(normalizedModDir)) {
        throw new Error('Entry path must stay inside the mod directory');
      }

      modState.module = await this.loadModModule(modId, entryPath);

      await this.runLifecycle(modId, 'onLoad');
      await this.enableMod(modId);
    } catch (error) {
      modState.status = 'error';
      modState.errors.push(error.message);
      this.logForMod(modId, 'load-error', 'Failed to load mod entry', error);
    }
  }

  validateManifest(manifest, manifestPath) {
    const errors = [];

    if (!manifest || typeof manifest !== 'object') {
      throw new ManifestValidationError(`Manifest in ${manifestPath} is not a JSON object`);
    }

    for (const fieldName of Object.keys(manifest)) {
      if (!ALLOWED_MANIFEST_FIELDS.has(fieldName)) {
        errors.push(`Field "${fieldName}" is not allowed`);
      }
    }

    for (const field of REQUIRED_MANIFEST_FIELDS) {
      if (manifest[field] === undefined || manifest[field] === null) {
        errors.push(`Missing required field "${field}"`);
      }
    }

    if (typeof manifest.id !== 'string' || !/^[a-z0-9._-]{3,64}$/i.test(manifest.id)) {
      errors.push('Field "id" must match /^[a-z0-9._-]{3,64}$/i');
    }

    if (typeof manifest.name !== 'string' || manifest.name.trim().length < 2) {
      errors.push('Field "name" must be a non-empty string (min length: 2)');
    }

    if (typeof manifest.version !== 'string' || !normalizeVersion(manifest.version)) {
      errors.push('Field "version" must use numeric format like "1.2.3"');
    }

    if (typeof manifest.entry !== 'string' || !manifest.entry.trim().endsWith('.js')) {
      errors.push('Field "entry" must be a .js relative path');
    }

    if (typeof manifest.apiVersion !== 'string' || !manifest.apiVersion.trim()) {
      errors.push('Field "apiVersion" must be a non-empty version range string');
    }

    if (typeof manifest.gameVersionRange !== 'string' || !manifest.gameVersionRange.trim()) {
      errors.push('Field "gameVersionRange" must be a non-empty version range string');
    }

    if (!Array.isArray(manifest.permissions)) {
      errors.push('Field "permissions" must be an array of strings');
    } else {
      if (manifest.permissions.length === 0) {
        errors.push('Field "permissions" cannot be empty');
      }

      for (const permission of manifest.permissions) {
        if (typeof permission !== 'string') {
          errors.push('All permissions must be strings');
          continue;
        }

        if (!ALLOWED_PERMISSIONS.has(permission)) {
          errors.push(`Permission "${permission}" is not recognized`);
        }
      }
    }

    if (typeof manifest.entry === 'string' && path.isAbsolute(manifest.entry)) {
      errors.push('Field "entry" must be relative, absolute paths are forbidden');
    }

    if (typeof manifest.apiVersion === 'string' && !satisfiesSimpleRange(CURRENT_MOD_API_VERSION, manifest.apiVersion)) {
      errors.push(`apiVersion "${manifest.apiVersion}" is incompatible with supported mod API ${CURRENT_MOD_API_VERSION}`);
    }

    if (typeof manifest.gameVersionRange === 'string' && !satisfiesSimpleRange(this.options.gameVersion, manifest.gameVersionRange)) {
      errors.push(`gameVersionRange "${manifest.gameVersionRange}" is incompatible with game version ${this.options.gameVersion}`);
    }

    if (errors.length > 0) {
      throw new ManifestValidationError(`Manifest in ${manifestPath} failed strict validation`, errors);
    }
  }

  async loadModModule(modId, entryPath) {
    const entryCode = await fs.readFile(entryPath, 'utf8');
    const sandbox = {
      module: { exports: {} },
      exports: {},
      globalThis: null,
      console: Object.freeze({
        log: (...args) => this.logForMod(modId, 'vm-log', args.join(' ')),
        info: (...args) => this.logForMod(modId, 'vm-log', args.join(' ')),
        warn: (...args) => this.logForMod(modId, 'vm-warn', args.join(' ')),
        error: (...args) => this.logForMod(modId, 'vm-error', args.join(' '))
      })
    };

    sandbox.globalThis = Object.freeze({ ...sandbox });

    const context = vm.createContext(sandbox, {
      name: `mod:${modId}`,
      codeGeneration: {
        strings: false,
        wasm: false
      }
    });

    const script = new vm.Script(entryCode, {
      filename: entryPath,
      displayErrors: true
    });

    script.runInContext(context, { timeout: 1000 });

    const exported = sandbox.module.exports && Object.keys(sandbox.module.exports).length > 0
      ? sandbox.module.exports
      : sandbox.exports;

    if (!exported || (typeof exported !== 'object' && typeof exported !== 'function')) {
      throw new Error('Mod entry must export an object containing lifecycle functions');
    }

    return exported;
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
      permissions: [...modState.manifest.permissions],
      app: {
        version: this.options.appVersion,
        modApiVersion: CURRENT_MOD_API_VERSION
      },
      game: {
        version: this.options.gameVersion
      }
    };

    if (modState.manifest.permissions.includes('hooks:register') || modState.manifest.permissions.includes('hooks:emit')) {
      context.hooks = {};
      if (modState.manifest.permissions.includes('hooks:register')) {
        context.hooks.on = (hookName, hookHandler) => this.hookRegistry.register(modId, hookName, hookHandler);
      }
      if (modState.manifest.permissions.includes('hooks:emit')) {
        context.hooks.emit = (hookName, payload) => this.hookRegistry.emit(hookName, payload);
      }
    }

    if (modState.manifest.permissions.includes('logger')) {
      context.logger = {
        info: (message, details) => this.logForMod(modId, phase, message, details),
        error: (message, details) => this.logForMod(modId, `${phase}-error`, message, details)
      };
    }

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
        errors: [...state.errors],
        permissions: [...state.manifest.permissions]
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
        stack: error.stack || null,
        details: Array.isArray(error.details) ? error.details : undefined
      };
    }

    console.log('[ModLoader]', JSON.stringify(logEntry));
  }
}

module.exports = ModLoader;
