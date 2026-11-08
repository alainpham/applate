const fs = require('node:fs/promises');
const path = require('node:path');
const YAML = require('yaml');
const {loadDependencies, coordinates, RESULTS_FILE} = require('./config');
const {createSourceReader} = require('./source');
const {EcosystemsClient} = require('./ecosystems');
const {selectLatest, versionStatus} = require('./versions');
const logger = require('../logger');

const RESULT_FIELDS = ['currentVersion', 'latestVersion', 'latestAndGreatestVersion', 'matchingStatus', 'status', 'error', 'checkedAt'];
const CONFIG_FIELDS = ['project', 'coordinates', 'currentVersionResource', 'currentVersionExpression', 'latestVersionFilter'];
const STATUSES = new Set(['unchecked', 'update-available', 'up-to-date', 'ahead', 'no-matching-version', 'error']);

function validSavedResult(result) {
    return result && STATUSES.has(result.status) && STATUSES.has(result.matchingStatus)
        && ['currentVersion', 'latestVersion', 'latestAndGreatestVersion', 'error']
            .every(key => result[key] === null || typeof result[key] === 'string')
        && typeof result.checkedAt === 'string' && Number.isFinite(Date.parse(result.checkedAt));
}

class Tracker {
    constructor({load = loadDependencies, sourceReader = createSourceReader,
        clientFactory = () => new EcosystemsClient(), resultsFile = RESULTS_FILE,
        onChange = () => {}} = {}) {
        Object.assign(this, {load, sourceReader, clientFactory, resultsFile, onChange});
        this.state = {checking: false, checkedAt: null, dependencies: []};
        this.running = null;
    }

    async initialize() {
        const entries = await this.load();
        const saved = await this.loadResults();
        const read = this.sourceReader();
        const sourceRoot = read.sourceRoot || null;
        // Legacy reports came from local checkouts. Never restore their current
        // versions when switching to a remote repository or a different source.
        const sameSource = saved && (saved.sourceRoot === sourceRoot
            || (saved.sourceRoot === undefined && !read.isRemote));
        const previous = new Map((sameSource ? saved.dependencies : [])
            .filter(validSavedResult).map(result => [String(result.id), result]));
        const dependencies = await Promise.all(entries.map(async entry => {
            const cached = previous.get(String(entry.id));
            if (cached && CONFIG_FIELDS.every(key => cached[key] === entry[key])) {
                return {...entry, ...Object.fromEntries(RESULT_FIELDS.map(key => [key, cached[key]]))};
            }
            const result = {...entry, currentVersion: null, latestVersion: null, latestAndGreatestVersion: null,
                matchingStatus: 'unchecked', status: 'unchecked', error: null};
            try { return {...result, currentVersion: await read(entry)}; }
            catch (error) { return {...result, status: 'error', error: error.message}; }
        }));
        this.state = {checking: false, checkedAt: sameSource ? saved.checkedAt : null, sourceRoot, dependencies};
        return this.snapshot();
    }

    async loadResults() {
        if (!this.resultsFile) return null;
        try {
            const saved = YAML.parse(await fs.readFile(this.resultsFile, 'utf8'));
            if (!saved || !Array.isArray(saved.dependencies) || typeof saved.checkedAt !== 'string'
                || !Number.isFinite(Date.parse(saved.checkedAt))) {
                throw new Error('Invalid results report');
            }
            return saved;
        } catch (error) {
            if (error.code !== 'ENOENT') logger.warn({err: error, file: this.resultsFile}, 'Unable to restore saved results; reading current versions');
            return null;
        }
    }

    snapshot() {
        const summary = {total: this.state.dependencies.length, updates: 0, errors: 0, current: 0, unchecked: 0};
        for (const dependency of this.state.dependencies) {
            if (dependency.status === 'update-available') summary.updates++;
            else if (['error', 'no-matching-version'].includes(dependency.status)) summary.errors++;
            else if (dependency.status === 'unchecked') summary.unchecked++;
            else summary.current++;
        }
        return {...this.state, summary};
    }

    check() {
        if (this.running) return this.running;
        this.running = this.run().finally(() => { this.running = null; });
        return this.running;
    }

    async run() {
        // Validate the full config before replacing any displayed results.
        const entries = await this.load();
        const read = this.sourceReader();
        const client = this.clientFactory();
        this.state = {checking: true, checkedAt: null, sourceRoot: read.sourceRoot || null, dependencies: entries.map(entry => ({
            ...entry, currentVersion: null, latestVersion: null, latestAndGreatestVersion: null,
            matchingStatus: 'unchecked', status: 'unchecked', error: null
        }))};
        this.onChange(this.snapshot());
        try {
            // Serial requests keep traffic modest; the client shares repeated package lookups.
            for (const dependency of this.state.dependencies) {
                try {
                    dependency.currentVersion = await read(dependency);
                    const {ecosystem} = coordinates(dependency.coordinates);
                    const versions = await client.versions(dependency.coordinates);
                    dependency.latestVersion = selectLatest(versions, dependency, ecosystem, dependency.currentVersion);
                    dependency.latestAndGreatestVersion = selectLatest(versions, dependency, ecosystem, dependency.currentVersion, {ignoreFilter: true});
                    dependency.matchingStatus = dependency.latestVersion
                        ? versionStatus(dependency.currentVersion, dependency.latestVersion, ecosystem)
                        : 'no-matching-version';
                    if (!dependency.latestAndGreatestVersion) {
                        dependency.status = 'no-matching-version';
                        dependency.error = 'No stable version is available';
                    } else {
                        dependency.status = versionStatus(dependency.currentVersion, dependency.latestAndGreatestVersion, ecosystem);
                    }
                } catch (error) {
                    dependency.status = 'error';
                    dependency.error = error.message;
                }
                dependency.checkedAt = new Date().toISOString();
                this.onChange(this.snapshot());
            }
            this.state.checkedAt = new Date().toISOString();
            this.state.checking = false;
            if (this.resultsFile) {
                await fs.mkdir(path.dirname(this.resultsFile), {recursive: true});
                const temporary = `${this.resultsFile}.${process.pid}.tmp`;
                await fs.writeFile(temporary, YAML.stringify(this.snapshot()), 'utf8');
                await fs.rename(temporary, this.resultsFile);
            }
            return this.snapshot();
        } finally {
            this.state.checking = false;
            this.onChange(this.snapshot());
        }
    }
}

module.exports = {Tracker};
