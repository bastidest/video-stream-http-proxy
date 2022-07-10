#!/bin/bash
set -euo pipefail

source .env

export COMPOSE_PROJECT_NAME=onvif-client

DOCKER_PWD=$(pwd)
DOCKER_USER="$(id -u):$(id -g)"

function _docker_cmd() {
    local ti_arg="-t"

    # if tty is available also open input
    if [ -t 1 ] ; then
        ti_arg="${ti_arg}i"
    fi

    docker run "$ti_arg" --rm -u "$DOCKER_USER" -v "$(pwd)":"$(pwd)" -w "$(pwd)" "$@"
}

function _npm() {
    _docker_cmd "node@$NODE_IMAGE" npm "$@"
}

function _node() {
    _docker_cmd "node@$NODE_IMAGE" node "$@"
}

function _node_run() {
    _docker_cmd "node@$NODE_IMAGE" "$@"
}

# if is interactive shell, define aliases
if [[ $- == *i* ]] ; then
    alias npm="_npm"
    alias node="_node"
fi
