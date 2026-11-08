const fs = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {createInterface} = require('node:readline/promises');
const {parseArgs} = require('node:util');
const YAML = require('yaml');
const {APPLATE_ROOT, coordinates} = require('./tracker/config');
const {extractVersion} = require('./tracker/source');
const {selectLatest, versionStatus} = require('./tracker/versions');

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function replaceVersion(content, expression, target) {
    if (expression.startsWith('language:xpath:')) {
        const key = /requiredProperty\[@key=(['"])([^'"]+)\1\]/.exec(expression)?.[2];
        if (!key || !expression.includes('defaultValue')) throw new Error('Only requiredProperty/defaultValue XPath updates are supported');
        const prefix = '(?:[\\w.-]+:)?';
        const property = new RegExp(`(<${prefix}requiredProperty\\b[^>]*\\bkey\\s*=\\s*(['"])${escapeRegex(key)}\\2[^>]*>)([\\s\\S]*?)(</${prefix}requiredProperty\\s*>)`, 'g');
        const value = new RegExp(`(<${prefix}defaultValue\\b[^>]*>)([^<]*)(</${prefix}defaultValue\\s*>)`, 'g');
        let count = 0;
        const escaped = target.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        content = content.replace(property, (match, open, quote, body, close) => {
            return open + body.replace(value, (match, start, current, end) => {
                count++;
                return start + current.replace(/\S(?:[\s\S]*\S)?/, () => escaped) + end;
            }) + close;
        });
        if (count !== 1) throw new Error('Expected exactly one defaultValue to update');
    } else if (expression.startsWith('language:jsonpointer:')) {
        const keys = expression.slice('language:jsonpointer:'.length + 1).split('/')
            .map(key => key.replace(/~1/g, '/').replace(/~0/g, '~'));
        const data = JSON.parse(content);
        let parent = data;
        for (const key of keys.slice(0, -1)) {
            if (!parent || !Object.hasOwn(parent, key)) throw new Error('JSON pointer does not exist');
            parent = parent[key];
        }
        const key = keys.at(-1);
        if (!parent || !Object.hasOwn(parent, key) || typeof parent[key] !== 'string') throw new Error('JSON pointer must identify a version string');
        // Preserve the usual npm range operator when updating its release line.
        parent[key] = (parent[key].trim().match(/^[~^]/)?.[0] || '') + target;
        const indent = content.match(/^[\t ]+(?=")/m)?.[0] || 2;
        const newline = content.includes('\r\n') ? '\r\n' : '\n';
        content = JSON.stringify(data, null, indent).replace(/\n/g, newline) + (/\r?\n$/.test(content) ? newline : '');
    } else if (expression.startsWith('language:regex:')) {
        const match = new RegExp(expression.slice('language:regex:'.length), 'md').exec(content);
        if (!match?.indices[1]) throw new Error('Regex must capture the current version');
        const [start, end] = match.indices[1];
        content = content.slice(0, start) + target + content.slice(end);
    } else {
        throw new Error('Unsupported version expression');
    }
    return content;
}

function within(parent, filename) {
    const relative = path.relative(parent, filename);
    return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

async function loadReport(filename) {
    const report = YAML.parse(await fs.readFile(filename, 'utf8'));
    if (!report || report.checking || !Array.isArray(report.dependencies) || !report.dependencies.length) {
        throw new Error('Results must contain a completed dependency report');
    }
    const ids = new Set();
    for (const entry of report.dependencies) {
        if (!entry || !['string', 'number'].includes(typeof entry.id) || ids.has(String(entry.id))) throw new Error('Results contain missing or duplicate dependency IDs');
        ids.add(String(entry.id));
        for (const key of ['project', 'coordinates', 'currentVersionResource', 'currentVersionExpression']) {
            if (typeof entry[key] !== 'string' || !entry[key].trim()) throw new Error(`Dependency ${entry.id} has no ${key}`);
        }
    }
    return report;
}

async function planUpdates(entries, root) {
    root = await fs.realpath(root);
    const files = new Map();
    const changes = [];
    const skipped = [];
    let current = 0;
    const read = async entry => {
        if (/^[a-z][\w+.-]*:/i.test(entry.currentVersionResource)) throw new Error('Only local source files can be updated');
        const project = path.resolve(root, entry.project);
        if (!within(root, project)) throw new Error('Project is outside the applate checkout');
        const filename = await fs.realpath(path.resolve(root, entry.currentVersionResource));
        if (!within(project, filename)) throw new Error('Source must be inside its project directory');
        if (!files.has(filename)) {
            const original = await fs.readFile(filename, 'utf8');
            files.set(filename, {filename, original, content: original, mode: (await fs.stat(filename)).mode});
        }
        return files.get(filename);
    };

    // Plan the Boot upgrade first so Springdoc compatibility uses the resulting
    // version even when report entries are in another order.
    const isBoot = entry => entry.coordinates === 'mvn:org.springframework.boot:spring-boot-dependencies';
    for (const entry of [...entries].sort((a, b) => Number(isBoot(b)) - Number(isBoot(a)))) {
        try {
            if (entry.error || entry.status === 'error') throw new Error(entry.error || 'Saved check failed; refresh the report');
            if (typeof entry.latestVersion !== 'string' || !entry.latestVersion.trim()) throw new Error('No latest matching version in the report');
            const {ecosystem} = coordinates(entry.coordinates);
            const file = await read(entry);
            const actual = extractVersion(file.content, entry.currentVersionExpression);
            const status = versionStatus(actual, entry.latestVersion, ecosystem);
            if (status === 'up-to-date' || status === 'ahead') { current++; continue; }
            if (actual !== entry.currentVersion) throw new Error(`Source changed since the check (${entry.currentVersion} → ${actual}); refresh the report`);
            if (selectLatest([entry.latestVersion], entry, ecosystem, actual) !== entry.latestVersion) throw new Error('Target is not a stable version matching the filter and variant');
            // Springdoc 3 requires Boot 4; retain the compatibility exception used
            // for the earlier project update: https://springdoc.org/v2/
            if (entry.coordinates === 'mvn:org.springdoc:springdoc-openapi-starter-webmvc-ui' && /^3\./.test(entry.latestVersion)) {
                const boot = entries.find(candidate => candidate.project === entry.project
                    && candidate.coordinates === 'mvn:org.springframework.boot:spring-boot-dependencies');
                if (boot) {
                    const bootFile = await read(boot);
                    const bootVersion = extractVersion(bootFile.content, boot.currentVersionExpression);
                    if (!/^4\./.test(bootVersion)) throw new Error(`Springdoc 3.x requires Spring Boot 4; project uses ${bootVersion}`);
                }
            }
            const content = replaceVersion(file.content, entry.currentVersionExpression, entry.latestVersion);
            const updated = extractVersion(content, entry.currentVersionExpression);
            if (versionStatus(updated, entry.latestVersion, ecosystem) !== 'up-to-date') throw new Error('Updated value failed verification');
            file.content = content;
            changes.push({project: entry.project, artifact: entry.coordinates, from: actual, to: updated, file: file.filename});
        } catch (error) {
            skipped.push({project: entry.project, artifact: entry.coordinates, reason: error.message});
        }
    }
    return {root, files: [...files.values()].filter(file => file.content !== file.original), changes, skipped, current};
}

async function refreshLockfile(directory, output) {
    await new Promise((resolve, reject) => {
        const child = spawn('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], {cwd: directory});
        child.stdout.on('data', chunk => output.write(chunk));
        child.stderr.on('data', chunk => output.write(chunk));
        child.on('error', reject);
        child.on('close', code => code === 0 ? resolve() : reject(new Error(`npm lockfile refresh failed in ${directory} (exit ${code}); source updates were applied`)));
    });
}

async function lockfileDirectories(plan) {
    const directories = [];
    for (const file of plan.files) {
        if (path.basename(file.filename) !== 'package.json') continue;
        const directory = path.dirname(file.filename);
        for (const name of ['npm-shrinkwrap.json', 'package-lock.json']) {
            try {
                const filename = await fs.realpath(path.join(directory, name));
                if (!within(plan.root, filename)) throw new Error('Lockfile is outside the applate checkout');
                directories.push(directory);
                break;
            } catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
    }
    return directories;
}

async function applyUpdates(plan, {output = process.stdout, updateLockfile = refreshLockfile} = {}) {
    const lockfiles = await lockfileDirectories(plan);
    // Check every source before writing any file so edits made during the prompt
    // cannot silently overwrite another change.
    for (const file of plan.files) {
        if (await fs.realpath(file.filename) !== file.filename || await fs.readFile(file.filename, 'utf8') !== file.original) {
            throw new Error(`Source changed after preview; no updates applied: ${file.filename}`);
        }
    }
    for (const file of plan.files) {
        const temporary = `${file.filename}.agentv-${process.pid}.tmp`;
        let created = false;
        try {
            await fs.writeFile(temporary, file.content, {flag: 'wx', mode: file.mode});
            created = true;
            await fs.rename(temporary, file.filename);
        } finally {
            if (created) await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
        }
    }
    for (const directory of lockfiles) await updateLockfile(directory, output);
}

async function main({root = APPLATE_ROOT, args = process.argv.slice(2), input = process.stdin, output = process.stdout,
    ask: suppliedAsk, updateLockfile} = {}) {
    const {values} = parseArgs({args, options: {
        results: {type: 'string'}, root: {type: 'string'}, 'dry-run': {type: 'boolean'}, help: {type: 'boolean', short: 'h'}
    }});
    if (values.help) {
        output.write('Usage: node helper/scripts/update-artifacts.js [--results FILE] [--root APPLATE_ROOT] [--dry-run]\n'
            + 'Choose a project (or all), preview its latest matching version updates, then confirm.\n');
        return;
    }
    root = path.resolve(values.root || process.env.APPLATE_ROOT || root);
    const filename = path.resolve(values.results || process.env.RESULTS_FILE || path.join(root, 'helper/agentv/data/results.yaml'));
    const report = await loadReport(filename);
    const projects = [...new Set(report.dependencies.map(entry => entry.project))].sort();
    output.write(`Results: ${filename}\nLast checked: ${report.checkedAt || 'unknown'}\n\n`);
    projects.forEach((project, index) => output.write(`  ${index + 1}) ${project}\n`));
    output.write('  a) All projects\n  q) Quit\n\n');
    const readline = suppliedAsk ? null : createInterface({input, output});
    const ask = suppliedAsk || (question => readline.question(question));
    try {
        let selected;
        while (!selected) {
            const answer = (await ask('Choose a project (number, name, a, or q): ')).trim();
            if (/^(q|quit)$/i.test(answer)) { output.write('Cancelled.\n'); return; }
            if (/^(a|all)$/i.test(answer)) selected = projects;
            else if (projects.includes(answer)) selected = [answer];
            else if (/^\d+$/.test(answer) && projects[Number(answer) - 1]) selected = [projects[Number(answer) - 1]];
            else output.write('Please choose a listed project.\n');
        }
        const plan = await planUpdates(report.dependencies.filter(entry => selected.includes(entry.project)), root);
        output.write('\nLatest matching updates:\n');
        plan.changes.forEach(change => output.write(`  ${change.project} | ${change.artifact} | ${change.from} → ${change.to}\n`));
        plan.skipped.forEach(entry => output.write(`  Skipped ${entry.project} | ${entry.artifact}: ${entry.reason}\n`));
        output.write(`${plan.changes.length} updates, ${plan.current} already current/ahead, ${plan.skipped.length} skipped.\n`);
        if (!plan.changes.length) return plan;
        const directories = await lockfileDirectories(plan);
        if (directories.length) output.write('Existing npm lockfiles will be refreshed with npm install --package-lock-only --ignore-scripts (may access the registry).\n');
        if (values['dry-run']) { output.write('Dry run: no files changed.\n'); return plan; }
        if (!/^y(es)?$/i.test((await ask('Apply these updates? [y/N] ')).trim())) { output.write('Cancelled. No files changed.\n'); return plan; }
        await applyUpdates(plan, {output, updateLockfile});
        output.write(`Applied ${plan.changes.length} updates in ${plan.files.length} files.\nRun npm run check in helper/agentv to refresh the report.\n`);
        return plan;
    } finally {
        readline?.close();
    }
}

module.exports = {replaceVersion, loadReport, planUpdates, applyUpdates, main};
