#!/bin/sh

usage() {
    printf 'Usage: jcamelspring [--cxf]\n'
    printf '  --cxf  Generate a Camel Spring Boot project with CXF SOAP support.\n'
}

cxf_support=false
for argument in "$@"; do
    case "$argument" in
        --cxf) cxf_support=true ;;
        -h|--help) usage; exit 0 ;;
        *) printf 'Unknown argument: %s\n' "$argument" >&2; usage >&2; exit 2 ;;
    esac
done

mvn archetype:generate \
    -DarchetypeCatalog=local \
    -DarchetypeGroupId=net.alainpham.applate \
    -DarchetypeArtifactId=java-spring-boot-camel \
    -DarchetypeVersion=1.0.0 \
    "-DcxfSupport=$cxf_support"
