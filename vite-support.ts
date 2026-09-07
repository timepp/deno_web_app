import { transformWithEsbuild, type Plugin, type ViteDevServer } from 'npm:vite@6.3.5'

// Keep the .ts suffix so Vite applies its TypeScript transform to the virtual module.
const virtualClientId = '\0deno-ui-client.ts'
const clientSpecifier = /^jsr:@timepp\/dui(?:@[^/]+)?\/client$/

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
