#!/bin/sh

# This script regenerates the static js bindings for the api.proto file
# You will need protoc (3.2.0) and grpc-tools (which installs grpc_tools_node_protoc_plugin) installed for this to run properly
./../node_modules/grpc-tools/bin/protoc \
    --js_out=import_style=commonjs_strict,binary:./ \
    --grpc_out=generate_package_definition:./ \
    --plugin=protoc-gen-grpc=./../node_modules/grpc-tools/bin/grpc_node_plugin ./api.proto

# commonjs_strict is broken (see https://github.com/grpc/grpc-node/issues/1445).
# To fix it, we need to tweak the require at the top of the api_grpc_pb file
# to account for the extra "walletrpc" package name.
sed -i "s/require('.\/api_pb.js')/require('.\/api_pb.js').walletrpc/" api_grpc_pb.js
