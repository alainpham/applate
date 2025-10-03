#!/bin/sh
mvn archetype:generate \
    -DarchetypeCatalog=local \
    -DarchetypeGroupId=net.alainpham.applate \
    -DarchetypeArtifactId=java-quarkus-camel \
    -DarchetypeVersion=1.0.0
