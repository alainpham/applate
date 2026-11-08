#[[# Project]]# ${artifactId}

#[[## Run in dev]]#

```bash
mvn spring-boot:run
```

#if (${cxfSupport} == 'true')
#[[## Test the SOAP service]]#

With the application running, call the sample `getPersonOp` operation:

```bash
curl -i http://localhost:8080/services/soappayload \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: ""' \
  --data-binary @- <<'XML'
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:svc="http://www.demo.com/businessService">
  <soap:Body>
    <svc:queryPerson>
      <id>42</id>
    </svc:queryPerson>
  </soap:Body>
</soap:Envelope>
XML
```

Expected: HTTP `200`, with a SOAP response body containing:

```xml
<svc:person xmlns:svc="http://www.demo.com/businessService">
  <id>42</id>
  <name>Demo Person</name>
  <age>30</age>
</svc:person>
```

View the WSDL:

```bash
curl 'http://localhost:8080/services/soappayload?wsdl'
```

Optionally generate and compile Java classes from the WSDL:

```bash
mvn -Pcxfgen clean package
```

Generated classes are written to `target/generated-sources/cxf`.

#end

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
