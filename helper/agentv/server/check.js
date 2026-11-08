const {Tracker} = require('./tracker/tracker');

async function main() {
    const result = await new Tracker().check();
    console.table(result.dependencies.map(({project, coordinates, currentVersion, latestVersion, latestAndGreatestVersion, matchingStatus, status, error}) => ({
        project, coordinates, current: currentVersion, latestMatching: latestVersion, matchingStatus,
        latestAndGreatest: latestAndGreatestVersion, status, error: error || ''
    })));
    console.log(`${result.summary.updates} updates, ${result.summary.errors} errors, ${result.summary.total} dependencies`);
    if (result.summary.errors || (process.argv.includes('--fail-on-update') && result.summary.updates)) process.exitCode = 1;
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
