# nodejs-express

This README provides instructions to build and run the nodejs-express using Docker.

## env vars for otel

```bash 
# exporter options are otlp, console, none
export OTEL_METRICS_EXPORTER="otlp"
export OTEL_LOGS_EXPORTER="otlp"
export OTEL_TRACES_EXPORTER="otlp"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
export OTEL_SERVICE_NAME="nodejs-express"
export NODE_OPTIONS="--require @opentelemetry/auto-instrumentations-node/register"
```

Container endpoint defaults are configured in `package.json`:

- `config.docker_otlp_endpoint`: `http://alloy:4318`, passed by `npm run drun`.
- `config.kube_otlp_endpoint`: `http://grafana-cloud-alloy-deployment.monitoring.svc.cluster.local:4318`, rendered into the Kubernetes manifest.

Set `config.deployment_environment_name` (default: `dev`) to populate
`deployment.environment.name` in `OTEL_RESOURCE_ATTRIBUTES` for Docker and Kubernetes.

## Prerequisites

- Docker installed on your machine
- Docker Compose installed on your machine
- kubectl configured for your cluster and `envsubst` (GNU gettext) for deployment

## Running locally for dev

```sh
npm install 
npm start
```

To auto-restart the server whenever a file under `server/` or `public/` changes,
and auto-reload the browser tab with it:

```sh
npm run dev
```

The browser reload uses a `/__livereload` SSE endpoint plus a small script
injected into served HTML. Both are gated behind `LIVERELOAD=1`, which only
`npm run dev` sets — `npm start` and the container image are untouched.


## API documentation

Business routes (`/ping` and `/send-msg`) live in `server/services.js`.
`server/server.js` handles server setup, UI configuration, Swagger, WebSockets,
static files, and shutdown. Add application endpoints to `services.js`; its
broadcast callback sends updates to connected WebSocket clients.

Open `/swagger-ui.html` for Swagger UI or `/v3/api-docs` for the OpenAPI document.
`swagger-jsdoc` generates the document at startup from `@openapi` comments beside
the routes in `server/**/*.js`. Add or update those comments when changing an API;
request and response schemas are explicitly documented, not inferred from handlers.
The API title uses `APP_NAME` and the version comes from `package.json`.

## Building the Docker Image

Set `config.container_registry` in `package.json` to your Docker registry or namespace
(default: `alainpham`). Build, push, and deployment share this value and use the
package name as the image name and package version as its tag
(default: `alainpham/nodejs-express:1.0.0`).

To build the Docker image for the nodejs-express, run the following command:

```sh
npm run build
```

## Pushing to repository

```sh
npm run push
```

## Running the Docker Container

To run behind Traefik:

```sh
npm run drun
```

The script attaches to `config.docker_network` (default: `primenet`) and sets
Traefik labels for `http://<package-name>.<docker_root_domain>` (default:
`http://nodejs-express.d.codersandbox.com`). Set `config.docker_root_domain` in
`package.json` to change the domain. Traefik must be running on that Docker
network, with an `http` entrypoint, and the hostname must resolve to it.

To access the container directly on localhost instead:

```sh
docker run --rm -p 8080:8080 --name nodejs-express alainpham/nodejs-express:1.0.0
```

## Stopping the Docker Container

To stop the running container, use the following command:

```sh
docker stop nodejs-express
```

## Removing the Docker Container

To remove the stopped container, use the following command:

```sh
docker rm nodejs-express
```

## Deploy on kube

Set `config.namespace` in `package.json` to the Kubernetes namespace
(default: `njs-ns`). The manifest creates the namespace and places the application
resources in it:

```sh
npm run deploy
```

Both deployment and deletion render `deploy.envsubst.yaml` with `envsubst`, using
the npm-provided package name, version, `config.container_registry`,
`config.namespace`, and `config.kube_ingress_root_domain`.
The Ingress routes `http://<package-name>.<kube_ingress_root_domain>` to the service
on port 8080 (default: `http://nodejs-express.k.codersandbox.com`). Set
`config.kube_ingress_root_domain` to change the domain. An ingress controller and
DNS pointing to that controller are required.
Edit this template for deployment changes. Docker push requires
login to the registry. Kubernetes commands use your current kubectl context;
the rendered manifest specifies the namespace, without a `-n` script argument.

To delete the Kubernetes resources, including the namespace and its contents:

```sh
npm run delete
```

To generate plain YAML at `target/<package-name>-deploy.yaml` from the template
and package settings:

```sh
npm run kyml
```

This creates `target/` if needed and overwrites the generated manifest without
applying it to the cluster. The `target/` folder is gitignored.
