import * as ma from './memory-asset.ts'

const bootstrapFiles = [
    'frontend/index.html',
    'frontend/ui.ts',
    'api-impl.ts',
    'api.ts',
    'app.ts',
    'websocket-client.ts',
    '.vscode/settings.json'
]

const files = bootstrapFiles.map(f => {
    return {
        name: f,
        path: `sample-app/${f}`,
    }
})

ma.createMemoryAssets(files, 'bootstrap-assets.ts')
