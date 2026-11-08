const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const {createSourceReader, gitContentRoot} = require('../server/tracker/source');
const {Tracker} = require('../server/tracker/tracker');

const expression = 'language:jsonpointer:/dependencies/express';
const entry = {id: 1, project: 'nodejs-express', coordinates: 'npm:express',
    currentVersionResource: 'nodejs-express/package.json', currentVersionExpression: expression};

async function fixture(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentv-source-root-'));
    t.after(() => fs.rm(root, {recursive: true, force: true}));
    await fs.mkdir(path.join(root, 'nodejs-express'));
    await fs.writeFile(path.join(root, entry.currentVersionResource), '{"dependencies":{"express":"4.0.0"}}');
    return root;
}

test('GitHub repository URLs support the default branch, explicit refs, .git suffixes and tree roots', () => {
    assert.equal(gitContentRoot('https://github.com/alainpham/applate'), 'https://raw.githubusercontent.com/alainpham/applate/HEAD/');
    assert.equal(gitContentRoot('https://github.com/alainpham/applate.git/'), 'https://raw.githubusercontent.com/alainpham/applate/HEAD/');
    assert.equal(gitContentRoot('https://github.com/alainpham/applate/tree/master'), 'https://raw.githubusercontent.com/alainpham/applate/master/');
    assert.equal(gitContentRoot('https://github.com/alainpham/applate/tree/release%2F2026'), 'https://raw.githubusercontent.com/alainpham/applate/release%2F2026/');
});

test('raw-content roots retain their branch and accept Git providers with raw HTTP URLs', () => {
    assert.equal(gitContentRoot('https://raw.githubusercontent.com/alainpham/applate/master/'), 'https://raw.githubusercontent.com/alainpham/applate/master/');
    assert.equal(gitContentRoot('https://gitlab.example/team/repo/-/raw/main'), 'https://gitlab.example/team/repo/-/raw/main/');
    assert.throws(() => gitContentRoot('git@github.com:alainpham/applate.git'), /HTTP/);
    assert.throws(() => gitContentRoot('file:///tmp/repo'), /HTTP/);
    assert.throws(() => gitContentRoot('https://github.com/alainpham'), /repository URL/);
});

test('relative resources read from the local checkout when ROOT_GIT_REPO is unset', async t => {
    const root = await fixture(t);
    const read = createSourceReader({root, gitRepo: '', fetchImpl: async () => { throw new Error('Unexpected network request'); }});
    assert.equal(await read(entry), '4.0.0');
    assert.equal(read.isRemote, false);
    assert.match(read.sourceRoot, /^file:/);
});

test('ROOT_GIT_REPO resolves relative resources remotely even if a local root exists, sharing fetches', async t => {
    const root = await fixture(t);
    let calls = 0;
    const read = createSourceReader({root, gitRepo: 'https://github.com/alainpham/applate/tree/master',
        fetchImpl: async url => {
            calls++;
            assert.equal(url, 'https://raw.githubusercontent.com/alainpham/applate/master/nodejs-express/package.json');
            return Response.json({dependencies: {express: '5.0.0'}});
        }});
    assert.deepEqual(await Promise.all([read(entry), read(entry)]), ['5.0.0', '5.0.0']);
    assert.equal(calls, 1);
    assert.equal(read.isRemote, true);
});

test('remote resource paths encode special characters and remain below the content root', async () => {
    const read = createSourceReader({gitRepo: 'https://raw.example/repo/main', fetchImpl: async url => {
        assert.equal(url, 'https://raw.example/repo/main/project%20name/pkg%231.json');
        return Response.json({dependencies: {express: '5.0.0'}});
    }});
    assert.equal(await read({...entry, currentVersionResource: 'project name/pkg#1.json'}), '5.0.0');
    await assert.rejects(read({...entry, currentVersionResource: '../outside.json'}), /stay inside/);
});

test('absolute source paths and explicit HTTP URLs still override the configured repository root', async t => {
    const root = await fixture(t);
    const read = createSourceReader({root, gitRepo: 'https://github.com/alainpham/applate',
        fetchImpl: async url => {
            assert.equal(url, 'https://example.test/explicit.json');
            return Response.json({dependencies: {express: '6.0.0'}});
        }});
    assert.equal(await read({...entry, currentVersionResource: path.join(root, entry.currentVersionResource)}), '4.0.0');
    assert.equal(await read({...entry, currentVersionResource: 'https://example.test/explicit.json'}), '6.0.0');
});

test('remote source failures are reported with the resolved URL and never fall back silently to local files', async t => {
    const root = await fixture(t);
    const read = createSourceReader({root, gitRepo: 'https://raw.example/repo/main',
        fetchImpl: async () => new Response('', {status: 404})});
    await assert.rejects(read(entry), /Source HTTP 404: https:\/\/raw.example\/repo\/main\/nodejs-express\/package.json/);
});

test('APPLATE_ROOT continues to select the local checkout root', () => {
    const env = {...process.env, APPLATE_ROOT: '/tmp/agentv-local-root'};
    const command = ['-e', 'process.stdout.write(require("./server/tracker/config").APPLATE_ROOT)'];
    assert.equal(execFileSync(process.execPath, command, {cwd: path.join(__dirname, '..'), env, encoding: 'utf8'}), '/tmp/agentv-local-root');
});

test('environment variables select GitHub source mode without changing YAML resources', () => {
    const env = {...process.env, ROOT_GIT_REPO: 'https://github.com/alainpham/applate/tree/master'};
    const sourceRoot = execFileSync(process.execPath, ['-e', 'process.stdout.write(require("./server/tracker/source").createSourceReader().sourceRoot)'],
        {cwd: path.join(__dirname, '..'), env, encoding: 'utf8'});
    assert.equal(sourceRoot, 'https://raw.githubusercontent.com/alainpham/applate/master/');
});

test('saved results are restored only for the same source root, with no source or registry calls', async t => {
    const root = await fixture(t);
    const resultsFile = path.join(root, 'results.yaml');
    const options = {load: async () => [entry], resultsFile,
        clientFactory: () => ({versions: async () => ['5.0.0']})};
    const saved = await new Tracker({...options, sourceReader: () => createSourceReader({root, gitRepo: ''})}).check();
    assert.match(saved.sourceRoot, /^file:/);
    const restored = await new Tracker({...options,
        sourceReader: () => createSourceReader({root, gitRepo: '', fetchImpl: async () => { throw new Error('Unexpected source request'); }}),
        clientFactory: () => { throw new Error('Unexpected registry request'); }}).initialize();
    assert.deepEqual(restored.dependencies, saved.dependencies);
    let reads = 0;
    const remote = await new Tracker({...options, sourceReader: () => createSourceReader({root, gitRepo: 'https://raw.example/repo/main',
        fetchImpl: async () => { reads++; return Response.json({dependencies: {express: '5.0.0'}}); }})}).initialize();
    assert.equal(reads, 1);
    assert.equal(remote.checkedAt, null);
    assert.equal(remote.dependencies[0].currentVersion, '5.0.0');
    assert.equal(remote.dependencies[0].status, 'unchecked');
});

test('legacy local reports are not restored as remote results and changing a Git ref invalidates cached comparisons', async t => {
    const root = await fixture(t);
    const resultsFile = path.join(root, 'results.yaml');
    const options = {load: async () => [entry], resultsFile,
        clientFactory: () => ({versions: async () => ['5.0.0']})};
    const tracker = new Tracker({...options, sourceReader: () => createSourceReader({root, gitRepo: ''})});
    const local = await tracker.check();
    delete local.sourceRoot;
    const YAML = require('yaml');
    await fs.writeFile(resultsFile, YAML.stringify(local));
    const sourceReader = ref => () => createSourceReader({root, gitRepo: 'https://github.com/alainpham/applate/tree/' + ref,
        fetchImpl: async () => Response.json({dependencies: {express: '5.0.0'}})});
    const fresh = await new Tracker({...options, sourceReader: sourceReader('master')}).initialize();
    assert.equal(fresh.dependencies[0].status, 'unchecked');
    const saved = await new Tracker({...options, sourceReader: sourceReader('master')}).check();
    assert.equal(saved.dependencies[0].status, 'up-to-date');
    const same = await new Tracker({...options, sourceReader: sourceReader('master')}).initialize();
    assert.equal(same.dependencies[0].status, 'up-to-date');
    const different = await new Tracker({...options, sourceReader: sourceReader('feature')}).initialize();
    assert.equal(different.dependencies[0].status, 'unchecked');
    assert.equal(different.checkedAt, null);
});
