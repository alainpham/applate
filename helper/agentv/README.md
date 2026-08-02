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

Coordinates must currently use `mvn:group:artifact` or `docker:namespace/image`. Version fetching and computation will use the saved definitions in the next milestone.
