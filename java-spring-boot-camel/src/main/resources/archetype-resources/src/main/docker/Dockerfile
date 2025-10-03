ARG TEMURIN_IMAGE_VERSION

FROM eclipse-temurin:${TEMURIN_IMAGE_VERSION} as builder
WORKDIR /builds
COPY target/*.jar application.jar
RUN java -Djarmode=layertools -jar application.jar extract

ARG TEMURIN_IMAGE_VERSION

FROM eclipse-temurin:${TEMURIN_IMAGE_VERSION}

USER root

ARG TEMURIN_IMAGE_VERSION
ARG PROJECT_ARTIFACTID
ARG PROJECT_VERSION
ARG OPENTELEMETRY_VERSION

RUN useradd -u 1000 appuser

WORKDIR /deployments

ENV PROJECT_ARTIFACTID=${PROJECT_ARTIFACTID} \
    PROJECT_VERSION=${PROJECT_VERSION} \
    TEMURIN_IMAGE_VERSION=${TEMURIN_IMAGE_VERSION} \
    OPENTELEMETRY_VERSION=${OPENTELEMETRY_VERSION}

RUN curl https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${OPENTELEMETRY_VERSION}/opentelemetry-javaagent.jar -Lo /opt/opentelemetry-javaagent.jar

ENV JAVA_TOOL_OPTIONS=-javaagent:/opt/opentelemetry-javaagent.jar \
    OTEL_JAVAAGENT_ENABLED=false \
    OTEL_EXPORTER_OTLP_ENDPOINT=http://o11y_otel:4318 \
    OTEL_RESOURCE_ATTRIBUTES=service.name=${PROJECT_ARTIFACTID},service.namespace=${PROJECT_ARTIFACTID}-ns,service.instance.id=${PROJECT_ARTIFACTID}-cnt,service.version=${PROJECT_VERSION}

COPY --from=builder /builds/dependencies/ /deployments/
COPY --from=builder /builds/spring-boot-loader/ /deployments/
COPY --from=builder /builds/snapshot-dependencies/ /deployments/
COPY --from=builder /builds/application/ /deployments/

USER 1000

EXPOSE 8080 8081

ENTRYPOINT ["java","org.springframework.boot.loader.launch.JarLauncher"]
