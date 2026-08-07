#!/bin/bash -eu

npm ci
npm run build:fuzz

compile_javascript_fuzzer server fuzz/server.cjs
