ARG TEMURIN_IMAGE_VERSION

FROM eclipse-temurin:${TEMURIN_IMAGE_VERSION}

USER root

ARG TEMURIN_IMAGE_VERSION
ARG PROJECT_ARTIFACTID
ARG PROJECT_VERSION

RUN useradd -u 1000 appuser

WORKDIR /deployments

ENV PROJECT_ARTIFACTID=${PROJECT_ARTIFACTID} \
    PROJECT_VERSION=${PROJECT_VERSION} \
    TEMURIN_IMAGE_VERSION=${TEMURIN_IMAGE_VERSION}

ENV JAVA_TOOL_OPTIONS="-Dquarkus.http.host=0.0.0.0 -Djava.util.logging.manager=org.jboss.logmanager.LogManager"

# We make four distinct layers so if there are application changes the library layers can be re-used
COPY target/quarkus-app/lib/ /deployments/lib/
COPY target/quarkus-app/*.jar /deployments/
COPY target/quarkus-app/app/ /deployments/app/
COPY target/quarkus-app/quarkus/ /deployments/quarkus/

EXPOSE 8080
USER 1000

ENTRYPOINT [ "java", "-jar", "/deployments/quarkus-run.jar" ]
