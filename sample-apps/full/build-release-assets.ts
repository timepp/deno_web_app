import * as denoUI from '../../index.ts'

await denoUI.buildDenoUIReleaseAssets({
	appName: 'dui-sample-app',
	ui: new URL('./frontend/index.html', import.meta.url),
	assetsFile: 'release-assets.ts'
})
