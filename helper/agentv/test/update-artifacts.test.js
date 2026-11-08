const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const YAML = require('yaml');
const {replaceVersion, loadReport, planUpdates, applyUpdates, main} = require('../server/update-artifacts');

const selector = key => `language:xpath://*:requiredProperty[@key='${key}']/*:defaultValue/text()`;
const property = (key, version) => `  <requiredProperty key="${key}">\n    <defaultValue>${version}</defaultValue>\n  </requiredProperty>`;
const metadata = properties => `<?xml version="1.0"?>\n<descriptor xmlns="urn:maven">\n<!-- Keep this comment -->\n${properties.join('\n')}\n</descriptor>\n`;
const entry = (id, project, key, current = '3.1.0', latest = '3.2.0') => ({
    id, project, currentVersionResource: project + '/metadata.xml', currentVersionExpression: selector(key),
    coordinates: 'mvn:org.example:' + key, currentVersion: current, latestVersion: latest,
    latestAndGreatestVersion: '4.0.0', latestVersionFilter: '^3\\.', status: 'update-available', error: null
});

async function fixture(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentv-updater-'));
    t.after(() => fs.rm(root, {recursive: true, force: true}));
    const write = async (filename, content) => {
        const file = path.join(root, filename);
        await fs.mkdir(path.dirname(file), {recursive: true});
        await fs.writeFile(file, content);
        return file;
    };
    return {root, write};
}

function prompts(answers) {
    return async () => {
        assert.ok(answers.length, 'Unexpected interactive question');
        return answers.shift();
    };
}
function capture() {
    return {text: '', write(text) { this.text += text.toString(); }};
}

async function reportFixture(t) {
    const fixtureData = await fixture(t);
    const entries = [entry(1, 'project-a', 'compiler'), entry(2, 'project-b', 'compiler')];
    const original = metadata([property('compiler', '3.1.0')]);
    await fixtureData.write('project-a/metadata.xml', original);
    await fixtureData.write('project-b/metadata.xml', original);
    const report = await fixtureData.write('results.yaml', YAML.stringify({checking: false,
        checkedAt: '2026-11-07T16:00:00.000Z', dependencies: entries}));
    return {...fixtureData, entries, original, report};
}

test('updates multiple Maven properties in one file without reformatting XML or changing other defaults', async t => {
    const {root, write} = await fixture(t);
    const original = metadata([property('compiler', '3.1.0'), property('other', '3.1.0'), property('unchanged', '3.1.0')]);
    const file = await write('java-test/metadata.xml', original);
    const plan = await planUpdates([entry(1, 'java-test', 'compiler'), entry(2, 'java-test', 'other')], root);
    assert.equal(plan.changes.length, 2);
    assert.equal(plan.files.length, 1);
    assert.equal(await fs.readFile(file, 'utf8'), original);
    await applyUpdates(plan);
    assert.equal(await fs.readFile(file, 'utf8'), metadata([property('compiler', '3.2.0'), property('other', '3.2.0'), property('unchanged', '3.1.0')]));
    const rerun = await planUpdates([entry(1, 'java-test', 'compiler'), entry(2, 'java-test', 'other')], root);
    assert.equal(rerun.changes.length, 0);
    assert.equal(rerun.current, 2);
});

test('preserves XML namespaces, attribute quotes, indentation and surrounding version whitespace', () => {
    const original = '<m:descriptor xmlns:m="urn:maven">\r\n<m:requiredProperty key=\'compiler\'><m:defaultValue> 3.1.0 </m:defaultValue></m:requiredProperty>\r\n</m:descriptor>\r\n';
    assert.equal(replaceVersion(original, selector('compiler'), '3.2.0'), original.replace(' 3.1.0 ', ' 3.2.0 '));
});

test('npm scoped packages retain range operators and refresh existing lockfiles once', async t => {
    const {root, write} = await fixture(t);
    const file = await write('node-test/package.json', '{\n  "dependencies": {\n    "@scope/pkg": "^1.0.0",\n    "other": "~1.0.0"\n  }\n}\n');
    await write('node-test/package-lock.json', '{}\n');
    const definitions = ['@scope/pkg', 'other'].map((name, i) => ({...entry(i + 1, 'node-test', name),
        coordinates: 'npm:' + name, currentVersion: i ? '~1.0.0' : '^1.0.0', latestVersion: '2.0.0',
        latestVersionFilter: undefined, currentVersionResource: 'node-test/package.json',
        currentVersionExpression: 'language:jsonpointer:/dependencies/' + name.replace(/\//g, '~1')}));
    const plan = await planUpdates(definitions, root);
    assert.equal(plan.changes.length, 2);
    const directories = [];
    await applyUpdates(plan, {updateLockfile: async directory => directories.push(directory)});
    assert.deepEqual(directories, [path.join(root, 'node-test')]);
    assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')).dependencies, {'@scope/pkg': '^2.0.0', other: '~2.0.0'});
});

test('Docker regex updates only its captured tag, without replacing identical unrelated strings', async t => {
    const {root, write} = await fixture(t);
    const original = 'FROM eclipse-temurin:17.0.11_9-jre\nARG EXAMPLE=17.0.11_9-jre\n';
    const file = await write('docker-test/Dockerfile', original);
    const definition = {...entry(1, 'docker-test', 'image'), coordinates: 'docker:library/eclipse-temurin',
        currentVersion: '17.0.11_9-jre', latestVersion: '17.0.21_9-jre', latestVersionFilter: '^17\\..*-jre$',
        currentVersionResource: 'docker-test/Dockerfile', currentVersionExpression: 'language:regex:^FROM eclipse-temurin:([^\\s]+)'};
    const plan = await planUpdates([definition], root);
    await applyUpdates(plan);
    assert.equal(await fs.readFile(file, 'utf8'), 'FROM eclipse-temurin:17.0.21_9-jre\nARG EXAMPLE=17.0.11_9-jre\n');
});

test('skips stale sources, downgrades, failed checks, unstable targets and out-of-filter versions', async t => {
    const {root, write} = await fixture(t);
    await write('java-test/metadata.xml', metadata([property('compiler', '3.1.0')]));
    const definitions = [
        {...entry(1, 'java-test', 'compiler'), currentVersion: '3.0.0'},
        {...entry(2, 'java-test', 'compiler'), latestVersion: '3.0.0'},
        {...entry(3, 'java-test', 'compiler'), error: 'HTTP 429'},
        {...entry(4, 'java-test', 'compiler'), latestVersion: '3.2.0-RC1'},
        {...entry(5, 'java-test', 'compiler'), latestVersion: '4.0.0'}
    ];
    const plan = await planUpdates(definitions, root);
    assert.equal(plan.changes.length, 0);
    assert.equal(plan.current, 1);
    assert.equal(plan.skipped.length, 4);
    assert.match(plan.skipped[0].reason, /changed since/);
    assert.match(plan.skipped[1].reason, /429/);
});

test('prevents writes outside the chosen project, including symlink escapes and remote sources', async t => {
    const {root, write} = await fixture(t);
    await write('project-a/metadata.xml', metadata([property('compiler', '3.1.0')]));
    const other = await write('project-b/metadata.xml', metadata([property('compiler', '3.1.0')]));
    await fs.symlink(other, path.join(root, 'project-a/link.xml'));
    const definitions = [
        {...entry(1, 'project-a', 'compiler'), currentVersionResource: 'project-b/metadata.xml'},
        {...entry(2, 'project-a', 'compiler'), currentVersionResource: 'project-a/link.xml'},
        {...entry(3, '../outside', 'compiler')},
        {...entry(4, 'project-a', 'compiler'), currentVersionResource: 'https://example.test/metadata.xml'}
    ];
    const plan = await planUpdates(definitions, root);
    assert.equal(plan.changes.length, 0);
    assert.equal(plan.skipped.length, 4);
});

test('checks every source for changes after the preview before writing anything', async t => {
    const {root, entries, original, write} = await reportFixture(t);
    const plan = await planUpdates(entries, root);
    await write('project-b/metadata.xml', original + '<!-- Concurrent edit -->');
    await assert.rejects(applyUpdates(plan), /changed after preview/);
    assert.equal(await fs.readFile(path.join(root, 'project-a/metadata.xml'), 'utf8'), original);
});

test('retains the Springdoc compatibility exception and permits a planned Boot 4 upgrade regardless of row order', async t => {
    const {root, write} = await fixture(t);
    await write('java-test/metadata.xml', metadata([property('springdoc', '2.5.0'), property('boot', '3.2.12')]));
    const springdoc = {...entry(1, 'java-test', 'springdoc', '2.5.0', '3.2.0'),
        coordinates: 'mvn:org.springdoc:springdoc-openapi-starter-webmvc-ui'};
    const boot = {...entry(2, 'java-test', 'boot', '3.2.12', '3.2.12'),
        coordinates: 'mvn:org.springframework.boot:spring-boot-dependencies'};
    const blocked = await planUpdates([springdoc, boot], root);
    assert.equal(blocked.changes.length, 0);
    assert.match(blocked.skipped[0].reason, /requires Spring Boot 4/);
    const allowed = await planUpdates([springdoc, {...boot, latestVersion: '4.1.2', latestVersionFilter: '^4\\.'}], root);
    assert.equal(allowed.changes.length, 2);
    assert.equal(allowed.skipped.length, 0);
});

test('interactive selection updates only the chosen project, requires confirmation, and preserves the input report', async t => {
    const {root, report, original} = await reportFixture(t);
    const before = await fs.readFile(report, 'utf8');
    const output = capture();
    const plan = await main({root, args: ['--results', report], output, ask: prompts(['invalid', '1', 'yes'])});
    assert.equal(plan.changes.length, 1);
    assert.match(output.text, /Please choose a listed project/);
    assert.match(output.text, /3.1.0 → 3.2.0/);
    assert.match(await fs.readFile(path.join(root, 'project-a/metadata.xml'), 'utf8'), /3.2.0/);
    assert.equal(await fs.readFile(path.join(root, 'project-b/metadata.xml'), 'utf8'), original);
    assert.equal(await fs.readFile(report, 'utf8'), before);
});

test('dry run, declined confirmation and quit leave project files unchanged', async t => {
    const {root, report, original} = await reportFixture(t);
    for (const [args, answers] of [
        [['--results', report, '--dry-run'], ['a']],
        [['--results', report], ['project-a', 'n']],
        [['--results', report], ['q']]
    ]) await main({root, args, output: capture(), ask: prompts(answers)});
    assert.equal(await fs.readFile(path.join(root, 'project-a/metadata.xml'), 'utf8'), original);
    assert.equal(await fs.readFile(path.join(root, 'project-b/metadata.xml'), 'utf8'), original);
});

test('all-project selection applies both project plans', async t => {
    const {root, report} = await reportFixture(t);
    const plan = await main({root, args: ['--results', report], output: capture(), ask: prompts(['a', 'y'])});
    assert.equal(plan.changes.length, 2);
    for (const project of ['project-a', 'project-b']) assert.match(await fs.readFile(path.join(root, project, 'metadata.xml'), 'utf8'), /3.2.0/);
});

test('rejects incomplete reports, missing selectors and duplicate IDs before prompting', async t => {
    const {write} = await fixture(t);
    for (const report of [{checking: true, dependencies: [entry(1, 'java-test', 'compiler')]},
        {dependencies: [entry(1, 'java-test', 'compiler'), entry(1, 'java-test', 'compiler')]},
        {dependencies: [{...entry(1, 'java-test', 'compiler'), currentVersionExpression: ''}]}]) {
        const filename = await write('invalid.yaml', YAML.stringify(report));
        await assert.rejects(loadReport(filename));
    }
});
