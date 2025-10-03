#[[# Project]]# ${artifactId}

#[[## All variables for build]]#

```bash
export PROJECT_ARTIFACTID=$(mvn help:evaluate -Dexpression=project.artifactId -q -DforceStdout)
export PROJECT_VERSION=$(mvn help:evaluate -Dexpression=project.version -q -DforceStdout)
export TEMURIN_IMAGE_VERSION=$(mvn help:evaluate -Dexpression=temurin.image.version -q -DforceStdout)
export OPENTELEMETRY_VERSION=$(mvn help:evaluate -Dexpression=opentelemetry.version -q -DforceStdout)
export CONTAINER_REGISTRY=$(mvn help:evaluate -Dexpression=container.registry -q -DforceStdout)
export KUBE_INGRESS_ROOT_DOMAIN=$(mvn help:evaluate -Dexpression=kube.ingress.root.domain -q -DforceStdout)
export DOCKER_NETWORK=$(mvn help:evaluate -Dexpression=docker.network -q -DforceStdout)
export DOCKER_ROOT_DOMAIN=$(mvn help:evaluate -Dexpression=docker.root.domain -q -DforceStdout)
export DOCKER_OTLP_ENDPOINT=$(mvn help:evaluate -Dexpression=docker.otlp.endpoint -q -DforceStdout)
```

#[[## Run in dev]]#

```bash
mvn spring-boot:run
```

#[[## Packaging jar file]]#

```bash
mvn clean package
```

#[[## Packaging container]]#

```bash
mvn clean package exec:exec@rmi exec:exec@build
```

alternatively using raw docker commands

```bash
docker rmi -f ${CONTAINER_REGISTRY}/${PROJECT_ARTIFACTID}:${PROJECT_VERSION}

docker buildx build \
    --load \
    --build-arg PROJECT_ARTIFACTID=${PROJECT_ARTIFACTID} \
    --build-arg PROJECT_VERSION=${PROJECT_VERSION} \
    --build-arg TEMURIN_IMAGE_VERSION=${TEMURIN_IMAGE_VERSION} \
    --build-arg OPENTELEMETRY_VERSION=${OPENTELEMETRY_VERSION} \
    -f src/main/docker/Dockerfile \
    -t ${CONTAINER_REGISTRY}/${PROJECT_ARTIFACTID}:${PROJECT_VERSION} \
    .
```

#[[## Running container with docker ]]#

With maven commands wrapping docker runs

```bash
# with otel activated
mvn exec:exec@runotel
# without otel
mvn exec:exec@run

# with otel in background
mvn exec:exec@runotel
# without otel in background
mvn exec:exec@rund
```

Alternative with ports open on localhost

```
docker run --rm --net ${DOCKER_NETWORK} \
    -p 8080:8080 \
    -e OTEL_JAVAAGENT_ENABLED="true" \
    --name ${PROJECT_ARTIFACTID} ${CONTAINER_REGISTRY}/${PROJECT_ARTIFACTID}:${PROJECT_VERSION}

docker run -d --rm --net ${DOCKER_NETWORK} \
    -p 8080:8080 \
    -e OTEL_JAVAAGENT_ENABLED="true" \
    --name ${PROJECT_ARTIFACTID} ${CONTAINER_REGISTRY}/${PROJECT_ARTIFACTID}:${PROJECT_VERSION}
```

Launch multiple instances

```
NB_CONTAINERS=2

for (( i=0; i<$NB_CONTAINERS; i++ ))
do
    docker run -d --rm --net ${DOCKER_NETWORK} \
    -e OTEL_JAVAAGENT_ENABLED="true" \
    --name ${PROJECT_ARTIFACTID}-$i ${CONTAINER_REGISTRY}/${PROJECT_ARTIFACTID}:${PROJECT_VERSION}
done

for (( i=0; i<$NB_CONTAINERS; i++ ))
do
   docker stop ${PROJECT_ARTIFACTID}-$i
   docker rm ${PROJECT_ARTIFACTID}-$i
done
```


#[[## Push on registry and deploy on kube]]#

```
mvn exec:exec@push 
mvn exec:exec@kdelete
mvn exec:exec@kdeploy
```

alternative with pure command line

```
docker push ${CONTAINER_REGISTRY}/${PROJECT_ARTIFACTID}:${PROJECT_VERSION}

envsubst < src/main/kube/deploy.envsubst.yaml | kubectl delete -f -
envsubst < src/main/kube/deploy.envsubst.yaml | kubectl apply -f -
```

#[[## Multiarch build and push to registry]]#

Multi arch build and push directly to remote registry. First create a builder in buildx
to enable multi arch builds 

```
docker buildx create --name multibuilder --platform linux/amd64,linux/arm/v7,linux/arm64/v8 --use
```

Run the maven instruction

```
mvn exec:exec@buildpush
```

Alternative with pure commands

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


#[[## Dealing with SSL/TLS]]#

Generate some private keys and truststores

```
keytool -genkey \
    -alias ${artifactId}  \
    -storepass password \
    -keyalg RSA \
    -storetype PKCS12 \
    -dname "cn=${artifactId}" \
    -validity 365000 \
    -keystore tls/keystore.p12

keytool -export \
    -alias ${artifactId} \
    -rfc \
    -storepass password \
    -keystore tls/broker-keystore.p12 \
    -file tls/${artifactId}.pem

FILES=tls/trusted-certs/*
for f in $FILES
do
#[[    full="${f##*/}"]]#
#[[    extension="${full##*.}"]]#
#[[    filename="${full%.*}"]]#
    echo "importing $full in alias $filename"

    keytool -import \
        -alias $filename \
        -storepass password\
        -storetype PKCS12 \
        -noprompt \
        -keystore tls/truststore.p12 \
        -file $f
done

keytool -list -storepass password -keystore tls/keystore.p12 -v
keytool -list -storepass password -keystore tls/truststore.p12 -v

base64 tls/truststore.p12>tls/truststore.base64
base64 tls/keystore.p12>tls/keystore.base64

```