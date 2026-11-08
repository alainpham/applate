const {coordinates} = require('./config');

class EcosystemsClient {
    constructor({baseUrl = process.env.ECOSYSTEMS_API_URL || 'https://packages.ecosyste.ms/api/v1',
        fetchImpl = fetch, mailto = process.env.ECOSYSTEMS_MAILTO} = {}) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.fetch = fetchImpl;
        this.mailto = mailto;
        this.cache = new Map();
    }

    versions(value) {
        const {registry, name} = coordinates(value);
        const key = `${registry}/${name}`;
        if (!this.cache.has(key)) this.cache.set(key, this.request(registry, name));
        return this.cache.get(key);
    }

    async request(registry, name) {
        if (this.unavailable) throw new Error(this.unavailable);
        // This endpoint returns ALL version strings, avoiding paginated metadata and
        // allowing filters for older maintained release lines and Docker variants.
        const url = new URL(`${this.baseUrl}/registries/${encodeURIComponent(registry)}/packages/${encodeURIComponent(name)}/version_numbers`);
        if (this.mailto) url.searchParams.set('mailto', this.mailto);
        const response = await this.fetch(url, {
            headers: {Accept: 'application/json', 'User-Agent': 'agentv/1.0'},
            signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) {
            const retry = response.headers.get('retry-after');
            const message = `ecosyste.ms HTTP ${response.status} for ${registry}/${name}${retry ? `; retry after ${retry}` : ''}`;
            if (response.status === 429 || response.status === 402) this.unavailable = message;
            throw new Error(message);
        }
        const versions = await response.json();
        if (!Array.isArray(versions) || versions.some(version => typeof version !== 'string')) {
            throw new Error(`Unexpected version response for ${registry}/${name}`);
        }
        return versions;
    }
}

module.exports = {EcosystemsClient};
