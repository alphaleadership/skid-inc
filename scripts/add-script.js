#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const getArg = (name) => {
  const index = argv.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= argv.length) {
    return null;
  }
  return argv[index + 1];
};

const parseNumber = (value, label, defaultValue) => {
  if (value === null || value === undefined) return defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
};

const id = argv[0] && !argv[0].startsWith('--') ? argv[0] : getArg('id');
const file = getArg('file') || path.join(__dirname, '..', 'app', 'data', 'scripts.json');
const filePath = path.resolve(file);

if (!id) {
  console.error('Usage: node scripts/add-script.js <id> [--cost <num>] [--money <num>] [--exp <num>] [--time <num>] [--autoscript-cost <num>] [--file <path>]');
  process.exit(1);
}

let scripts = [];
try {
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  scripts = Array.isArray(existing.scripts) ? existing.scripts : [];
} catch (e) {
  console.log(`Creating new file: ${filePath}`);
}

if (scripts.some((script) => script.id === id)) {
  console.error(`Script already exists: ${id}`);
  process.exit(1);
}

const last = scripts.length > 0 ? scripts[scripts.length - 1] : {
  cost: 0,
  money: 118,
  exp: 8,
  time: 4,
  autoscriptCost: 420
};

const defaultValues = scripts.length === 0 ? last : {
  cost: last.cost === 0 ? 3750 : last.cost * 14,
  money: last.money * 11,
  exp: last.exp * 7,
  time: last.time * 4,
};
defaultValues.autoscriptCost = defaultValues.cost * 6 || 420;

const payload = {
  id,
  cost: parseNumber(getArg('cost'), 'cost', defaultValues.cost),
  money: parseNumber(getArg('money'), 'money', defaultValues.money),
  exp: parseNumber(getArg('exp'), 'exp', defaultValues.exp),
  time: parseNumber(getArg('time'), 'time', defaultValues.time),
  autoscriptCost: parseNumber(getArg('autoscript-cost'), 'autoscript-cost', defaultValues.autoscriptCost)
};

scripts.push(payload);
const updated = {
  scripts
};

fs.writeFileSync(filePath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
console.log(`Added script ${id} to ${filePath}`);
console.log('Parameters:', payload);
