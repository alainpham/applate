#!/bin/sh
rm -r ../../java-spring-boot/src/main/resources/archetype-resources/src/main/resources/static/*
cp -R ../js-front/static/* ../../java-spring-boot/src/main/resources/archetype-resources/src/main/resources/static/

rm -r ../../java-spring-boot-camel/src/main/resources/archetype-resources/src/main/resources/static/*
cp -R ../js-front/static/* ../../java-spring-boot-camel/src/main/resources/archetype-resources/src/main/resources/static/

rm -r ../../java-quarkus-camel/src/main/resources/archetype-resources/src/main/resources/META-INF/resources/*
cp -R ../js-front/static/* ../../java-quarkus-camel/src/main/resources/archetype-resources/src/main/resources/META-INF/resources/

