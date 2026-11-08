#[[# Project]]# ${artifactId}

#[[## Run in dev]]#

```bash
mvn spring-boot:run
```

#[[## Packaging jar file]]#

```bash
mvn clean package
```

#[[## Packaging container and push to registry]]#

```bash
mvn clean package exec:exec@rmi exec:exec@build
```

example of expanded command and run

```bash
docker buildx build \
    --load \
    --build-arg PROJECT_ARTIFACTID=${artifactId} \
    --build-arg PROJECT_VERSION=${version} \
    --build-arg TEMURIN_IMAGE_VERSION=${temurin-image-version} \
    --build-arg OPENTELEMETRY_VERSION=${opentelemetry-version} \
    -f src/main/docker/Dockerfile \
    -t ${container-registry}/${artifactId}:${version} \
    .

docker run -d --rm \
    --name ${artifactId} \
    --hostname ${artifactId} \
    --network ${docker-network} \
    -e OTEL_JAVAAGENT_ENABLED=true \
    -l traefik.enable=true \
    -l traefik.http.services.${artifactId}.loadbalancer.server.port=8080 \
    -l traefik.http.services.${artifactId}.loadbalancer.server.scheme=http \
    -l traefik.http.routers.${artifactId}.service=${artifactId} \
    -l traefik.http.routers.${artifactId}.entrypoints=https \
    -l traefik.http.routers.${artifactId}.tls=true \
    -l 'traefik.http.routers.${artifactId}.rule=Host(`${artifactId}.${docker-root-domain}`)' \
    ${container-registry}/${artifactId}:${version}
```

#[[## Running container with docker ]]#

With maven commands wrapping docker runs

```bash
# with otel activated
mvn exec:exec@runotel
# without otel
mvn exec:exec@run

# with otel in background
mvn exec:exec@runoteld
# without otel in background
mvn exec:exec@rund
```

#[[## Push on registry and deploy on kube]]#

```bash
mvn exec:exec@kdelete
mvn exec:exec@kdeploy
```

#[[## Multiarch build and push to registry]]#

Multi arch build and push directly to remote registry. First create a builder in buildx
to enable multi arch builds 

```bash
docker buildx create --name multibuilder --platform linux/amd64,linux/arm/v7,linux/arm64/v8 --use
```

Run the maven instruction

```bash
mvn exec:exec@buildpush
```