const fs = require('node:fs');
const path = require('node:path');

// The tracker deliberately stores a flat list of artifacts. Keeping this small
// parser here avoids introducing a database while still producing ordinary,
// hand-editable YAML files.
function stripComment(value) {
  let quote = null;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote && value[index - 1] !== '\\') quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    if (character === '#') return value.slice(0, index).trimEnd();
  }
  return value.trim();
}

function parseScalar(raw) {
  const value = stripComment(raw.trim());
  if (!value || value === 'null' || value === '~') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

function parseYamlList(source) {
  const artifacts = [];
  if (source.trim() === '[]') return artifacts;
  let current = null;

  for (const rawLine of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed || trimmed === '---' || trimmed === '...') continue;

    if (trimmed.startsWith('- ' ) || trimmed === '-') {
      current = {};
      artifacts.push(current);
      const firstField = trimmed.slice(1).trim();
      if (firstField) assignField(current, firstField);
      continue;
    }

    if (!current || !/^\s+[^:#]+:\s*/.test(line)) {
      throw new Error('Expected a YAML list of artifact objects');
    }
    assignField(current, trimmed);
  }
  return artifacts;
}

function assignField(target, expression) {
  const separator = expression.indexOf(':');
  if (separator < 1) throw new Error(`Invalid YAML field: ${expression}`);
  const key = expression.slice(0, separator).trim();
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) throw new Error(`Invalid YAML field name: ${key}`);
  target[key] = parseScalar(expression.slice(separator + 1));
}

function yamlScalar(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(String(value));
}

function stringifyYamlList(items) {
  if (!items.length) return '[]\n';
  return `${items.map((item) => {
    const entries = Object.entries(item);
    return entries.map(([key, value], index) => `${index === 0 ? '- ' : '  '}${key}: ${yamlScalar(value)}`).join('\n');
  }).join('\n')}\n`;
}

function readYamlList(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.trim()) return [];
  return parseYamlList(content);
}

function writeYamlList(filePath, items) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, stringifyYamlList(items), 'utf8');
  fs.renameSync(temporaryPath, filePath);
}

module.exports = { readYamlList, writeYamlList, parseYamlList, stringifyYamlList };
