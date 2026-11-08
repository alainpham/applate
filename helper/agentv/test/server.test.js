const {test} = require('node:test');
const assert = require('node:assert/strict');
const {once} = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {createServer} = require('../server/server');
const {name, version} = require('../package.json');

const snapshot = {
    checking: false,
    checkedAt: null,
    dependencies: [],
    summary: {total: 0, updates: 0, errors: 0, current: 0, unchecked: 0}
};

function stubTracker(overrides = {}) {
    return {
        initialize: async () => snapshot,
        snapshot: () => snapshot,
        check: async () => snapshot,
        ...overrides
    };
}

async function startServer(t, options) {
    const {server, wss} = await createServer(options);
    t.after(async () => {
        wss.clients.forEach(client => client.terminate());
        wss.close();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    });
    assert.equal(server.listening, false);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return 'http://127.0.0.1:' + server.address().port;
}

test('Swagger discovers technical and business routes and serves its assets outside public', async t => {
    const base = await startServer(t, {tracker: stubTracker()});
    const response = await fetch(base + '/v3/api-docs');
    assert.equal(response.status, 200);
    const docs = await response.json();
    assert.equal(docs.info.title, process.env.APP_NAME || name);
    assert.equal(docs.info.version, version);
    assert.deepEqual(Object.keys(docs.paths).sort(), [
        '/api/check', '/api/config.yaml', '/api/dependencies', '/ping', '/uiconfig'
    ]);
    assert.equal(docs.paths['/api/check'].post.responses['200'].content['application/json'].schema.$ref,
        '#/components/schemas/TrackerSnapshot');
    assert.equal(docs.paths['/api/check'].post.responses['500'].content['application/json'].schema.$ref,
        '#/components/schemas/Error');
    assert.equal(docs.components.schemas.TrackerSnapshot.properties.dependencies.type, 'array');

    const html = await fetch(base + '/swagger-ui.html');
    assert.equal(html.status, 200);
    assert.match(await html.text(), /src="\/swagger-ui\/initializer.js"/);
    for (const asset of ['initializer.js', 'swagger-ui-bundle.js', 'swagger-ui.css']) {
        const result = await fetch(base + '/swagger-ui/' + asset);
        assert.equal(result.status, 200, asset);
        await result.arrayBuffer();
    }
    const config = await (await fetch(base + '/uiconfig')).json();
    assert.equal(config.name, process.env.APP_NAME || name);
    assert.equal(typeof config.theme, 'string');
    assert.equal((await fetch(base + '/api/dependencies')).headers.get('cache-control'), 'no-store');
});

test('business routes download injected configuration and pass asynchronous failures to the server', async t => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentv-services-'));
    t.after(() => fs.rm(directory, {recursive: true, force: true}));
    const dataFile = path.join(directory, 'custom.yaml');
    const config = '- id: 42\n  project: injected\n';
    await fs.writeFile(dataFile, config);
    let checks = 0;
    const tracker = stubTracker({check: async () => {
        checks++;
        throw new Error('Unable to save report');
    }});
    const base = await startServer(t, {tracker, dataFile});
    const downloaded = await fetch(base + '/api/config.yaml');
    assert.equal(downloaded.status, 200);
    assert.match(downloaded.headers.get('content-disposition'), /attachment; filename="?dependencies\.yaml"?/);
    assert.equal(await downloaded.text(), config);

    const failed = await fetch(base + '/api/check', {method: 'POST'});
    assert.equal(failed.status, 500);
    assert.deepEqual(await failed.json(), {error: 'Unable to save report'});
    assert.equal(checks, 1);
    assert.deepEqual(await (await fetch(base + '/api/dependencies')).json(), snapshot);
    assert.deepEqual(await (await fetch(base + '/ping')).json(), {message: 'pong'});

    const malformed = await fetch(base + '/api/check', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{invalid'
    });
    assert.equal(malformed.status, 400);
    assert.equal(typeof (await malformed.json()).error, 'string');
    assert.equal(checks, 1, 'Invalid JSON must be rejected before calling the tracker');
});

test('server creation rejects tracker initialization failures without starting a listener', async () => {
    const tracker = stubTracker({initialize: async () => { throw new Error('Invalid dependency configuration'); }});
    await assert.rejects(createServer({tracker}), /Invalid dependency configuration/);
});
