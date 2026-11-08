const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const YAML = require('yaml');
const {once} = require('node:events');
const {WebSocket} = require('ws');
const {extractVersion, createSourceReader} = require('../server/tracker/source');
const {selectLatest, versionStatus} = require('../server/tracker/versions');
const {EcosystemsClient} = require('../server/tracker/ecosystems');
const {loadDependencies, coordinates} = require('../server/tracker/config');
const {Tracker} = require('../server/tracker/tracker');
const {createServer} = require('../server/server');

const entry = {id: 1, project: 'example', coordinates: 'mvn:org.test:example',
    currentVersionResource: 'metadata.xml',
    currentVersionExpression: "language:xpath://*:requiredProperty[@key='version']/*:defaultValue/text()",
    latestVersionFilter: '^3\\.'};
const xml = '<descriptor xmlns="urn:maven"><requiredProperty key="version"><defaultValue>3.9.0</defaultValue></requiredProperty></descriptor>';

test('extracts the original Camel XPath with namespaces, and rejects missing/ambiguous values', () => {
    assert.equal(extractVersion(xml, entry.currentVersionExpression), '3.9.0');
    assert.throws(() => extractVersion('<root/>', entry.currentVersionExpression), /exactly one/);
    assert.throws(() => extractVersion(xml.replace('</descriptor>', xml + '</descriptor>'), entry.currentVersionExpression), /exactly one/);
    assert.throws(() => extractVersion('<root><broken></root>', entry.currentVersionExpression));
});

test('JSON pointer supports scoped npm package names; regex captures image tags', () => {
    assert.equal(extractVersion('{"dependencies":{"@scope/pkg":"^2.1.0"}}',
        'language:jsonpointer:/dependencies/@scope~1pkg'), '^2.1.0');
    assert.equal(extractVersion('FROM node:22.1.0\n', 'language:regex:^FROM node:([^\\s]+)'), '22.1.0');
    assert.throws(() => extractVersion('{}', 'language:jsonpointer:/dependencies/absent'), /no string/);
});

test('source content is fetched once for dependencies sharing a resource', async () => {
    let calls = 0;
    const read = createSourceReader({fetchImpl: async () => { calls++; return new Response(xml); }});
    const remote = {...entry, currentVersionResource: 'https://example.test/metadata.xml'};
    assert.deepEqual(await Promise.all([read(remote), read(remote)]), ['3.9.0', '3.9.0']);
    assert.equal(calls, 1);
});

test('selects the highest numeric Maven release in the maintained line, excluding prereleases', () => {
    const versions = ['3.9.0', '3.10.0', '4.1.0', '3.99.0-RC1', '3.20.0-SNAPSHOT', '3.11.0.Final'];
    assert.equal(selectLatest(versions, entry, 'mvn', '3.9.0'), '3.11.0.Final');
    assert.equal(versionStatus('3.9.0', '3.10.0', 'mvn'), 'update-available');
    assert.equal(versionStatus('3.10', '3.10.0', 'mvn'), 'up-to-date');
    assert.equal(versionStatus('3.11.0', '3.10.0', 'mvn'), 'ahead');
    assert.equal(selectLatest(versions, {latestVersionFilter: '^2\\.'}, 'mvn', '2.0'), null);
});

test('orders Docker build numbers and preserves the JRE/OS variant', () => {
    const config = {latestVersionFilter: '^17\\..*-jre$'};
    const versions = ['latest', '17.0.9_9-jre', '17.0.11_9-jre', '17.0.11_10-jre',
        '17.0.99_1-jre-alpine', '25.0.2_1-jre', '17.0.12_1-ea-jre'];
    assert.equal(selectLatest(versions, config, 'docker', '17.0.11_9-jre'), '17.0.11_10-jre');
    assert.equal(versionStatus('17.0.11_9-jre', '17.0.11_10-jre', 'docker'), 'update-available');
    assert.throws(() => versionStatus('lts', '25.0.0', 'docker'), /Cannot compare/);
});

test('latest and greatest ignores release filters and Docker variants, while excluding prereleases', () => {
    const options = {ignoreFilter: true};
    assert.equal(selectLatest(['3.9.0', '4.2.0', '5.0.0-RC1'], entry, 'mvn', '3.9.0', options), '4.2.0');
    assert.equal(selectLatest(['1.9.0', '2.0.0', '3.0.0-beta.1'], {latestVersionFilter: '^1\\.'},
        'npm', '1.9.0', options), '2.0.0');
    assert.equal(selectLatest(['17.0.11_9-jre', '25.0.3_9-jdk', '26.0.0-ea-jdk', 'latest'],
        {latestVersionFilter: '^17\\..*-jre$'}, 'docker', '17.0.11_9-jre', options), '25.0.3_9-jdk');
});

test('npm uses semantic versions, rejects prereleases, and understands declared ranges', () => {
    assert.equal(selectLatest(['1.9.0', '1.10.0', '2.0.0-beta.1', 'latest'], {}, 'npm', '1.9.0'), '1.10.0');
    assert.equal(versionStatus('1.9.0', '1.10.0', 'npm'), 'update-available');
    assert.equal(versionStatus('^1.9.0', '1.10.0', 'npm'), 'up-to-date');
    assert.equal(versionStatus('^1.9.0', '2.0.0', 'npm'), 'update-available');
    assert.throws(() => versionStatus('workspace:*', '1.0.0', 'npm'), /Cannot compare/);
});

test('ecosyste.ms encodes coordinates, consumes the full version list, and caches shared requests', async () => {
    let calls = 0;
    const client = new EcosystemsClient({fetchImpl: async url => {
        calls++;
        assert.match(String(url), /packages\/%40scope%2Fpkg\/version_numbers$/);
        return Response.json(['1.0.0', '2.0.0']);
    }});
    const values = await Promise.all([client.versions('npm:@scope/pkg'), client.versions('npm:@scope/pkg')]);
    assert.deepEqual(values[0], ['1.0.0', '2.0.0']);
    assert.equal(calls, 1);
    assert.deepEqual(coordinates('docker:library/eclipse-temurin:17.'),
        {ecosystem: 'docker', registry: 'hub.docker.com', name: 'library/eclipse-temurin'});
    assert.equal(coordinates('mvn:org.test:example').name, 'org.test:example');
});

test('HTTP 429 stops further package calls in the same run and reports Retry-After', async () => {
    let calls = 0;
    const client = new EcosystemsClient({fetchImpl: async () => {
        calls++;
        return new Response('', {status: 429, headers: {'Retry-After': '60'}});
    }});
    await assert.rejects(client.versions('npm:first'), /429.*retry after 60/);
    await assert.rejects(client.versions('npm:second'), /429/);
    assert.equal(calls, 1);
});

test('reports missing packages and invalid upstream responses', async () => {
    await assert.rejects(new EcosystemsClient({fetchImpl: async () => new Response('', {status: 404})})
        .versions(entry.coordinates), /HTTP 404/);
    await assert.rejects(new EcosystemsClient({fetchImpl: async () => Response.json({versions: []})})
        .versions(entry.coordinates), /Unexpected version response/);
});

test('loads YAML and rejects duplicate IDs, bad filters and unsupported coordinates', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentv-config-'));
    t.after(() => fs.rm(dir, {recursive: true, force: true}));
    const file = path.join(dir, 'dependencies.yaml');
    for (const [data, pattern] of [
        [[entry, {...entry}], /Duplicate/],
        [[{...entry, latestVersionFilter: '['}], /invalid version filter/],
        [[{...entry, coordinates: 'other:thing'}], /Unsupported coordinates/]
    ]) {
        await fs.writeFile(file, YAML.stringify(data));
        await assert.rejects(loadDependencies(file), pattern);
    }
});

function fakeTracker(options = {}) {
    return new Tracker({load: async () => [entry, {...entry, id: 2}, {...entry, id: 3}],
        sourceReader: () => async dependency => {
            if (dependency.id === 3) throw new Error('Source missing');
            return '3.9.0';
        }, clientFactory: () => ({versions: async () => ['3.10.0']}), resultsFile: null, ...options});
}

test('startup restores saved versions, statuses and timestamps without source or API requests', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentv-startup-'));
    t.after(() => fs.rm(dir, {recursive: true, force: true}));
    const file = path.join(dir, 'results.yaml');
    const saved = await fakeTracker({resultsFile: file}).check();
    await fs.writeFile(file, YAML.stringify({...saved, checking: true, summary: {updates: 999}}));
    const tracker = fakeTracker({resultsFile: file,
        sourceReader: () => async () => { throw new Error('Unexpected source request'); },
        clientFactory: () => { throw new Error('Unexpected API request'); }});
    const restored = await tracker.initialize();
    assert.deepEqual(restored.dependencies, saved.dependencies);
    assert.equal(restored.checkedAt, saved.checkedAt);
    assert.equal(restored.checking, false);
    assert.deepEqual(restored.summary, saved.summary);
});

test('startup restores only matching configuration, omitting removed entries and reading new or changed ones', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentv-startup-config-'));
    t.after(() => fs.rm(dir, {recursive: true, force: true}));
    const file = path.join(dir, 'results.yaml');
    await fakeTracker({resultsFile: file}).check();
    const definitions = [entry, {...entry, id: 2, latestVersionFilter: '^4\\.'}, {...entry, id: 4}];
    const reads = [];
    const tracker = fakeTracker({resultsFile: file, load: async () => definitions,
        sourceReader: () => async dependency => { reads.push(dependency.id); return '3.10.0'; }});
    const result = await tracker.initialize();
    assert.deepEqual(result.dependencies.map(dependency => dependency.id), [1, 2, 4]);
    assert.deepEqual(reads, [2, 4]);
    assert.equal(result.dependencies[0].status, 'update-available');
    assert.equal(result.dependencies[1].status, 'unchecked');
    assert.equal(result.dependencies[1].currentVersion, '3.10.0');
    assert.equal(result.dependencies[1].latestVersion, null);
    assert.equal(result.dependencies[2].status, 'unchecked');
    assert.equal(result.summary.updates, 1);
    assert.equal(result.summary.unchecked, 2);
});

test('missing or malformed saved reports do not prevent startup', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentv-startup-invalid-'));
    t.after(() => fs.rm(dir, {recursive: true, force: true}));
    const file = path.join(dir, 'results.yaml');
    for (const content of [null, 'dependencies: [', 'dependencies: invalid']) {
        if (content !== null) await fs.writeFile(file, content);
        const result = await fakeTracker({resultsFile: file}).initialize();
        assert.equal(result.dependencies[0].status, 'unchecked');
        assert.equal(result.dependencies[0].currentVersion, '3.9.0');
        assert.equal(result.dependencies[2].status, 'error');
        assert.equal(result.checkedAt, null);
        assert.equal(result.checking, false);
    }
});

test('invalid cached dependency statuses fall back to reading current source versions', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentv-startup-row-'));
    t.after(() => fs.rm(dir, {recursive: true, force: true}));
    const file = path.join(dir, 'results.yaml');
    const saved = await fakeTracker({resultsFile: file}).check();
    saved.dependencies[0].status = 'invalid-status';
    saved.dependencies.push(null);
    await fs.writeFile(file, YAML.stringify(saved));
    const result = await fakeTracker({resultsFile: file}).initialize();
    assert.equal(result.dependencies[0].status, 'unchecked');
    assert.equal(result.dependencies[0].latestVersion, null);
    assert.equal(result.dependencies[1].status, 'update-available');
    assert.equal(result.dependencies[2].error, 'Source missing');
});

test('concurrent checks share a run, isolate source failures, and write a YAML report', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentv-results-'));
    t.after(() => fs.rm(dir, {recursive: true, force: true}));
    const file = path.join(dir, 'results.yaml');
    let runs = 0;
    const tracker = fakeTracker({resultsFile: file,
        clientFactory: () => { runs++; return {versions: async () => ['3.10.0']}; }});
    const first = tracker.check();
    assert.equal(tracker.check(), first);
    const result = await first;
    assert.equal(runs, 1);
    assert.equal(result.checking, false);
    assert.equal(result.summary.updates, 2);
    assert.equal(result.summary.errors, 1);
    assert.equal(YAML.parse(await fs.readFile(file, 'utf8')).dependencies[0].latestVersion, '3.10.0');
    assert.equal(YAML.parse(await fs.readFile(file, 'utf8')).dependencies[0].latestAndGreatestVersion, '3.10.0');
    await tracker.check();
    assert.equal(runs, 2);
});

test('overall status and summary compare against latest and greatest when the filtered line is current', async () => {
    const tracker = fakeTracker({load: async () => [entry],
        clientFactory: () => ({versions: async () => ['3.9.0', '4.2.0', '5.0.0-RC1']})});
    const result = await tracker.check();
    const dependency = result.dependencies[0];
    assert.equal(dependency.latestVersion, '3.9.0');
    assert.equal(dependency.matchingStatus, 'up-to-date');
    assert.equal(dependency.latestAndGreatestVersion, '4.2.0');
    assert.equal(dependency.status, 'update-available');
    assert.equal(result.summary.updates, 1);
    assert.equal(result.summary.current, 0);
});

test('a filter with no matching releases still permits the latest and greatest comparison', async () => {
    const tracker = fakeTracker({load: async () => [{...entry, latestVersionFilter: '^2\\.'}],
        clientFactory: () => ({versions: async () => ['4.2.0']})});
    const result = await tracker.check();
    assert.equal(result.dependencies[0].latestVersion, null);
    assert.equal(result.dependencies[0].matchingStatus, 'no-matching-version');
    assert.equal(result.dependencies[0].latestAndGreatestVersion, '4.2.0');
    assert.equal(result.dependencies[0].status, 'update-available');
});

test('configuration failure retains displayed data and permits a subsequent run', async () => {
    let fail = false;
    const tracker = fakeTracker({load: async () => {
        if (fail) throw new Error('Invalid YAML');
        return [entry];
    }});
    await tracker.initialize();
    fail = true;
    await assert.rejects(tracker.check(), /Invalid YAML/);
    assert.equal(tracker.snapshot().dependencies.length, 1);
    assert.equal(tracker.snapshot().checking, false);
    fail = false;
    assert.equal((await tracker.check()).summary.updates, 1);
});

test('HTTP API and WebSocket deliver check results using the existing Express template', async t => {
    const {server, wss} = await createServer({tracker: fakeTracker()});
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(async () => {
        wss.clients.forEach(client => client.terminate());
        wss.close();
        await new Promise(resolve => server.close(resolve));
    });
    const base = 'http://127.0.0.1:' + server.address().port;
    const state = await (await fetch(base + '/api/dependencies')).json();
    assert.equal(state.dependencies[0].currentVersion, '3.9.0');
    assert.equal(state.dependencies[0].status, 'unchecked');
    const socket = new WebSocket(base.replace('http:', 'ws:') + '/websocket');
    const initial = JSON.parse((await once(socket, 'message'))[0].toString());
    assert.equal(initial.metadata.type, 'dependencies');
    const messages = [];
    socket.on('message', message => messages.push(JSON.parse(message.toString())));
    const response = await fetch(base + '/api/check', {method: 'POST'});
    assert.equal(response.status, 200);
    assert.equal((await response.json()).summary.updates, 2);
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(messages.some(message => !message.data.checking && message.data.checkedAt));
    assert.match(await (await fetch(base + '/')).text(), /Applate dependencies/);
    assert.equal((await fetch(base + '/api/config.yaml')).status, 200);
    const docs = await (await fetch(base + '/v3/api-docs')).json();
    assert.ok(docs.paths['/api/check']);
    socket.close();
});
