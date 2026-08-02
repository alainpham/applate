# Version Tracker

Small Node.js/HTML application for tracking Maven and Docker artifacts. Artifact definitions are persisted in the YAML file at `data/artifacts.yml` (override it with `ARTIFACTS_FILE`).

## Run

```bash
npm install
npm start
```

Open <http://localhost:3001>.

## CRUD API

The service exposes:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/artifacts` | List artifacts |
| `GET` | `/api/artifacts/:id` | Read one artifact |
| `POST` | `/api/artifacts` | Create an artifact |
| `PUT` / `PATCH` | `/api/artifacts/:id` | Update editable fields |
| `DELETE` | `/api/artifacts/:id` | Delete an artifact |
| `POST` | `/api/artifacts/refresh` | Refresh current versions asynchronously |

Only these fields are accepted for create/update: `project`, `currentVersionResource`, `currentVersionExpression`, `coordinates`, and `latestVersionFilter`. The server assigns `id`; `currentVersion`, `latestVersion`, and `latestAndGreatest` are computed fields and are reset to `null` when an artifact is created or edited.

Example request:

```json
{
  "project": "Payments API",
  "currentVersionResource": "https://raw.example.com/pom.xml",
  "currentVersionExpression": "<version>([^<]+)</version>",
  "coordinates": "mvn:org.example:payments-api",
  "latestVersionFilter": "1.4.x"
}
```

Coordinates must currently use `mvn:group:artifact` or `docker:namespace/image[:tag]`.

Clicking **Refresh** starts a server-side fetch for every artifact. Each resource is evaluated with either an `xpath:` or `regexp:` expression, persisted to `currentVersion`, and sent to connected browsers immediately over WebSocket as it completes.

For Maven coordinates, the refresh also reads Maven Central metadata from `https://repo.maven.apache.org/maven2/<group path>/<artifact>/maven-metadata.xml`. `latestVersion` is the highest published version matching `latestVersionFilter`; `latestAndGreatest` is the highest published version without applying the filter.

For Docker coordinates, the refresh reads tags from Docker Hub using the repository and tag prefix in the coordinate, for example `docker:library/eclipse-temurin:17.`. The same filter and greatest-version rules are applied to the returned tag names.
