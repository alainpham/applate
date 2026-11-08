const semver = require('semver');

function numericVersion(value, ecosystem) {
    const match = /^v?(\d+(?:[._+-]\d+)*)(.*)$/.exec(value);
    if (!match) return null;
    const suffix = match[2];
    if (ecosystem === 'mvn' && suffix && !/^[.-](final|ga|release)$/i.test(suffix)) return null;
    if (ecosystem === 'docker' && /(?:^|[._-])(alpha|beta|rc|ea|snapshot|preview|milestone|m\d+)(?:[.\d_-]|$)/i.test(suffix)) return null;
    return {parts: match[1].split(/[._+-]/).map(BigInt), suffix};
}

function compareParts(left, right) {
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
        const a = left[i] ?? 0n;
        const b = right[i] ?? 0n;
        if (a !== b) return a > b ? 1 : -1;
    }
    return 0;
}

function selectLatest(versions, entry, ecosystem, currentVersion, {ignoreFilter = false} = {}) {
    const filter = new RegExp(ignoreFilter ? '.*' : entry.latestVersionFilter || '.*');
    const current = numericVersion(currentVersion, ecosystem);
    let latest = null;
    for (const version of versions) {
        if (!filter.test(version)) continue;
        if (ecosystem === 'npm') {
            if (!semver.valid(version) || semver.prerelease(version)) continue;
            if (latest === null || semver.gt(version, latest)) latest = version;
        } else {
            const candidate = numericVersion(version, ecosystem);
            if (!candidate) continue;
            // Stay on the same Docker variant (e.g. -jre) instead of switching OS/JDK.
            if (!ignoreFilter && ecosystem === 'docker' && current && candidate.suffix !== current.suffix) continue;
            if (latest === null || compareParts(candidate.parts, numericVersion(latest, ecosystem).parts) > 0) latest = version;
        }
    }
    return latest;
}

function versionStatus(current, latest, ecosystem) {
    if (ecosystem === 'npm') {
        const range = semver.validRange(current);
        if (!range || !semver.minVersion(range)) throw new Error(`Cannot compare npm version or range: ${current}`);
        if (semver.satisfies(latest, range)) return 'up-to-date';
        return semver.gt(semver.minVersion(range), latest) ? 'ahead' : 'update-available';
    }
    const a = numericVersion(current, ecosystem);
    const b = numericVersion(latest, ecosystem);
    if (!a || !b) throw new Error(`Cannot compare version: ${current}. Use a numeric release/tag.`);
    const comparison = compareParts(a.parts, b.parts);
    return comparison < 0 ? 'update-available' : comparison > 0 ? 'ahead' : 'up-to-date';
}

module.exports = {selectLatest, versionStatus};
