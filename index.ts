export * from './sample-app/websocket-client.ts'
export * from './deno-ui.ts'
export * from './memory-asset.ts'

if (import.meta.main) {
    // bootstrap the app
    if (Deno.args.length !== 1) {
        console.error('Please provide the app folder name as an argument')
        Deno.exit(1)
    }
    const assets = await import('./bootstrap-assets.ts')
    const ma = await import('./memory-asset.ts')
    ma.saveMemoryAssets(assets.assets, Deno.args[0])
}
