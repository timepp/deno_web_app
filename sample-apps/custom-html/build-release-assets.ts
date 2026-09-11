import { buildDenoUIAssets } from 'jsr:@timepp/dui/build'

await buildDenoUIAssets({
	appName: 'dui-sample-app',
	ui: new URL('./frontend/index.html', import.meta.url),
	assetsFile: new URL('./release-assets.ts', import.meta.url)
})
