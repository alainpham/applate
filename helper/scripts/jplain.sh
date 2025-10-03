#!/bin/sh
mvn archetype:generate \
    -DarchetypeCatalog=local \
    -DarchetypeGroupId=net.alainpham.applate \
    -DarchetypeArtifactId=java-plain \
    -DarchetypeVersion=1.0.0
