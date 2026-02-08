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

const parseNumber = (value, label) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
};

const id = getArg('id');
const cost = getArg('cost');
const money = getArg('money');
const exp = getArg('exp');
const time = getArg('time');
const autoscriptCost = getArg('autoscript-cost');
const file = getArg('file') || path.join(__dirname, '..', 'app', 'data', 'scripts.json');

if (!id || cost === null || money === null || exp === null || time === null || autoscriptCost === null) {
  console.error('Usage: node scripts/add-script.js --id <name> --cost <num> --money <num> --exp <num> --time <num> --autoscript-cost <num> [--file <path>]');
  process.exit(1);
}

const payload = {
  id,
  cost: parseNumber(cost, 'cost'),
  money: parseNumber(money, 'money'),
  exp: parseNumber(exp, 'exp'),
  time: parseNumber(time, 'time'),
  autoscriptCost: parseNumber(autoscriptCost, 'autoscript-cost')
};

const filePath = path.resolve(file);
const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const scripts = Array.isArray(existing.scripts) ? existing.scripts : [];

if (scripts.some((script) => script.id === id)) {
  console.error(`Script already exists: ${id}`);
  process.exit(1);
}

scripts.push(payload);
const updated = {
  scripts
};

fs.writeFileSync(filePath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
console.log(`Added script ${id} to ${filePath}`);
