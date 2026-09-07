import * as ma from './memory-asset.ts'

const bootstrapFiles = [
    'frontend/style.css',
    'frontend/ui.ts',
    'frontend/index.html',
    'frontend/logo.drawio.svg',
    'api-impl.ts',
    'api.ts',
    'app.ts',
    'build-release-assets.ts',
    'release-assets.ts',
    '.vscode/settings.json',
    '.vscode/tasks.json'
]

const files = bootstrapFiles.map(f => {
    return {
        name: f,
        path: `sample-apps/full/${f}`,
    }
})

const version = JSON.parse(Deno.readTextFileSync('deno.json')).version

ma.createMemoryAssets(files, 'bootstrap-assets.ts', f => {
    if (f.name === 'release-assets.ts') {
        const content = `export const assets = undefined // this file will be replaced by the build script`
        return new TextEncoder().encode(content)
    } else if (f.name.endsWith('.ts')) {
        // When debugging the full sample, use the local package entry point.
        // while when generating app bootstrap code, we want to use `jsr:@timepp/dui`.
        // so we need to replace it when building the template.
        const localContent = Deno.readTextFileSync(f.path)
        const content = localContent
            .replace('../../index.ts', 'jsr:@timepp/dui@' + version)
            .replace('../client.ts', 'jsr:@timepp/dui@' + version + '/client')
        return new TextEncoder().encode(content)
    }
    return null
})

console.log('Bootstrap assets generated successfully in bootstrap-assets.ts')