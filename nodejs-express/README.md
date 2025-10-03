# project-service-name

This README provides instructions to build and run the project-service-name using Docker.

## env vars for otel

```bash 
# exporter options are otlp, console, none
export OTEL_METRICS_EXPORTER="otlp"
export OTEL_LOGS_EXPORTER="otlp"
export OTEL_TRACES_EXPORTER="otlp"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
export OTEL_SERVICE_NAME="project-service-name"
export NODE_OPTIONS="--require @opentelemetry/auto-instrumentations-node/register"
```

## Prerequisites

- Docker installed on your machine
- Docker Compose installed on your machine

## Running locally for dev

```sh
npm install 
node server/server.js
```


## Building the Docker Image

To build the Docker image for the project-service-name, run the following command:

```sh
docker rmi alainpham/project-service-name
docker build -t alainpham/project-service-name .
```

## Pushing to repository

```sh
docker push alainpham/project-service-name
```

## Running the Docker Container

To run the Docker container, use the following command:

```sh
docker run --rm -p 8080:8080 --name project-service-name alainpham/project-service-name
```

## Stopping the Docker Container

To stop the running container, use the following command:

```sh
docker stop project-service-name
```

## Removing the Docker Container

To remove the stopped container, use the following command:

```sh
docker rm project-service-name
```

## Deploy on kube

```sh
kubectl create ns apps
kubectl -n apps apply -f deploy.yaml
```