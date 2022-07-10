#!/bin/bash
set -euo pipefail

source ./source.sh

DOCKER_IMAGE_NAME=bastidest/video-stream-http-proxy

function dc() {
    local compose_env="$1"
    shift

    if [[ ! "${compose_env}" =~ ^(dev|prod)$ ]] ; then
        echo "usage: ./start.sh dc dev|prod COMMAND..."
        exit 1
    fi

    docker-compose -f "docker-compose.${compose_env}.yml" "$@"
}

function dev() {
    dc dev up --build --detach
    docker exec -it video-stream-http-proxy-backend-1 bash
}

function prod() {
    dc prod pull
    dc prod up --detach
}

function build() {
    docker build -t "${DOCKER_IMAGE_NAME}:latest" \
           -f Dockerfile.prod \
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
    prod)
        prod
        ;;
    build)
        build
        ;;
    lint)
        ensure_node_modules
        _node ./node_modules/.bin/tslint --project ./tsconfig.json
        _node ./node_modules/.bin/tsc --project ./tsconfig.json --noEmit
        ;;
    release)
        VERSION=$(git-conventional-commits version)
        echo "-- creating release for version ${VERSION}"

        echo "-- patching package{,-lock}.json"
        jq ".version=\"${VERSION}\"" package.json > package.json.tmp && mv package.json.tmp package.json
        _npm i >/dev/null

        echo "-- creating release commit"
        git commit -am"build(release): bump project version to ${VERSION}"

        echo "-- creating changelog"
        git-conventional-commits changelog --release "$VERSION" --file CHANGELOG.md

        echo "-- creating commit for changelog"
        git commit -am"doc(release): create ${VERSION} change log entry"

        echo "-- tagging version"
        git tag -a -m"build(release): ${VERSION}" "v${VERSION}"

        echo "-- building docker image"
        build

        echo "-- tagging docker image"
        docker tag "${DOCKER_IMAGE_NAME}:latest" "${DOCKER_IMAGE_NAME}:${VERSION}"

        read -r -p "-- git push? [Y/n]" response
        response=${response,,} # tolower
        if [[ $response =~ ^(yes|y| ) ]] || [[ -z $response ]]; then
            git push --atomic origin master "v${VERSION}"
        fi

        read -r -p "-- docker push? [Y/n]" response
        response=${response,,} # tolower
        if [[ $response =~ ^(yes|y| ) ]] || [[ -z $response ]]; then
            docker push "${DOCKER_IMAGE_NAME}:${VERSION}"
            docker push "${DOCKER_IMAGE_NAME}:latest"
        fi

        echo "-- RELEASE DONE"
        ;;
    *)
        echo "unknown subcommand '$1'"
        exit 1
        ;;
esac
