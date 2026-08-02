const fs = require('node:fs');
const path = require('node:path');
const { readYamlList, writeYamlList } = require('./yaml-store');

const EDITABLE_FIELDS = [
  'project',
  'currentVersionResource',
  'currentVersionExpression',
  'coordinates',
  'latestVersionFilter'
];

const COMPUTED_FIELDS = ['currentVersion', 'latestVersion', 'latestAndGreatest'];
const ALL_FIELDS = ['id', ...EDITABLE_FIELDS, ...COMPUTED_FIELDS];

function emptyComputedFields() {
  return Object.fromEntries(COMPUTED_FIELDS.map((field) => [field, null]));
}

function normaliseArtifact(raw) {
  const artifact = { id: Number(raw.id), ...emptyComputedFields() };
  for (const field of EDITABLE_FIELDS) artifact[field] = raw[field] == null ? '' : String(raw[field]);
  for (const field of COMPUTED_FIELDS) {
    if (raw[field] !== undefined && raw[field] !== null) artifact[field] = String(raw[field]);
  }
  return artifact;
}

function validateEditable(input, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Request body must be a JSON object');
  }
  const values = {};
  for (const field of EDITABLE_FIELDS) {
    if (partial && input[field] === undefined) continue;
    if (typeof input[field] !== 'string') throw new Error(`${field} must be a string`);
    values[field] = input[field].trim();
  }

  const required = ['project', 'currentVersionResource', 'currentVersionExpression', 'coordinates'];
  for (const field of required) {
    if (!values[field] && !partial) throw new Error(`${field} is required`);
  }
  if (!partial || values.currentVersionResource !== undefined) {
    const resource = values.currentVersionResource;
    if (resource && !/^https:\/\//i.test(resource)) {
      throw new Error('currentVersionResource must be an HTTPS URL');
    }
  }
  if (!partial || values.coordinates !== undefined) {
    if (values.coordinates && !/^(?:mvn:[^:]+:[^:]+|docker:[^/\s]+\/[A-Za-z0-9._-]+(?::[^\s]+)?)$/i.test(values.coordinates)) {
      throw new Error('coordinates must use mvn:group:artifact or docker:namespace/image[:tag] format');
    }
  }
  return values;
}

function createArtifactStore(filePath = process.env.ARTIFACTS_FILE || path.join(__dirname, '..', 'data', 'artifacts.yml')) {
  function load() {
    let rows;
    try {
      rows = readYamlList(filePath);
    } catch (error) {
      throw new Error(`Could not read artifacts YAML: ${error.message}`);
    }
    return rows.map(normaliseArtifact);
  }

  function save(rows) {
    writeYamlList(filePath, rows);
  }

  return {
    filePath,
    list() {
      return load();
    },
    get(id) {
      return load().find((artifact) => artifact.id === id) || null;
    },
    create(input) {
      const values = validateEditable(input);
      const rows = load();
      const nextId = rows.reduce((highest, artifact) => Math.max(highest, artifact.id || 0), 0) + 1;
      const artifact = { id: nextId, ...values, ...emptyComputedFields() };
      save([...rows, artifact]);
      return artifact;
    },
    update(id, input) {
      const values = validateEditable(input, { partial: true });
      const rows = load();
      const index = rows.findIndex((artifact) => artifact.id === id);
      if (index === -1) return null;
      const updated = { ...rows[index], ...values, ...emptyComputedFields() };
      save(rows.map((artifact, rowIndex) => rowIndex === index ? updated : artifact));
      return updated;
    },
    remove(id) {
      const rows = load();
      const remaining = rows.filter((artifact) => artifact.id !== id);
      if (remaining.length === rows.length) return false;
      save(remaining);
      return true;
    },
    fields: { editable: [...EDITABLE_FIELDS], computed: [...COMPUTED_FIELDS], all: [...ALL_FIELDS] }
  };
}

module.exports = { createArtifactStore, EDITABLE_FIELDS, COMPUTED_FIELDS, ALL_FIELDS, validateEditable };
