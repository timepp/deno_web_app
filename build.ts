import * as ma from './memory-asset.ts'

const bootstrapFiles = [
    'frontend/index.html',
    'frontend/ui.ts',
    'api-impl.ts',
    'api.ts',
    'app.ts',
    'build.ts',
    'release-assets.ts',
    'websocket-client.ts',
    '.vscode/settings.json'
]

const files = bootstrapFiles.map(f => {
    return {
        name: f,
        path: `sample-app/${f}`,
    }
})

ma.createMemoryAssets(files, 'bootstrap-assets.ts', f => {
    if (f.name === 'release-assets.ts') {
        const content = `export const assets = undefined // this file will be replaced by the build script`
        return new TextEncoder().encode(content)
    } else if (f.name.endsWith('.ts')) {
        // when debug in sample-app, we want to use `../index.ts`,
        // while when generating app bootstrap code, we want to use `jsr:@timepp/dui`.
        // so we need to replace it when building the template.
        const localContent = Deno.readTextFileSync(f.path)
        const content = localContent.replace('../index.ts', 'jsr:@timepp/dui')
        return new TextEncoder().encode(content)
    }
    return null
})
