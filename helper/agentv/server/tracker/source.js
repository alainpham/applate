const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {DOMParser} = require('@xmldom/xmldom');
const xpath = require('xpath');
const {APPLATE_ROOT, ROOT_GIT_REPO} = require('./config');

function extractVersion(content, expression) {
    let value;
    if (expression.startsWith('language:xpath:')) {
        // Camel's namespace wildcard syntax is XPath 2; xpath implements XPath 1.
        const query = expression.slice('language:xpath:'.length)
            .replace(/\*:([\w-]+)/g, "*[local-name()='$1']");
        const document = new DOMParser({onError: (level, message) => {
            if (level !== 'warning') throw new Error(message);
        }}).parseFromString(content, 'text/xml');
        const nodes = xpath.select(query, document);
        if (!Array.isArray(nodes) || nodes.length !== 1) throw new Error('XPath must select exactly one version');
        value = nodes[0].nodeValue ?? nodes[0].textContent;
    } else if (expression.startsWith('language:jsonpointer:')) {
        const pointer = expression.slice('language:jsonpointer:'.length);
        if (!pointer.startsWith('/')) throw new Error('JSON pointer must begin with /');
        value = JSON.parse(content);
        for (const segment of pointer.slice(1).split('/')) {
            const key = segment.replace(/~1/g, '/').replace(/~0/g, '~');
            value = value && Object.hasOwn(value, key) ? value[key] : undefined;
        }
    } else if (expression.startsWith('language:regex:')) {
        value = new RegExp(expression.slice('language:regex:'.length), 'm').exec(content)?.[1];
    } else {
        throw new Error('Unsupported current-version expression');
    }
    if (typeof value !== 'string' || !value.trim()) throw new Error('Version expression returned no string value');
    return value.trim();
}

function gitContentRoot(repo) {
    let url;
    try { url = new URL(repo); }
    catch { throw new Error('ROOT_GIT_REPO must be a GitHub repository URL or an HTTP(S) raw-content root'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash) {
        throw new Error('ROOT_GIT_REPO must be an HTTP(S) URL without a query or fragment');
    }
    if (url.hostname === 'github.com') {
        const segments = url.pathname.split('/').filter(Boolean);
        if (segments.length !== 2 && !(segments.length >= 4 && segments[2] === 'tree')) {
            throw new Error('Use a GitHub repository URL, a /tree/REF URL, or a raw-content root');
        }
        const repository = segments[1].replace(/\.git$/, '');
        const gitPath = segments.length >= 4 ? segments.slice(3).join('/') : 'HEAD';
        return `https://raw.githubusercontent.com/${segments[0]}/${repository}/${gitPath}/`;
    }
    return url.href.replace(/\/+$/, '') + '/';
}

function createSourceReader({root = APPLATE_ROOT, gitRepo = ROOT_GIT_REPO, fetchImpl = fetch} = {}) {
    const gitRoot = gitRepo ? gitContentRoot(gitRepo) : null;
    const resources = new Map();
    const readVersion = async function readVersion(entry) {
        let resource = entry.currentVersionResource;
        if (!/^https?:\/\//.test(resource) && !path.isAbsolute(resource) && gitRoot) {
            const relative = path.posix.normalize(resource);
            if (relative === '..' || relative.startsWith('../')) throw new Error('Resource path must stay inside ROOT_GIT_REPO');
            resource = new URL(relative.split('/').map(encodeURIComponent).join('/'), gitRoot).href;
        }
        if (!resources.has(resource)) {
            resources.set(resource, (async () => {
                if (/^https?:\/\//.test(resource)) {
                    const response = await fetchImpl(resource, {signal: AbortSignal.timeout(15000)});
                    if (!response.ok) throw new Error(`Source HTTP ${response.status}: ${resource}`);
                    return response.text();
                }
                return fs.readFile(path.resolve(root, resource), 'utf8');
            })());
        }
        return extractVersion(await resources.get(resource), entry.currentVersionExpression);
    };
    readVersion.sourceRoot = gitRoot || pathToFileURL(path.resolve(root)).href;
    readVersion.isRemote = Boolean(gitRoot);
    return readVersion;
}

module.exports = {extractVersion, createSourceReader, gitContentRoot};
