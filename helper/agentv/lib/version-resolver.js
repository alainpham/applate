const { DOMParser } = require('@xmldom/xmldom');
const xpath = require('xpath');

const MAX_RESOURCE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;

async function fetchResource(resourceUrl) {
  let response;
  try {
    response = await fetch(resourceUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: 'application/json,application/xml,text/xml,text/plain,*/*' }
    });
  } catch (error) {
    throw new Error(`Could not fetch resource: ${error.message}`);
  }
  if (!response.ok) throw new Error(`Resource returned HTTP ${response.status}`);
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESOURCE_BYTES) {
    throw new Error('Resource is larger than 2 MiB');
  }
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_RESOURCE_BYTES) throw new Error('Resource is larger than 2 MiB');
  return text;
}

function evaluateExpression(content, expression) {
  if (typeof expression !== 'string') throw new Error('currentVersionExpression must be a string');
  if (expression.startsWith('xpath:')) return evaluateXPath(content, expression.slice('xpath:'.length));
  if (expression.startsWith('regexp:')) return evaluateRegexp(content, expression.slice('regexp:'.length));
  throw new Error('Expression must start with xpath: or regexp:');
}

function evaluateRegexp(content, source) {
  let pattern = source;
  let flags = '';
  const delimited = source.match(/^\/(.*)\/([dgimsuvy]*)$/s);
  if (delimited) {
    pattern = delimited[1];
    flags = delimited[2];
  }
  let match;
  try {
    match = new RegExp(pattern, flags).exec(content);
  } catch (error) {
    throw new Error(`Invalid regular expression: ${error.message}`);
  }
  if (!match) throw new Error('Regular expression did not match the resource');
  return (match[1] || match[0]).trim();
}

function evaluateXPath(content, source) {
  if (!source.trim()) throw new Error('XPath expression is empty');
  for (const text of selectXPathValues(content, source)) {
    if (text.trim()) return text.trim();
  }
  throw new Error('XPath did not match the resource');
}

function selectXPathValues(content, source) {
  const document = parseXml(content);
  // The supplied expressions use XPath 2.0's *:local-name wildcard. The
  // xpath npm module evaluates XPath 1.0, so translate that safe subset.
  const xpathExpression = source.replace(/\*:([A-Za-z_][\w.-]*)/g, '*[local-name()="$1"]');
  let result;
  try {
    result = xpath.select(xpathExpression, document);
  } catch (error) {
    throw new Error(`Invalid XPath: ${error.message}`);
  }
  const values = Array.isArray(result) ? result : [result];
  return values.map((value) => typeof value === 'object' && value !== null
    ? (value.nodeValue || value.textContent || '')
    : String(value ?? ''));
}

function parseXml(content) {
  const parserErrors = [];
  const document = new DOMParser({ errorHandler: {
    warning: () => {},
    error: (message) => parserErrors.push(message),
    fatalError: (message) => parserErrors.push(message)
  } }).parseFromString(content, 'text/xml');
  if (parserErrors.length) throw new Error(`Invalid XML: ${parserErrors[0]}`);
  return document;
}

function parseMavenCoordinates(coordinates) {
  const match = /^mvn:([^:]+):([^:]+)$/i.exec(coordinates || '');
  if (!match) throw new Error(`Invalid Maven coordinates: ${coordinates}`);
  return { groupId: match[1], artifactId: match[2] };
}

function compileVersionFilter(filter) {
  if (!filter) return null;
  const source = filter.startsWith('regexp:') ? filter.slice('regexp:'.length) : filter;
  try {
    return new RegExp(source);
  } catch (error) {
    throw new Error(`Invalid latest version filter: ${error.message}`);
  }
}

function versionTokens(version) {
  return version.toLowerCase().replace(/^v/, '').split(/[.\-_+]/).filter(Boolean).map((token) => {
    if (/^\d+$/.test(token)) return { number: Number(token) };
    const qualifier = /^([a-z]+)(\d+)$/.exec(token);
    if (qualifier) return { text: qualifier[1], number: Number(qualifier[2]) };
    return { text: token };
  });
}

function qualifierRank(value) {
  if (/^(alpha|a)$/.test(value)) return 1;
  if (/^(beta|b)$/.test(value)) return 2;
  if (/^(milestone|m)$/.test(value)) return 3;
  if (/^(rc|cr)$/.test(value)) return 4;
  if (/^(snapshot|snap)$/.test(value)) return 5;
  if (/^(sp|servicepack)$/.test(value)) return 7;
  // A missing qualifier, GA, Final, Release, and unknown vendor release
  // qualifiers are treated as stable releases.
  return 6;
}

function compareMissingToToken(token) {
  if (token.number !== undefined && token.text === undefined) return -1;
  const rank = qualifierRank(token.text);
  if (rank < 6) return 1;
  if (rank > 6) return -1;
  return 0;
}

function compareMavenVersions(left, right) {
  const leftTokens = versionTokens(left);
  const rightTokens = versionTokens(right);
  const length = Math.max(leftTokens.length, rightTokens.length);
  for (let index = 0; index < length; index += 1) {
    const a = leftTokens[index];
    const b = rightTokens[index];
    if (!a && !b) continue;
    if (!a) return compareMissingToToken(b);
    if (!b) return -compareMissingToToken(a);
    if (a.number !== undefined && b.number !== undefined) {
      if (a.number !== b.number) return a.number - b.number;
      if (a.text === undefined && b.text === undefined) continue;
    }
    if (a.number !== undefined && a.text === undefined) return 1;
    if (b.number !== undefined && b.text === undefined) return -1;
    const rankDifference = qualifierRank(a.text) - qualifierRank(b.text);
    if (rankDifference) return rankDifference;
    const suffixDifference = (a.number || 0) - (b.number || 0);
    if (suffixDifference) return suffixDifference;
    const textDifference = a.text.localeCompare(b.text);
    if (textDifference) return textDifference;
  }
  return left.localeCompare(right, undefined, { numeric: true });
}

async function resolveMavenVersions(coordinates, latestVersionFilter) {
  const { groupId, artifactId } = parseMavenCoordinates(coordinates);
  const artifactResource = `https://repo.maven.apache.org/maven2/${groupId.replace(/\./g, '/')}/${artifactId}/maven-metadata.xml`;
  const metadata = await fetchResource(artifactResource);
  const versions = selectXPathValues(
    metadata,
    '/*[local-name()="metadata"]/*[local-name()="versioning"]/*[local-name()="versions"]/*[local-name()="version"]/text()'
  ).map((version) => version.trim()).filter(Boolean);
  if (!versions.length) throw new Error('Maven metadata contains no versions');

  const latestAndGreatest = [...new Set(versions)].sort(compareMavenVersions).at(-1);
  const filter = compileVersionFilter(latestVersionFilter);
  const filteredVersions = filter ? versions.filter((version) => filter.test(version)) : versions;
  return {
    latestVersion: filteredVersions.length ? [...new Set(filteredVersions)].sort(compareMavenVersions).at(-1) : null,
    latestAndGreatest,
    artifactResource,
    filterMatched: filteredVersions.length > 0
  };
}

function parseDockerCoordinates(coordinates) {
  const match = /^docker:([^:]+?)(?::([^:]+))?$/i.exec(coordinates || '');
  if (!match) throw new Error(`Invalid Docker coordinates: ${coordinates}`);
  return { repository: match[1], tagPrefix: match[2] || '' };
}

function inferDockerTagPrefix(latestVersionFilter, currentVersion) {
  const filter = latestVersionFilter && latestVersionFilter.startsWith('regexp:')
    ? latestVersionFilter.slice('regexp:'.length)
    : latestVersionFilter;
  const filterMatch = filter && /^\^?(\d+(?:\.\d+)*)/.exec(filter);
  if (filterMatch) return filterMatch[1];
  const currentMatch = /^(\d+(?:\.\d+)*)/.exec(currentVersion || '');
  return currentMatch ? currentMatch[1] : '';
}

async function resolveDockerVersions(coordinates, latestVersionFilter, currentVersion) {
  const { repository, tagPrefix } = parseDockerCoordinates(coordinates);
  const repositoryPath = repository.replace('/', '/repositories/');
  const queryName = tagPrefix || inferDockerTagPrefix(latestVersionFilter, currentVersion);
  const artifactResource = `https://hub.docker.com/v2/namespaces/${repositoryPath}/tags?page_size=100&name=${encodeURIComponent(queryName)}`;
  let payload;
  try {
    payload = JSON.parse(await fetchResource(artifactResource));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Docker Hub returned invalid JSON');
    throw error;
  }
  const versions = (payload.results || []).map((tag) => String(tag.name || '')).filter(Boolean);
  if (!versions.length) throw new Error('Docker Hub returned no matching tags');

  const latestAndGreatest = [...new Set(versions)].sort(compareMavenVersions).at(-1);
  const filter = compileVersionFilter(latestVersionFilter);
  const filteredVersions = filter ? versions.filter((version) => filter.test(version)) : versions;
  return {
    latestVersion: filteredVersions.length ? [...new Set(filteredVersions)].sort(compareMavenVersions).at(-1) : null,
    latestAndGreatest,
    artifactResource,
    filterMatched: filteredVersions.length > 0
  };
}

async function resolveArtifactVersions(artifact) {
  const result = {};
  const errors = [];
  try {
    result.currentVersion = await resolveCurrentVersion(artifact);
  } catch (error) {
    result.currentVersion = null;
    errors.push(`current version: ${error.message}`);
  }
  if (/^mvn:/i.test(artifact.coordinates)) {
    try {
      const maven = await resolveMavenVersions(artifact.coordinates, artifact.latestVersionFilter);
      result.latestVersion = maven.latestVersion;
      result.latestAndGreatest = maven.latestAndGreatest;
      if (artifact.latestVersionFilter && !maven.filterMatched) {
        errors.push('latest version filter matched no published versions');
      }
    } catch (error) {
      result.latestVersion = null;
      result.latestAndGreatest = null;
      errors.push(`Maven versions: ${error.message}`);
    }
  } else if (/^docker:/i.test(artifact.coordinates)) {
    try {
      const docker = await resolveDockerVersions(artifact.coordinates, artifact.latestVersionFilter, artifact.currentVersion);
      result.latestVersion = docker.latestVersion;
      result.latestAndGreatest = docker.latestAndGreatest;
      if (artifact.latestVersionFilter && !docker.filterMatched) {
        errors.push('latest version filter matched no Docker Hub tags');
      }
    } catch (error) {
      result.latestVersion = null;
      result.latestAndGreatest = null;
      errors.push(`Docker versions: ${error.message}`);
    }
  }
  return { result, error: errors.length ? errors.join('; ') : null };
}

async function resolveCurrentVersion(artifact) {
  const content = await fetchResource(artifact.currentVersionResource);
  return evaluateExpression(content, artifact.currentVersionExpression);
}

module.exports = {
  resolveCurrentVersion,
  resolveArtifactVersions,
  resolveMavenVersions,
  resolveDockerVersions,
  compareMavenVersions,
  evaluateExpression,
  evaluateRegexp,
  evaluateXPath,
  fetchResource
};
