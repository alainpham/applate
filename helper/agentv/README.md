# agentv

Tracks dependency versions across the applate repository using the existing Express,
plain JavaScript, themed CSS, WebSocket, Swagger UI, and live-reload template.
Available versions come from [ecosyste.ms Packages](https://packages.ecosyste.ms/docs/).

## Run

Requires Node.js 22 or newer. From `helper/agentv`:

```sh
npm ci
npm start
```

Open <http://localhost:8080> and click **Check for updates**. The table shows current
versions, the highest matching stable release, the unfiltered **Latest and greatest**
stable release. Version cells use red for available updates and green when current
or ahead, without status text or a separate status column. Hover over a version
cell for its status or source/API error. The update count and status filter compare
current versions against Latest and greatest. Latest matching is colored using
its own comparison with the current version.
Filter by project, status, or package name. Connected tabs receive progress over
WebSockets. Starting the server restores saved results when available, without
calling ecosyste.ms; checks are triggered by the button, API, or CLI.

```sh
npm run dev                     # Server watch and browser reload
npm run check                   # Check once, print a table, write the YAML report
npm run check -- --fail-on-update # Also return a failing exit code when updates exist
npm test                        # Offline unit and HTTP/WebSocket integration tests
```

The CLI returns exit code 1 for failed checks or invalid configuration, and normally
returns 0 when a check succeeds even if updates are available. It can be scheduled
with cron or run in CI.

## Apply saved updates interactively

From the applate repository root:

```sh
node helper/scripts/update-artifacts.js
```

The script reads `helper/agentv/data/results.yaml` by default. Choose a project by
number or name, or choose `a` for all projects. It reads the actual local files,
previews the old and new versions, and asks before applying changes. It uses the
saved **Latest matching** version, preserving version filters and Docker variants.
It requires the dependencies installed by `npm ci` in `helper/agentv` and works
from any working directory.

```sh
node helper/scripts/update-artifacts.js --dry-run
node helper/scripts/update-artifacts.js --results /path/to/results.yaml --root /path/to/applate
```

Supported sources are Maven archetype `requiredProperty/defaultValue` XPath
selectors, JSON pointers (including scoped npm packages), and regex capture
groups such as Dockerfile tags. XML formatting and comments are preserved; npm
`^` and `~` operators are retained. Current or newer versions, failed checks,
sources changed since the report, and unsupported sources are skipped with a
reason. The known Springdoc 3 / Spring Boot 3 incompatibility is also skipped.

If npm dependencies change and the package has `package-lock.json` or
`npm-shrinkwrap.json`, the script runs
`npm install --package-lock-only --ignore-scripts --no-audit --no-fund` in that
package directory to synchronize the lockfile. This may contact the npm registry.
The input report stays unchanged; run `npm run check` in `helper/agentv` afterward
to refresh its current versions and statuses.

## Dependency configuration

Edit [`data/dependencies.yaml`](data/dependencies.yaml). It contains 47 explicit
entries: the original watcher's 28 Maven/Docker entries and the npm dependencies
of `nodejs-express`, `helper/templategen`, and this application. Add an entry when a
new dependency should be tracked; this is an inventory, not an automatic repository
scanner. Project files are read again, and configuration edits picked up, at each check.

The old IDs and maintained version lines are retained. Filters use anchored,
escaped version prefixes; Spring Boot's Temurin entry now follows Java 25 to match
its current archetype. The other archetypes retain Java 17. Filters are tracking
policies, not a guarantee that upgrading independently keeps frameworks compatible.

```yaml
- id: 100
  project: java-quarkus-camel
  currentVersionResource: java-quarkus-camel/src/main/resources/META-INF/maven/archetype-metadata.xml
  currentVersionExpression: language:xpath://*:requiredProperty[@key='compiler-plugin-version']/*:defaultValue/text()
  coordinates: mvn:org.apache.maven.plugins:maven-compiler-plugin
  latestVersionFilter: '^3\.'

- id: 501
  project: nodejs-express
  currentVersionResource: nodejs-express/package.json
  currentVersionExpression: language:jsonpointer:/dependencies/express
  coordinates: npm:express

- id: 106
  project: java-quarkus-camel
  currentVersionResource: java-quarkus-camel/src/main/resources/META-INF/maven/archetype-metadata.xml
  currentVersionExpression: language:xpath://*:requiredProperty[@key='temurin-image-version']/*:defaultValue/text()
  coordinates: docker:library/eclipse-temurin
  latestVersionFilter: '^17\..*-jre$'
```

Each entry needs a unique `id`, `project`, `coordinates`, `currentVersionResource`,
and `currentVersionExpression`. `latestVersionFilter` is an optional JavaScript
regular expression. Single-quote YAML regexes to preserve their backslashes.

- Coordinates: `mvn:groupId:artifactId`, `npm:name` (including `npm:@scope/name`),
  or `docker:namespace/image`. Docker images default to the Docker Hub registry.
- Resources: paths relative to `APPLATE_ROOT`, absolute paths, or HTTP(S) URLs.
  The default local root is the surrounding applate checkout, independent of the
  shell's working directory. Set `ROOT_GIT_REPO` to fetch relative resources from
  a remote repository instead, without changing the dependency YAML. When both
  variables are set, `ROOT_GIT_REPO` takes precedence for relative paths. Explicit
  absolute paths and HTTP(S) resource URLs still use their specified locations.
- XPath: prefix an XPath 1 expression with `language:xpath:`. The original
  watcher's `*:element` namespace wildcards are supported, as are `local-name()`
  selectors. Select exactly one text node, attribute, or element.
- JSON pointer: use `language:jsonpointer:/dependencies/express`. Escape `/` as
  `~1` and `~` as `~0`, e.g. `/dependencies/@scope~1package`.
- Regex: `language:regex:^FROM node:([^\s]+)` extracts the first capture group.

## Version checks and reports

The checker uses ecosyste.ms' **`version_numbers`** endpoint for npm, Maven Central,
and Docker Hub. It reads the full version list rather than relying on a global
latest release that might be outside a maintained line. Repeated package lookups
and source reads are shared within a run, API calls are serial, and overlapping
HTTP checks share one run. HTTP 402/429 responses stop further API calls in that
run and expose the error, including `Retry-After` when supplied. Requests time out
after 15 seconds. A later check makes fresh requests.

Each response and YAML report includes `latestVersion` (filtered), `matchingStatus`
(current versus filtered), `latestAndGreatestVersion` (unfiltered), and `status`
(current versus unfiltered). Both lookups reuse the same API response.

Only stable releases are selected. npm uses semantic version ordering. Maven uses
numeric release components (also accepting `.Final`, `.GA`, and `.RELEASE`), and
Docker compares numeric components including Temurin's `_build` number while
preserving the current tag's suffix/variant for Latest matching. Latest and greatest
ignores both the configured version filter and the Docker variant restriction.
Maven prereleases and Docker early access tags are excluded. Floating tags such as
`latest`/`lts` cannot be compared
as version numbers; configure a source containing a numeric tag. Arbitrary Maven
qualifiers and container digest monitoring are outside this checker's scope.

For npm ranges, the declared requirement is shown: if the highest stable release
matches that range, the entry is up to date. Lockfile/installed/transitive versions
are not inspected. `ahead` means the project's version is higher than Latest and
greatest indexed by ecosyste.ms, which can lag the upstream registry. A missing
package or source is reported as an error. If the version filter matches no stable
release, Latest matching shows a red dash with the reason in its tooltip while the unfiltered
comparison remains available.

Completed results are atomically written to `data/results.yaml`, including check
timestamps, current/latest versions, statuses, errors, and summary counts. This
runtime report is gitignored; the configuration stays separate. At startup, the
server restores saved versions, comparisons, errors, and check timestamps from
`RESULTS_FILE` when it exists, so the previous red/green indicators appear immediately
without contacting ecosyste.ms. Summary counts are recalculated from the restored
entries. Only entries whose ID and configuration still match are restored; new or
changed entries read their current source and start unchecked. Removed entries
are omitted. The report also records `sourceRoot`; switching local roots, remote
repositories, or branches reads current versions from the new source instead of
reusing the previous source's statuses. Legacy reports can still be restored in
local mode. Missing or invalid reports fall back to reading current versions.
Saved versions describe the last check; click Check for updates to refresh them
after changing project files.

## HTTP API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/dependencies` | Current state and summary |
| POST | `/api/check` | Run a check and return the completed report |
| GET | `/api/config.yaml` | Download dependency configuration |
| GET | `/ping` | Health check |
| GET | `/uiconfig` | Template name and theme |
| GET | `/v3/api-docs` | OpenAPI document |
| GET | `/swagger-ui.html` | Interactive API documentation |

Individual dependency failures are returned in the report with HTTP 200. Invalid
configuration or a report-write failure returns an HTTP error. Version checks do
not modify the tracked projects.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `APPLATE_ROOT` | Surrounding applate checkout | Root for relative project source paths |
| `ROOT_GIT_REPO` | Unset | Remote repository/content root for relative sources; takes precedence over the local root |
| `DATA_FILE` | App's `data/dependencies.yaml` | Configuration YAML path |
| `RESULTS_FILE` | App's `data/results.yaml` | Output report path |
| `ECOSYSTEMS_API_URL` | `https://packages.ecosyste.ms/api/v1` | Packages API base URL |
| `ECOSYSTEMS_MAILTO` | Unset | Optional contact email for ecosyste.ms' polite request pool |
| `PORT` | `8080` | HTTP port |
| `APP_NAME` | `agentv` | Template display name |
| `THEME` | `main-dark-green` | Existing template theme |
| `LOG_LEVEL` | `info` | Pino logging level |

## Docker

Build the image:

```sh
docker build -t alainpham/agentv .
```

To read committed versions directly from GitHub without mounting a checkout:

```sh
docker run --rm -p 8080:8080 \
  -e ROOT_GIT_REPO=https://raw.githubusercontent.com/alainpham/applate/master \
  -e RESULTS_FILE=/data/results.yaml \
  -v agentv-results:/data \
  --name agentv alainpham/agentv
```

`ROOT_GIT_REPO` accepts a raw-content root as above, a GitHub repository URL such
as `https://github.com/alainpham/applate` (uses its default branch via `HEAD`),
or `https://github.com/alainpham/applate/tree/master` for an explicit branch.
For other Git hosts, supply their HTTP(S) raw-content root including the branch.
The existing `currentVersionResource` values stay relative, so the same YAML works
locally and in the container. Remote files must be accessible to the container.
Requests are shared per source file during each check, with a 15-second timeout.

To read a local checkout on the Docker host instead, leave `ROOT_GIT_REPO` unset:

```sh
docker run --rm -p 8080:8080 \
  -e APPLATE_ROOT=/applate \
  -v /absolute/path/to/applate:/applate:ro \
  --name agentv alainpham/agentv
```

The image includes the dependency configuration. Local mode requires the repository
mount above. Kubernetes deployments can set `ROOT_GIT_REPO` in the container's
environment in the same way, or mount a checkout and set `APPLATE_ROOT`.
Mount a writable directory and set `RESULTS_FILE` there if reports should survive
container replacement, or use the named volume shown in the remote example.

## OpenTelemetry

The existing Docker image installs auto-instrumentation under `/otel`. To configure
an instrumented runtime:

```sh
export OTEL_METRICS_EXPORTER="otlp"
export OTEL_LOGS_EXPORTER="otlp"
export OTEL_TRACES_EXPORTER="otlp"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
export OTEL_SERVICE_NAME="agentv"
```

The container supplies `NODE_OPTIONS` to load the instrumentation. For local
instrumentation, install it separately and set
`NODE_OPTIONS="--require @opentelemetry/auto-instrumentations-node/register"`.
