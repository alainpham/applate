#!/bin/sh

usage() {
    printf 'Usage: njsexpress [project-name] [namespace]\n'
    printf 'Prompts for missing values. Namespace defaults to njs-ns.\n'
}

case "${1-}" in
    -h|--help) usage; exit 0 ;;
esac

if [ "$#" -gt 2 ]; then
    usage >&2
    exit 1
fi

project_name=${1-}
project_namespace=${2-}

while [ -z "$project_name" ]; do
    printf 'Project name: '
    if ! IFS= read -r project_name; then
        printf '\nA project name is required.\n' >&2
        exit 1
    fi
done

if [ -z "$project_namespace" ]; then
    printf 'Namespace [njs-ns]: '
    if ! IFS= read -r project_namespace; then
        printf '\nA namespace response is required.\n' >&2
        exit 1
    fi
    project_namespace=${project_namespace:-njs-ns}
fi

exec node \
    "$HOME/.m2/repository/net/alainpham/applate/templategen/templategen.js" \
    "$HOME/.m2/repository/net/alainpham/applate/nodejs-express/nodejs-express.zip" \
    nodejs-express "$project_name" \
    njs-ns "$project_namespace"
