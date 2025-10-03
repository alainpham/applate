#!/bin/sh
mvn archetype:generate \
    -DarchetypeCatalog=local \
    -DarchetypeGroupId=net.alainpham.applate \
    -DarchetypeArtifactId=java-spring-boot \
    -DarchetypeVersion=1.0.0
