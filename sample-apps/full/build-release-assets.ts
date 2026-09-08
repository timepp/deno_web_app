import * as denoUI from '../../index.ts'

await denoUI.buildDenoUIAssets({
	appName: 'dui-sample-app',
	ui: new URL('./frontend/index.html', import.meta.url),
	assetsFile: new URL('./release-assets.ts', import.meta.url)
})
