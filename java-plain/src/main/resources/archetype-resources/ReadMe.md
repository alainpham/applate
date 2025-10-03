Plain old Java programm

Build

```
mvn package
```

```
export PROJECT_ARTIFACTID=$(mvn help:evaluate -Dexpression=project.artifactId -q -DforceStdout)
export PROJECT_VERSION=$(mvn help:evaluate -Dexpression=project.version -q -DforceStdout)
export TEMURIN_IMAGE_VERSION=$(mvn help:evaluate -Dexpression=temurin.image.version -q -DforceStdout)
export OPENTELEMETRY_VERSION=$(mvn help:evaluate -Dexpression=opentelemetry.version -q -DforceStdout)
export CONTAINER_REGISTRY=$(mvn help:evaluate -Dexpression=container.registry -q -DforceStdout)

docker buildx build \
    --platform linux/amd64,linux/arm/v7,linux/arm64/v8 \
    --push \
    --progress=plain \
    --build-arg PROJECT_ARTIFACTID=${PROJECT_ARTIFACTID} \
    --build-arg PROJECT_VERSION=${PROJECT_VERSION} \
    --build-arg TEMURIN_IMAGE_VERSION=${TEMURIN_IMAGE_VERSION} \
    --build-arg OPENTELEMETRY_VERSION=${OPENTELEMETRY_VERSION} \
    -f src/main/docker/Dockerfile \
    -t ${CONTAINER_REGISTRY}/${PROJECT_ARTIFACTID}:${PROJECT_VERSION} \
    .
```


#[[## Running container with docker ]]#

Optionally create a dedicated network

```
docker network create --driver=bridge --subnet=172.19.0.0/16 --gateway=172.19.0.1 mainnet 
```

```
export PROJECT_ARTIFACTID=$(mvn help:evaluate -Dexpression=project.artifactId -q -DforceStdout)
export PROJECT_VERSION=$(mvn help:evaluate -Dexpression=project.version -q -DforceStdout)

docker run --rm --net mainnet \
    -p 8080:8080 \
    -e OTEL_JAVAAGENT_ENABLED="true" \
    --name ${PROJECT_ARTIFACTID} ${PROJECT_ARTIFACTID}:${PROJECT_VERSION}

docker run -d --rm --net mainnet \
    -p 8080:8080 \
    -e OTEL_JAVAAGENT_ENABLED="true" \
    --name ${PROJECT_ARTIFACTID} ${PROJECT_ARTIFACTID}:${PROJECT_VERSION}
```
