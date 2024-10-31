export * from './sample-app/websocket-client.ts'
export * from './deno-ui.ts'
export * from './memory-asset.ts'

if (import.meta.main) {
    // bootstrap the app
    if (Deno.args.length === 0) {
        console.error('No action specified. Supported action: create-app')
        Deno.exit(1)
    }

    if (Deno.args[0] === 'create-app') {
        if (Deno.args.length < 2) {
            console.error('Please specify the app name')
            Deno.exit(1)
        }
        await createApp(Deno.args[1])
    } else {
        console.error(`Unknown action: ${Deno.args[0]}`)
        Deno.exit(1)
    }
}

async function createApp(appName: string) {
    const assets = await import('./bootstrap-assets.ts')
    const ma = await import('./memory-asset.ts')
    ma.saveMemoryAssets(assets.assets, appName)
    console.log(`App created successfully in the subfolder '${appName}'`)
}
