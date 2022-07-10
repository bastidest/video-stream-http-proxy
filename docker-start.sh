#!/bin/bash
set -euxo pipefail

case "$1" in
    dev)
        export TS_NODE_PROJECT=./tsconfig.json
        exec node --experimental-specifier-resolution=node --inspect=0.0.0.0 --loader ./node_modules/ts-node/esm ./src/server/index.ts
    ;;
    *)
        echo "unknown subcommand '$1'"
        exit 1
    ;;
esac
