#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
SOURCE_DIR="$PROJECT_ROOT/nodejs-express/public"

# Validate the source before replacing any template assets.
[ -f "$SOURCE_DIR/index.html" ]

for destination in \
    "$PROJECT_ROOT/java-spring-boot/src/main/resources/archetype-resources/src/main/resources/static" \
    "$PROJECT_ROOT/java-spring-boot-camel/src/main/resources/archetype-resources/src/main/resources/static" \
    "$PROJECT_ROOT/java-quarkus-camel/src/main/resources/archetype-resources/src/main/resources/META-INF/resources"
do
    rm -rf -- "$destination"
    mkdir -p -- "$destination"
    cp -R "$SOURCE_DIR/." "$destination/"
done
