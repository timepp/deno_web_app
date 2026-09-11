import { transformWithEsbuild, type Plugin, type ViteDevServer } from 'npm:vite@6.3.5'

// Keep the .ts suffix so Vite applies its TypeScript transform to the virtual module.
const virtualClientId = '\0deno-ui-client.ts'
const clientSpecifier = /^(?:jsr:)?@timepp\/dui(?:@[^/]+)?\/client$/
const inlineUIEntryPath = '/_dui/inline-entry.js'
const virtualInlineUIId = '\0deno-ui-inline-entry.js'
const remoteEntryPath = '/_dui/remote-entry'
const remoteModulePrefix = '\0deno-ui-remote:'

async function loadClientSource(): Promise<string> {
    const url = new URL('./client.ts', import.meta.url)
    if (url.protocol === 'file:') return await Deno.readTextFile(url)

    const response = await fetch(url)
    if (!response.ok) throw new Error(`Unable to load Deno UI client: ${response.status} ${response.statusText}`)
    return await response.text()
}

export function createDenoUIHtml(entry: string, title = 'Deno UI'): string {
    const escapedTitle = title.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    return `<!doctype html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapedTitle}</title>
</head>
<body>
    <script type="module" src="${entry}"></script>
</body>
</html>
`
}

export function denoUIClientPlugin(): Plugin {
    return {
        name: 'deno-ui-client',
        enforce: 'pre',
        resolveId(id) {
            return clientSpecifier.test(id) ? virtualClientId : null
        },
        async load(id) {
            if (id !== virtualClientId) return null
            return await transformWithEsbuild(await loadClientSource(), 'deno-ui-client.ts', {
                loader: 'ts',
                target: 'esnext'
            })
        }
    }
}

function asFunctionExpression(source: string): string {
    const trimmed = source.trim()
    if (trimmed.includes('[native code]')) {
        throw new Error('Inline UI must be a JavaScript or TypeScript function')
    }
    const arrowFunction = /^(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/.test(trimmed)
    if (/^(?:async\s+)?function\b/.test(trimmed) || arrowFunction) return trimmed
    if (trimmed.startsWith('async ')) return `async function ${trimmed.slice(6)}`
    return `function ${trimmed}`
}

export function inlineUIPlugin(initializerSource: string): Plugin {
    const initializer = asFunctionExpression(initializerSource)
    return {
        name: 'deno-ui-inline-ui',
        enforce: 'pre',
        resolveId(id) {
            return id === inlineUIEntryPath ? virtualInlineUIId : null
        },
        load(id) {
            if (id !== virtualInlineUIId) return null
            return `
import { createClient } from 'jsr:@timepp/dui/client'
const initializeUI = ${initializer}
await initializeUI(createClient())
`
        }
    }
}

export function getInlineUIEntryPath(): string {
    return inlineUIEntryPath
}

export function remoteUIPlugin(entryUrl: URL): Plugin {
    const entryId = `${remoteEntryPath}${new URL(entryUrl).pathname.match(/\.[^./]+$/)?.[0] ?? '.ts'}`

    return {
        name: 'deno-ui-remote-ui',
        enforce: 'pre',
        resolveId(id, importer) {
            if (id === entryId) return remoteModulePrefix + entryUrl.href

            if (importer?.startsWith(remoteModulePrefix) && (id.startsWith('./') || id.startsWith('../'))) {
                const importerUrl = importer.slice(remoteModulePrefix.length)
                return remoteModulePrefix + new URL(id, importerUrl).href
            }

            if (id.startsWith('https://') || id.startsWith('http://')) {
                return remoteModulePrefix + id
            }
            return null
        },
        async load(id) {
            if (!id.startsWith(remoteModulePrefix)) return null
            const url = id.slice(remoteModulePrefix.length)
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`Unable to load remote UI module ${url}: ${response.status} ${response.statusText}`)
            }
            const source = await response.text()
            const extension = new URL(url).pathname.match(/\.([^.\/]+)$/)?.[1]
            if (extension === 'ts' || extension === 'tsx') {
                return await transformWithEsbuild(source, new URL(url).pathname, {
                    loader: extension,
                    target: 'esnext'
                })
            }
            return source
        }
    }
}

export function getRemoteUIEntryPath(entryUrl: URL): string {
    return `${remoteEntryPath}${entryUrl.pathname.match(/\.[^./]+$/)?.[0] ?? '.ts'}`
}

export function generatedHtmlPlugin(html: string): Plugin {
    return {
        name: 'deno-ui-generated-html',
        configureServer(server: ViteDevServer) {
            server.middlewares.use(async (req, res, next) => {
                const requestUrl = (req as { url?: string }).url
                const pathname = new URL(requestUrl ?? '/', 'http://localhost').pathname
                if (pathname !== '/' && pathname !== '/index.html') {
                    next()
                    return
                }
                try {
                    const transformed = await server.transformIndexHtml(pathname, html)
                    res.statusCode = 200
                    res.setHeader('Content-Type', 'text/html; charset=utf-8')
                    res.end(transformed)
                } catch (error) {
                    next(error as Error)
                }
            })
        }
    }
}
