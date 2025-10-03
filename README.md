# 🚀 Applate 🚀

- [🚀 Applate 🚀](#-applate-)
  - [Installation](#installation)
  - [Java](#java)
  - [Bootstrap a project](#bootstrap-a-project)
  - [Create a Spring Boot Camel Project](#create-a-spring-boot-camel-project)
  - [Create a Spring Boot Project](#create-a-spring-boot-project)
  - [Create a Quarkus Camel Project](#create-a-quarkus-camel-project)
  - [Create a Plain Java Project](#create-a-plain-java-project)
  - [Observability Stack](#observability-stack)
    - [Grafana Dashboard For Apache Camel](#grafana-dashboard-for-apache-camel)
  - [Install Prometheus \& Grafana on local docker engine for testing](#install-prometheus--grafana-on-local-docker-engine-for-testing)
    - [Create docker network for internal dns resolution](#create-docker-network-for-internal-dns-resolution)
    - [Run a smoke-test-app written with quarkus](#run-a-smoke-test-app-written-with-quarkus)
    - [Run Prometheus](#run-prometheus)
    - [Run Grafana](#run-grafana)
    - [Delete everything](#delete-everything)
  - [Install Prometheus \& Grafana on kubernetes](#install-prometheus--grafana-on-kubernetes)
  - [Current versions for plain java pojects](#current-versions-for-plain-java-pojects)
  - [Current versions for spring boot used](#current-versions-for-spring-boot-used)
  - [Current versions for quarkus used](#current-versions-for-quarkus-used)
  - [Next steps for this small project](#next-steps-for-this-small-project)

A set of application templates that includes observability to just start code and be ready to deploy in production and be monitored.
* Monitoring Open Telemetry
* HTTP Rest with OpenAPI / SwaggerUI
* Websockets

It also contains comprehensive Grafana Dashboard for performance monitoring on metrics logs traces profiles collected through Prometheus, Loki, Tempo, Pyroscope.

## Installation

## Java

```
mvn -f java-spring-boot/pom.xml install
mvn -f java-plain/pom.xml install
mvn -f java-spring-boot-camel/pom.xml install
mvn -f java-quarkus-camel/pom.xml install

cd helper/scripts ; sudo ./install.sh ; cd -
```

## Bootstrap a project

## Create a Spring Boot Camel Project

The following is a Spring Boot archetype

```
mvn archetype:generate \
    -DarchetypeGroupId=net.alainpham \
    -DarchetypeArtifactId=spring-boot-camel \
    -DarchetypeCatalog=local \
    -DarchetypeVersion=1.0.0
```

## Create a Spring Boot Project

The following is a Spring Boot archetype

```
mvn archetype:generate \
    -DarchetypeGroupId=net.alainpham \
    -DarchetypeArtifactId=spring-boot \
    -DarchetypeCatalog=local \
    -DarchetypeVersion=1.0.0
```

## Create a Quarkus Camel Project

The following is a Quarkus archetype

```
mvn archetype:generate \
    -DarchetypeGroupId=net.alainpham \
    -DarchetypeArtifactId=quarkus-camel \
    -DarchetypeCatalog=local \
    -DarchetypeVersion=1.0.0
```

## Create a Plain Java Project

```
mvn archetype:generate \
    -DarchetypeGroupId=net.alainpham \
    -DarchetypeArtifactId=plain-java \
    -DarchetypeCatalog=local \
    -DarchetypeVersion=1.0.0
```

## Observability Stack

### Grafana Dashboard For Apache Camel

The dashboard that you can import can be found [here](camel-monitoring/camel-dashboards-for-import/apache-camel-micrometer.json)

In camel 2 we relied on JMX exporter. For Camel 3 & 4, the dashboard now uses metrics exposed by the micrometer library. This offers the same dashboard accross all flavors like Camel Spring, Camel Quarkus and Camel K.

Minimal Apache Camel version required with the changes to micrometer naming convention

- Apache Camel 3.21+
- Apache Camel 4.0.0-M3

ref : [https://issues.apache.org/jira/browse/CAMEL-19193](https://issues.apache.org/jira/browse/CAMEL-19193)

It gives comprehensive metrics for performance monitoring. It focuses on monitoring route execution rate and average executions times that is broken down to processors & routes. You can use it to find your bottlenecks and detect degradations in quality of service.

Videos based on the JMX exporter version (micrometer version to come) : 
Here : http://www.youtube.com/watch?v=0LDgv1nIk-Y
or here : https://odysee.com/@alainpham:8/apache-camel-monitoring-prometheus-grafana:c 

[![Grafana](assets/grafana-dash-sample.png)](http://www.youtube.com/watch?v=0LDgv1nIk-Y)

## Install Prometheus & Grafana on local docker engine for testing

### Create docker network for internal dns resolution

```
docker network create --driver=bridge --subnet=172.22.0.0/16 --gateway=172.22.0.1 camelnet
```

### Run a smoke-test-app written with quarkus

```
docker run -d \
    --name=smoke-test-app-quarkus \
    --net camelnet \
    -p 7080:8080 \
    alainpham/smoke-test-app:2.0.1
```

### Run Prometheus

```
docker run -d \
    --name=camel-prometheus \
    --net camelnet \
    -p 9090:9090 \
    -v $(pwd)/camel-monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro \
    prom/prometheus:v2.45.0
```

### Run Grafana

```
docker run -d \
    --name=camel-grafana \
    --net camelnet \
    -p 3000:3000 \
    -e GF_SECURITY_ADMIN_PASSWORD=password \
    -v $(pwd)/camel-monitoring/grafana-datasources.yml:/etc/grafana/provisioning/datasources/grafana-datasources.yml:ro \
    -v $(pwd)/camel-monitoring/camel-dashboards/:/etc/grafana/provisioning/dashboards:ro \
    grafana/grafana:10.0.1

```

### Delete everything

```
docker stop camel-grafana camel-prometheus smoke-test-app-quarkus

docker rm camel-grafana camel-prometheus smoke-test-app-quarkus

docker network rm camelnet
```

## Install Prometheus & Grafana on kubernetes

Use these commands if you want to quickly test the archetype out including some monitoring

```
WIP
```


## Current versions for plain java pojects

| Components                 | Version          |
|----------------------------|------------------|
| java                       | 17               |
| camel-version              | 4.0.1            |
| maven-compiler-plugin      | 3.11.0           |
| maven-dependency-plugin    | 3.6.0            |
| maven-jar-plugin           | 3.3.0            |
| logback-version            | 1.4.11           |


## Current versions for spring boot used

| Components                   | Version          |
|------------------------------|------------------|
| java                         | 17               |
| maven-compiler-plugin        | 3.11.0           |
| camel-version                | 4.0.1            |
| spring-boot-version          | 3.1.4            |
| swagger-ui-version           | 3.52.5           |
| swagger-codegen-version      | 3.0.46	          |
| (cxf-codegen-plugin-version) | (4.0.3) WIP      |
| logstash-encoder-version     | 7.4              |
| webjars-locator-version      | 0.47             |
| jmx_prometheus_javaagent     | 0.20.0           | 
| run-java-version             | 1.3.8            |
| temurin-image-version        | 17.0.8.1_1-jre   |


## Current versions for quarkus used

| Components                 | Version          |
|----------------------------|------------------|
| java                       | 17               |
| camel-version              | 4.0.0            |
| quarkus-version            | 3.4.1    	    |
| maven-compiler-plugin      | 3.11.0	        |
| surefire-plugin-version    | 3.1.2            |
| temurin-image-version      | 17.0.8.1_1-jre   |

## Next steps for this small project

* Add opentelemetry tracing and send data to Grafana Tempo.
* Link metrics to traces.
* Make a video on Grafana dashboard and the newer micrometer prometheus metrics