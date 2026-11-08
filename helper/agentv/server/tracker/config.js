const fs = require('node:fs/promises');
const path = require('node:path');
const YAML = require('yaml');

const DATA_FILE = path.resolve(process.env.DATA_FILE || path.join(__dirname, '../../data/dependencies.yaml'));
const APPLATE_ROOT = path.resolve(process.env.APPLATE_ROOT || path.join(__dirname, '../../../..'));
const ROOT_GIT_REPO = process.env.ROOT_GIT_REPO || '';
const RESULTS_FILE = path.resolve(process.env.RESULTS_FILE || path.join(__dirname, '../../data/results.yaml'));

function coordinates(value) {
    const match = /^(mvn|npm|docker):(.+)$/.exec(value);
    if (!match) throw new Error(`Unsupported coordinates: ${value}`);
    const ecosystem = match[1];
    // The old watcher used a trailing Docker tag prefix; selection now uses the filter.
    const name = ecosystem === 'docker' ? match[2].split(':')[0] : match[2];
    if (ecosystem === 'mvn' && !/^[^:]+:[^:]+$/.test(name)) {
        throw new Error(`Expected mvn:groupId:artifactId: ${value}`);
    }
    return {
        ecosystem,
        name,
        registry: {mvn: 'repo1.maven.org', npm: 'npmjs.org', docker: 'hub.docker.com'}[ecosystem]
    };
}

async function loadDependencies(file = DATA_FILE) {
    const entries = YAML.parse(await fs.readFile(file, 'utf8'));
    if (!Array.isArray(entries) || !entries.length) throw new Error('Dependency YAML must be a nonempty list');
    const ids = new Set();
    for (const entry of entries) {
        if (!entry || typeof entry !== 'object') throw new Error('Each dependency must be an object');
        if (!['string', 'number'].includes(typeof entry.id) || String(entry.id).trim() === '') {
            throw new Error('Every dependency needs an id');
        }
        if (ids.has(String(entry.id))) throw new Error(`Duplicate dependency id: ${entry.id}`);
        ids.add(String(entry.id));
        for (const key of ['project', 'coordinates', 'currentVersionResource', 'currentVersionExpression']) {
            if (typeof entry[key] !== 'string' || !entry[key].trim()) {
                throw new Error(`Dependency ${entry.id}: ${key} must be a nonempty string`);
            }
        }
        coordinates(entry.coordinates);
        if (!/^language:(xpath|jsonpointer|regex):.+/.test(entry.currentVersionExpression)) {
            throw new Error(`Dependency ${entry.id}: unsupported currentVersionExpression`);
        }
        if (entry.latestVersionFilter !== undefined) {
            if (typeof entry.latestVersionFilter !== 'string') throw new Error(`Dependency ${entry.id}: filter must be a string`);
            try { new RegExp(entry.latestVersionFilter); }
            catch (error) { throw new Error(`Dependency ${entry.id}: invalid version filter: ${error.message}`); }
        }
    }
    return entries;
}

module.exports = {DATA_FILE, APPLATE_ROOT, ROOT_GIT_REPO, RESULTS_FILE, coordinates, loadDependencies};
