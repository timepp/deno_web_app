@echo off

pushd "%~dp0"

@echo Building sample `custom-html` assets
pushd "sample-apps/custom-html"
call deno run -A build-release-assets.ts
popd

