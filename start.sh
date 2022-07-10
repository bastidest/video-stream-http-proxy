#!/bin/bash
set -euo pipefail

source ./source.sh

function dc() {
    local compose_env="$1"
    shift

    if [[ ! "${compose_env}" =~ ^(dev|prod)$ ]] ; then
        echo "usage: ./start.sh dc dev|prod COMMAND..."
        exit 1
    fi

    docker-compose -f docker-compose.yml -f "docker-compose.${compose_env}.yml" "$@"
}

function dev() {
    dc dev up --build --detach
    docker exec -it onvif-client-backend-1 bash
}

function build() {
    docker build -t bastidest/video-stream-http-proxy:latest \
           --build-arg "DOCKER_NODE_VERSION=${DOCKER_NODE_VERSION}" \
           --build-arg "DOCKER_FFMPEG_VERSION=${DOCKER_FFMPEG_VERSION}" \
           .
}

function ensure_node_modules() {
    # if node_modules directory exists and is r/w-able, all good
    if [[ -d node_modules && -w node_modules && -r node_modules ]] ; then
        return
    fi

    # if node_modules does not exist and cwd is writable, install node modules and return
    if [[ ! -d node_modules && -w . ]] ; then
        _npm i
        return
    fi

    echo "error: could not access node_modules: directory is not readable or writable, check permissions"
    exit 2
}

case "$1" in
    dc)
        shift
        dc "$@"
        ;;
    node)
        shift
        _node "$@"
        ;;
    npm)
        shift
        _npm "$@"
        ;;
    dev)
        ensure_node_modules
        dev
        ;;
    build)
        build
        ;;
    lint)
        ensure_node_modules
        _node ./node_modules/.bin/tslint --project ./tsconfig.json
        _node ./node_modules/.bin/tsc --project ./tsconfig.json --noEmit
        ;;
    *)
        echo "unknown subcommand '$1'"
        exit 1
        ;;
esac
