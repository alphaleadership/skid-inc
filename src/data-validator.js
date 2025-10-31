const { EventEmitter } = require('events');

/**
 * DataValidator - Validates and repairs game state data integrity
 * Implements schema validation, automatic repair, and corruption handling
 */
class DataValidator extends EventEmitter {
  constructor() {
    super();
    
    // Game state schema definition
    this.gameStateSchema = {
      version: { type: 'string', required: false, default: '1.0.0' },
      timestamp: { type: 'number', required: false, default: () => Date.now() },
      player: {
        type: 'object',
        required: true,
        properties: {
          username: { type: 'string', required: false, default: 'Player' },
          money: { type: 'number', required: true, default: 0, min: 0 },
          totalMoney: { type: 'number', required: true, default: 0, min: 0 },
          exp: { type: 'number', required: true, default: 0, min: 0 },
          totalExp: { type: 'number', required: true, default: 0, min: 0 },
          expReq: { type: 'number', required: true, default: 100, min: 1 },
          level: { type: 'number', required: true, default: 1, min: 1 },
          botnet: { type: 'number', required: false, default: 0, min: 0 },
          prestigeCount: { type: 'number', required: false, default: 0, min: 0 }
        }
      },
      script: {
        type: 'object',
        required: true,
        properties: {
          unlocked: { type: 'array', required: true, default: [] },
          completed: { type: 'array', required: true, default: [] },
          totalCompleted: { type: 'number', required: true, default: 0, min: 0 },
          available: { type: 'array', required: true, default: [] },
          current: { type: 'object', required: false, default: null },
          time: { type: 'number', required: false, default: 0, min: 0 },
          maxTime: { type: 'number', required: false, default: 0, min: 0 }
        }
      },
      server: {
        type: 'object',
        required: true,
        properties: {
          owned: { type: 'array', required: true, default: [] }
        }
      },
      battery: {
        type: 'object',
        required: false,
        properties: {
          level: { type: 'number', required: true, default: 100, min: 0, max: 100 },
          time: { type: 'number', required: false, default: 0, min: 0 }
        }
      },
      achievements: {
        type: 'object',
        required: false,
        properties: {
          owned: { type: 'array', required: true, default: [] }
        }
      },
      autoscript: {
        type: 'object',
        required: false,
        properties: {
          unlocked: { type: 'array', required: true, default: [] }
        }
      },
      options: {
        type: 'object',
        required: false,
        properties: {
          typed: { type: 'boolean', required: false, default: true }
        }
      },
      tutorial: {
        type: 'object',
        required: false,
        properties: {
          finish: { type: 'boolean', required: false, default: false }
        }
      },
      console: {
        type: 'object',
        required: false,
        properties: {
          grammarly: { type: 'boolean', required: false, default: false }
        }
      }
    };
    
    // Validation statistics
    this.stats = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      repairedData: 0,
      irreparableCorruption: 0,
      lastValidation: null
    };
    
    console.log('DataValidator initialized');
  }

  /**
   * Validates game state against schema with automatic repair
   * @param {Object} gameState - Game state to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result with repaired data
   */
  async validateGameState(gameState, options = {}) {
    const startTime = Date.now();
    this.stats.totalValidations++;
    this.stats.lastValidation = startTime;
    
    const validationResult = {
      isValid: true,
      wasRepaired: false,
      errors: [],
      warnings: [],
      repairedFields: [],
      originalData: null,
      repairedData: null,
      validationTime: 0
    };
    
    try {
      // Store original data for comparison
      validationResult.originalData = this.deepClone(gameState);
      
      // Perform validation and repair
      const repairedData = await this.validateAndRepair(gameState, this.gameStateSchema, '', validationResult);
      
      validationResult.repairedData = repairedData;
      validationResult.validationTime = Date.now() - startTime;
      
      // Check if data was repaired
      if (validationResult.repairedFields.length > 0) {
        validationResult.wasRepaired = true;
        this.stats.repairedData++;
        
        this.emit('data-repaired', {
          repairedFields: validationResult.repairedFields,
          validationTime: validationResult.validationTime,
          timestamp: Date.now()
        });
      }
      
      // Determine overall validity
      const criticalErrors = validationResult.errors.filter(error => error.severity === 'critical');
      validationResult.isValid = criticalErrors.length === 0;
      
      if (validationResult.isValid) {
        this.stats.successfulValidations++;
      } else {
        this.stats.failedValidations++;
        this.stats.irreparableCorruption++;
      }
      
      this.emit('validation-complete', {
        isValid: validationResult.isValid,
        wasRepaired: validationResult.wasRepaired,
        errorCount: validationResult.errors.length,
        warningCount: validationResult.warnings.length,
        validationTime: validationResult.validationTime
      });
      
      return validationResult;
      
    } catch (error) {
      this.stats.failedValidations++;
      
      validationResult.isValid = false;
      validationResult.errors.push({
        field: 'root',
        message: `Validation failed: ${error.message}`,
        severity: 'critical',
        type: 'validation_error'
      });
      
      this.emit('validation-error', {
        error: error.message,
        timestamp: Date.now()
      });
      
      return validationResult;
    }
  }

  /**
   * Recursively validates and repairs data against schema
   * @param {any} data - Data to validate
   * @param {Object} schema - Schema to validate against
   * @param {string} path - Current path in the data structure
   * @param {Object} result - Validation result object to update
   * @returns {any} Repaired data
   */
  async validateAndRepair(data, schema, path = '', result) {
    if (schema.type === 'object') {
      return await this.validateObject(data, schema, path, result);
    } else if (schema.type === 'array') {
      return await this.validateArray(data, schema, path, result);
    } else {
      return await this.validatePrimitive(data, schema, path, result);
    }
  }

  /**
   * Validates and repairs object data
   * @param {Object} data - Object data to validate
   * @param {Object} schema - Object schema
   * @param {string} path - Current path
   * @param {Object} result - Validation result
   * @returns {Object} Repaired object
   */
  async validateObject(data, schema, path, result) {
    let repairedData = {};
    
    // Handle null or undefined data
    if (data === null || data === undefined) {
      if (schema.required) {
        result.errors.push({
          field: path,
          message: `Required object is null or undefined`,
          severity: 'critical',
          type: 'missing_required'
        });
        return null;
      } else {
        // Create default object
        repairedData = {};
        result.repairedFields.push(`${path} (created default object)`);
      }
    } else if (typeof data !== 'object' || Array.isArray(data)) {
      result.errors.push({
        field: path,
        message: `Expected object, got ${typeof data}`,
        severity: 'critical',
        type: 'type_mismatch'
      });
      
      if (schema.required) {
        return null;
      } else {
        repairedData = {};
        result.repairedFields.push(`${path} (converted to object)`);
      }
    } else {
      repairedData = { ...data };
    }
    
    // Validate and repair properties
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const propPath = path ? `${path}.${propName}` : propName;
        const propValue = repairedData[propName];
        
        try {
          const repairedProp = await this.validateAndRepair(propValue, propSchema, propPath, result);
          
          if (repairedProp !== propValue) {
            repairedData[propName] = repairedProp;
            if (!result.repairedFields.includes(propPath)) {
              result.repairedFields.push(propPath);
            }
          }
        } catch (error) {
          result.errors.push({
            field: propPath,
            message: `Property validation failed: ${error.message}`,
            severity: 'warning',
            type: 'property_error'
          });
        }
      }
    }
    
    return repairedData;
  }

  /**
   * Validates and repairs array data
   * @param {Array} data - Array data to validate
   * @param {Object} schema - Array schema
   * @param {string} path - Current path
   * @param {Object} result - Validation result
   * @returns {Array} Repaired array
   */
  async validateArray(data, schema, path, result) {
    // Handle null or undefined data
    if (data === null || data === undefined) {
      if (schema.required) {
        result.errors.push({
          field: path,
          message: `Required array is null or undefined`,
          severity: 'critical',
          type: 'missing_required'
        });
        return null;
      } else {
        const defaultValue = typeof schema.default === 'function' ? schema.default() : (schema.default || []);
        result.repairedFields.push(`${path} (created default array)`);
        return defaultValue;
      }
    }
    
    // Convert non-arrays to arrays if possible
    if (!Array.isArray(data)) {
      result.warnings.push({
        field: path,
        message: `Expected array, got ${typeof data}. Attempting conversion.`,
        severity: 'warning',
        type: 'type_conversion'
      });
      
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            result.repairedFields.push(`${path} (parsed from string)`);
            return parsed;
          }
        } catch (e) {
          // Fall through to default
        }
      }
      
      // Create default array
      const defaultValue = typeof schema.default === 'function' ? schema.default() : (schema.default || []);
      result.repairedFields.push(`${path} (converted to array)`);
      return defaultValue;
    }
    
    // Validate array constraints
    if (schema.maxLength && data.length > schema.maxLength) {
      result.warnings.push({
        field: path,
        message: `Array length ${data.length} exceeds maximum ${schema.maxLength}`,
        severity: 'warning',
        type: 'constraint_violation'
      });
      
      const truncated = data.slice(0, schema.maxLength);
      result.repairedFields.push(`${path} (truncated to max length)`);
      return truncated;
    }
    
    // Remove duplicates if specified
    if (schema.unique) {
      const unique = [...new Set(data)];
      if (unique.length !== data.length) {
        result.repairedFields.push(`${path} (removed duplicates)`);
        return unique;
      }
    }
    
    return data;
  }

  /**
   * Validates and repairs primitive data types
   * @param {any} data - Primitive data to validate
   * @param {Object} schema - Primitive schema
   * @param {string} path - Current path
   * @param {Object} result - Validation result
   * @returns {any} Repaired primitive value
   */
  async validatePrimitive(data, schema, path, result) {
    // Handle null or undefined data
    if (data === null || data === undefined) {
      if (schema.required) {
        result.errors.push({
          field: path,
          message: `Required field is null or undefined`,
          severity: 'critical',
          type: 'missing_required'
        });
        return null;
      } else {
        const defaultValue = typeof schema.default === 'function' ? schema.default() : schema.default;
        if (defaultValue !== undefined) {
          result.repairedFields.push(`${path} (set to default)`);
          return defaultValue;
        }
        return data;
      }
    }
    
    // Type validation and conversion
    const expectedType = schema.type;
    const actualType = typeof data;
    
    if (actualType !== expectedType) {
      // Attempt type conversion
      const converted = this.convertType(data, expectedType, path, result);
      if (converted.success) {
        result.repairedFields.push(`${path} (converted from ${actualType} to ${expectedType})`);
        return converted.value;
      } else {
        result.errors.push({
          field: path,
          message: `Type mismatch: expected ${expectedType}, got ${actualType}`,
          severity: schema.required ? 'critical' : 'warning',
          type: 'type_mismatch'
        });
        
        if (schema.required) {
          return null;
        } else {
          const defaultValue = typeof schema.default === 'function' ? schema.default() : schema.default;
          if (defaultValue !== undefined) {
            result.repairedFields.push(`${path} (fallback to default)`);
            return defaultValue;
          }
        }
      }
    }
    
    // Constraint validation
    if (expectedType === 'number') {
      return this.validateNumberConstraints(data, schema, path, result);
    } else if (expectedType === 'string') {
      return this.validateStringConstraints(data, schema, path, result);
    }
    
    return data;
  }

  /**
   * Validates number constraints and repairs if possible
   * @param {number} value - Number value to validate
   * @param {Object} schema - Number schema with constraints
   * @param {string} path - Current path
   * @param {Object} result - Validation result
   * @returns {number} Repaired number value
   */
  validateNumberConstraints(value, schema, path, result) {
    let repairedValue = value;
    
    // Check for NaN or Infinity
    if (!isFinite(value)) {
      result.errors.push({
        field: path,
        message: `Invalid number: ${value}`,
        severity: 'warning',
        type: 'invalid_number'
      });
      
      const defaultValue = typeof schema.default === 'function' ? schema.default() : (schema.default || 0);
      result.repairedFields.push(`${path} (replaced invalid number)`);
      return defaultValue;
    }
    
    // Minimum constraint
    if (schema.min !== undefined && value < schema.min) {
      result.warnings.push({
        field: path,
        message: `Value ${value} is below minimum ${schema.min}`,
        severity: 'warning',
        type: 'constraint_violation'
      });
      
      repairedValue = schema.min;
      result.repairedFields.push(`${path} (clamped to minimum)`);
    }
    
    // Maximum constraint
    if (schema.max !== undefined && repairedValue > schema.max) {
      result.warnings.push({
        field: path,
        message: `Value ${repairedValue} is above maximum ${schema.max}`,
        severity: 'warning',
        type: 'constraint_violation'
      });
      
      repairedValue = schema.max;
      result.repairedFields.push(`${path} (clamped to maximum)`);
    }
    
    // Integer constraint
    if (schema.integer && !Number.isInteger(repairedValue)) {
      result.warnings.push({
        field: path,
        message: `Value ${repairedValue} should be an integer`,
        severity: 'warning',
        type: 'constraint_violation'
      });
      
      repairedValue = Math.round(repairedValue);
      result.repairedFields.push(`${path} (rounded to integer)`);
    }
    
    return repairedValue;
  }

  /**
   * Validates string constraints and repairs if possible
   * @param {string} value - String value to validate
   * @param {Object} schema - String schema with constraints
   * @param {string} path - Current path
   * @param {Object} result - Validation result
   * @returns {string} Repaired string value
   */
  validateStringConstraints(value, schema, path, result) {
    let repairedValue = value;
    
    // Length constraints
    if (schema.maxLength && value.length > schema.maxLength) {
      result.warnings.push({
        field: path,
        message: `String length ${value.length} exceeds maximum ${schema.maxLength}`,
        severity: 'warning',
        type: 'constraint_violation'
      });
      
      repairedValue = value.substring(0, schema.maxLength);
      result.repairedFields.push(`${path} (truncated to max length)`);
    }
    
    if (schema.minLength && repairedValue.length < schema.minLength) {
      result.warnings.push({
        field: path,
        message: `String length ${repairedValue.length} is below minimum ${schema.minLength}`,
        severity: 'warning',
        type: 'constraint_violation'
      });
      
      // Pad with default character or use default value
      if (schema.default) {
        const defaultValue = typeof schema.default === 'function' ? schema.default() : schema.default;
        repairedValue = defaultValue;
        result.repairedFields.push(`${path} (replaced with default)`);
      }
    }
    
    // Pattern validation
    if (schema.pattern && !new RegExp(schema.pattern).test(repairedValue)) {
      result.warnings.push({
        field: path,
        message: `String does not match required pattern`,
        severity: 'warning',
        type: 'pattern_mismatch'
      });
      
      if (schema.default) {
        const defaultValue = typeof schema.default === 'function' ? schema.default() : schema.default;
        repairedValue = defaultValue;
        result.repairedFields.push(`${path} (replaced with default due to pattern mismatch)`);
      }
    }
    
    return repairedValue;
  }

  /**
   * Attempts to convert data to the expected type
   * @param {any} value - Value to convert
   * @param {string} targetType - Target type
   * @param {string} path - Current path
   * @param {Object} result - Validation result
   * @returns {Object} Conversion result
   */
  convertType(value, targetType, path, result) {
    try {
      switch (targetType) {
        case 'string':
          return { success: true, value: String(value) };
          
        case 'number':
          const num = Number(value);
          if (isNaN(num)) {
            return { success: false, error: 'Cannot convert to number' };
          }
          return { success: true, value: num };
          
        case 'boolean':
          if (typeof value === 'string') {
            const lower = value.toLowerCase();
            if (lower === 'true' || lower === '1' || lower === 'yes') {
              return { success: true, value: true };
            } else if (lower === 'false' || lower === '0' || lower === 'no') {
              return { success: true, value: false };
            }
          } else if (typeof value === 'number') {
            return { success: true, value: Boolean(value) };
          }
          return { success: false, error: 'Cannot convert to boolean' };
          
        case 'object':
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                return { success: true, value: parsed };
              }
            } catch (e) {
              // Fall through
            }
          }
          return { success: false, error: 'Cannot convert to object' };
          
        case 'array':
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) {
                return { success: true, value: parsed };
              }
            } catch (e) {
              // Fall through
            }
          }
          return { success: false, error: 'Cannot convert to array' };
          
        default:
          return { success: false, error: `Unknown target type: ${targetType}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Performs deep validation of game state relationships and logic
   * @param {Object} gameState - Game state to validate
   * @returns {Object} Deep validation result
   */
  async performDeepValidation(gameState) {
    const issues = [];
    
    try {
      // Validate player progression logic
      if (gameState.player) {
        const player = gameState.player;
        
        // Check if totalMoney >= money
        if (player.totalMoney < player.money) {
          issues.push({
            type: 'logic_error',
            severity: 'warning',
            message: 'Total money is less than current money',
            field: 'player.totalMoney',
            suggestedFix: 'Set totalMoney to current money value'
          });
        }
        
        // Check if totalExp >= exp
        if (player.totalExp < player.exp) {
          issues.push({
            type: 'logic_error',
            severity: 'warning',
            message: 'Total experience is less than current experience',
            field: 'player.totalExp',
            suggestedFix: 'Set totalExp to current exp value'
          });
        }
        
        // Check level progression
        if (player.level < 1) {
          issues.push({
            type: 'logic_error',
            severity: 'critical',
            message: 'Player level cannot be less than 1',
            field: 'player.level',
            suggestedFix: 'Set level to 1'
          });
        }
        
        // Check experience requirements
        if (player.expReq <= 0) {
          issues.push({
            type: 'logic_error',
            severity: 'critical',
            message: 'Experience requirement must be positive',
            field: 'player.expReq',
            suggestedFix: 'Set expReq to appropriate value based on level'
          });
        }
      }
      
      // Validate script progression
      if (gameState.script) {
        const script = gameState.script;
        
        // Check if totalCompleted matches completed array length
        if (script.completed && script.totalCompleted !== script.completed.length) {
          issues.push({
            type: 'logic_error',
            severity: 'warning',
            message: 'Total completed count does not match completed array length',
            field: 'script.totalCompleted',
            suggestedFix: 'Set totalCompleted to completed array length'
          });
        }
        
        // Check if unlocked scripts are valid
        if (script.unlocked && script.completed) {
          const invalidCompleted = script.completed.filter(id => !script.unlocked.includes(id));
          if (invalidCompleted.length > 0) {
            issues.push({
              type: 'logic_error',
              severity: 'warning',
              message: 'Some completed scripts are not in unlocked list',
              field: 'script.completed',
              suggestedFix: 'Add completed scripts to unlocked list'
            });
          }
        }
      }
      
      // Validate battery constraints
      if (gameState.battery) {
        const battery = gameState.battery;
        
        if (battery.level < 0 || battery.level > 100) {
          issues.push({
            type: 'logic_error',
            severity: 'warning',
            message: 'Battery level should be between 0 and 100',
            field: 'battery.level',
            suggestedFix: 'Clamp battery level to valid range'
          });
        }
      }
      
      return {
        isValid: issues.filter(issue => issue.severity === 'critical').length === 0,
        issues: issues,
        timestamp: Date.now()
      };
      
    } catch (error) {
      return {
        isValid: false,
        issues: [{
          type: 'validation_error',
          severity: 'critical',
          message: `Deep validation failed: ${error.message}`,
          field: 'root'
        }],
        timestamp: Date.now()
      };
    }
  }

  /**
   * Attempts to repair corrupted data automatically
   * @param {Object} gameState - Corrupted game state
   * @param {Object} validationResult - Previous validation result
   * @returns {Promise<Object>} Repair result
   */
  async repairCorruptedData(gameState, validationResult) {
    const repairResult = {
      success: false,
      repairedData: null,
      appliedFixes: [],
      unresolvedIssues: []
    };
    
    try {
      let repairedData = this.deepClone(gameState);
      
      // Apply automatic fixes based on validation errors
      for (const error of validationResult.errors) {
        try {
          const fix = await this.applyAutomaticFix(repairedData, error);
          if (fix.success) {
            repairResult.appliedFixes.push({
              field: error.field,
              issue: error.message,
              fix: fix.description
            });
          } else {
            repairResult.unresolvedIssues.push(error);
          }
        } catch (fixError) {
          repairResult.unresolvedIssues.push({
            ...error,
            fixError: fixError.message
          });
        }
      }
      
      // Perform deep validation repair
      const deepValidation = await this.performDeepValidation(repairedData);
      for (const issue of deepValidation.issues) {
        if (issue.suggestedFix) {
          try {
            const fix = await this.applyLogicFix(repairedData, issue);
            if (fix.success) {
              repairResult.appliedFixes.push({
                field: issue.field,
                issue: issue.message,
                fix: fix.description
              });
            }
          } catch (fixError) {
            repairResult.unresolvedIssues.push({
              ...issue,
              fixError: fixError.message
            });
          }
        }
      }
      
      repairResult.success = repairResult.unresolvedIssues.filter(issue => 
        issue.severity === 'critical'
      ).length === 0;
      
      repairResult.repairedData = repairedData;
      
      this.emit('data-repair-complete', {
        success: repairResult.success,
        appliedFixes: repairResult.appliedFixes.length,
        unresolvedIssues: repairResult.unresolvedIssues.length,
        timestamp: Date.now()
      });
      
      return repairResult;
      
    } catch (error) {
      repairResult.unresolvedIssues.push({
        field: 'root',
        message: `Repair process failed: ${error.message}`,
        severity: 'critical',
        type: 'repair_error'
      });
      
      return repairResult;
    }
  }

  /**
   * Applies automatic fix for a validation error
   * @param {Object} data - Data to fix
   * @param {Object} error - Validation error
   * @returns {Promise<Object>} Fix result
   */
  async applyAutomaticFix(data, error) {
    try {
      const fieldPath = error.field.split('.');
      
      switch (error.type) {
        case 'missing_required':
          return this.fixMissingRequired(data, fieldPath, error);
          
        case 'type_mismatch':
          return this.fixTypeMismatch(data, fieldPath, error);
          
        case 'constraint_violation':
          return this.fixConstraintViolation(data, fieldPath, error);
          
        default:
          return { success: false, description: 'No automatic fix available' };
      }
    } catch (error) {
      return { success: false, description: `Fix failed: ${error.message}` };
    }
  }

  /**
   * Fixes missing required fields
   * @param {Object} data - Data to fix
   * @param {Array} fieldPath - Path to the field
   * @param {Object} error - Validation error
   * @returns {Object} Fix result
   */
  fixMissingRequired(data, fieldPath, error) {
    try {
      const schema = this.getSchemaForPath(fieldPath);
      if (schema && schema.default !== undefined) {
        const defaultValue = typeof schema.default === 'function' ? schema.default() : schema.default;
        this.setNestedValue(data, fieldPath, defaultValue);
        return { success: true, description: `Set missing field to default value: ${defaultValue}` };
      }
      
      // Create minimal valid structure
      const fieldType = schema ? schema.type : 'object';
      let defaultValue;
      
      switch (fieldType) {
        case 'string': defaultValue = ''; break;
        case 'number': defaultValue = 0; break;
        case 'boolean': defaultValue = false; break;
        case 'array': defaultValue = []; break;
        case 'object': defaultValue = {}; break;
        default: defaultValue = null;
      }
      
      this.setNestedValue(data, fieldPath, defaultValue);
      return { success: true, description: `Created missing field with default ${fieldType}` };
      
    } catch (error) {
      return { success: false, description: `Failed to fix missing field: ${error.message}` };
    }
  }

  /**
   * Fixes type mismatches
   * @param {Object} data - Data to fix
   * @param {Array} fieldPath - Path to the field
   * @param {Object} error - Validation error
   * @returns {Object} Fix result
   */
  fixTypeMismatch(data, fieldPath, error) {
    try {
      const currentValue = this.getNestedValue(data, fieldPath);
      const schema = this.getSchemaForPath(fieldPath);
      
      if (schema) {
        const conversion = this.convertType(currentValue, schema.type, fieldPath.join('.'), {});
        if (conversion.success) {
          this.setNestedValue(data, fieldPath, conversion.value);
          return { success: true, description: `Converted ${typeof currentValue} to ${schema.type}` };
        }
      }
      
      return { success: false, description: 'Type conversion failed' };
      
    } catch (error) {
      return { success: false, description: `Failed to fix type mismatch: ${error.message}` };
    }
  }

  /**
   * Fixes constraint violations
   * @param {Object} data - Data to fix
   * @param {Array} fieldPath - Path to the field
   * @param {Object} error - Validation error
   * @returns {Object} Fix result
   */
  fixConstraintViolation(data, fieldPath, error) {
    try {
      const currentValue = this.getNestedValue(data, fieldPath);
      const schema = this.getSchemaForPath(fieldPath);
      
      if (schema && typeof currentValue === 'number') {
        let fixedValue = currentValue;
        
        if (schema.min !== undefined && currentValue < schema.min) {
          fixedValue = schema.min;
        }
        if (schema.max !== undefined && fixedValue > schema.max) {
          fixedValue = schema.max;
        }
        
        if (fixedValue !== currentValue) {
          this.setNestedValue(data, fieldPath, fixedValue);
          return { success: true, description: `Clamped value from ${currentValue} to ${fixedValue}` };
        }
      }
      
      return { success: false, description: 'No constraint fix applicable' };
      
    } catch (error) {
      return { success: false, description: `Failed to fix constraint: ${error.message}` };
    }
  }

  /**
   * Applies logic-based fixes for game state consistency
   * @param {Object} data - Data to fix
   * @param {Object} issue - Logic issue
   * @returns {Promise<Object>} Fix result
   */
  async applyLogicFix(data, issue) {
    try {
      switch (issue.field) {
        case 'player.totalMoney':
          if (data.player && data.player.money > data.player.totalMoney) {
            data.player.totalMoney = data.player.money;
            return { success: true, description: 'Set totalMoney to current money' };
          }
          break;
          
        case 'player.totalExp':
          if (data.player && data.player.exp > data.player.totalExp) {
            data.player.totalExp = data.player.exp;
            return { success: true, description: 'Set totalExp to current exp' };
          }
          break;
          
        case 'player.level':
          if (data.player && data.player.level < 1) {
            data.player.level = 1;
            return { success: true, description: 'Set level to minimum value of 1' };
          }
          break;
          
        case 'script.totalCompleted':
          if (data.script && data.script.completed) {
            data.script.totalCompleted = data.script.completed.length;
            return { success: true, description: 'Synchronized totalCompleted with completed array' };
          }
          break;
          
        case 'battery.level':
          if (data.battery) {
            data.battery.level = Math.max(0, Math.min(100, data.battery.level));
            return { success: true, description: 'Clamped battery level to valid range' };
          }
          break;
      }
      
      return { success: false, description: 'No logic fix available for this issue' };
      
    } catch (error) {
      return { success: false, description: `Logic fix failed: ${error.message}` };
    }
  }

  /**
   * Gets schema for a specific field path
   * @param {Array} fieldPath - Path to the field
   * @returns {Object|null} Schema for the field
   */
  getSchemaForPath(fieldPath) {
    let currentSchema = this.gameStateSchema;
    
    for (const segment of fieldPath) {
      if (currentSchema.properties && currentSchema.properties[segment]) {
        currentSchema = currentSchema.properties[segment];
      } else {
        return null;
      }
    }
    
    return currentSchema;
  }

  /**
   * Gets nested value from object using path array
   * @param {Object} obj - Object to get value from
   * @param {Array} path - Path array
   * @returns {any} Nested value
   */
  getNestedValue(obj, path) {
    return path.reduce((current, key) => current && current[key], obj);
  }

  /**
   * Sets nested value in object using path array
   * @param {Object} obj - Object to set value in
   * @param {Array} path - Path array
   * @param {any} value - Value to set
   */
  setNestedValue(obj, path, value) {
    const lastKey = path.pop();
    const target = path.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  }

  /**
   * Creates a deep clone of an object
   * @param {any} obj - Object to clone
   * @returns {any} Deep cloned object
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Gets validation statistics
   * @returns {Object} Validation statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      successRate: this.stats.totalValidations > 0 ? 
        (this.stats.successfulValidations / this.stats.totalValidations) * 100 : 0,
      repairRate: this.stats.totalValidations > 0 ? 
        (this.stats.repairedData / this.stats.totalValidations) * 100 : 0
    };
  }

  /**
   * Resets validation statistics
   */
  resetStatistics() {
    this.stats = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      repairedData: 0,
      irreparableCorruption: 0,
      lastValidation: null
    };
  }

  /**
   * Updates schema definition
   * @param {Object} newSchema - New schema definition
   */
  updateSchema(newSchema) {
    this.gameStateSchema = { ...this.gameStateSchema, ...newSchema };
    console.log('Data validation schema updated');
  }
}

module.exports = DataValidator;