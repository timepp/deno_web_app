import { typeByExtension } from 'jsr:@std/media-types@1.0.1'
import { extname, fromFileUrl, isAbsolute, relative, resolve } from 'jsr:@std/path@1.0.0'

export type StaticMounts = Record<string, string | URL>

export interface ResolvedStaticMount {
    prefix: string
    root: string
}

export async function resolveStaticMounts(mounts: StaticMounts): Promise<ResolvedStaticMount[]> {
    const resolvedMounts = await Promise.all(Object.entries(mounts).map(async ([configuredPrefix, configuredRoot]) => {
        if (!configuredPrefix.startsWith('/') || configuredPrefix.includes('?') || configuredPrefix.includes('#')) {
            throw new Error(`Static mount prefix must be an absolute URL path: ${configuredPrefix}`)
        }
        const prefix = configuredPrefix.replace(/\/+$/, '')
        if (prefix === '' || prefix === '/_dui' || prefix.startsWith('/_dui/')) {
            throw new Error(`Static mount prefix is reserved: ${configuredPrefix}`)
        }

        let root: string
        if (configuredRoot instanceof URL) {
            if (configuredRoot.protocol !== 'file:') {
                throw new Error(`Static mount root must be a local file URL: ${configuredRoot}`)
            }
            root = fromFileUrl(configuredRoot)
        } else {
            root = resolve(configuredRoot)
        }

        const realRoot = await Deno.realPath(root)
        if (!(await Deno.stat(realRoot)).isDirectory) {
            throw new Error(`Static mount root must be a directory: ${root}`)
        }
        return { prefix, root: realRoot }
    }))

    const prefixes = new Set<string>()
    for (const mount of resolvedMounts) {
        if (prefixes.has(mount.prefix)) throw new Error(`Duplicate static mount prefix: ${mount.prefix}`)
        prefixes.add(mount.prefix)
    }
    return resolvedMounts.sort((left, right) => right.prefix.length - left.prefix.length)
}

export async function serveStaticMount(
    method: string,
    pathname: string,
    mounts: ResolvedStaticMount[]
): Promise<Response | null> {
    const mount = mounts.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    if (!mount) return null
    if (method !== 'GET' && method !== 'HEAD') {
        return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })
    }

    try {
        const suffix = decodeURIComponent(pathname.slice(mount.prefix.length))
        const candidatePath = resolve(mount.root, `.${suffix}`)
        const filePath = await Deno.realPath(candidatePath)
        const relativePath = relative(mount.root, filePath)
        if (relativePath === '' || relativePath === '..' || relativePath.startsWith('../') ||
            relativePath.startsWith('..\\') || isAbsolute(relativePath)) {
            return new Response('Not Found', { status: 404 })
        }
        if (!(await Deno.stat(filePath)).isFile) return new Response('Not Found', { status: 404 })

        const headers = {
            'content-type': typeByExtension(extname(filePath)) || 'application/octet-stream',
            'cache-control': 'no-cache'
        }
        if (method === 'HEAD') return new Response(null, { headers })

        const file = await Deno.open(filePath, { read: true })
        return new Response(file.readable, { headers })
    } catch (error) {
        if (error instanceof URIError || (typeof error === 'object' && error !== null &&
            'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR'))) {
            return new Response('Not Found', { status: 404 })
        }
        console.error(`Failed to serve static mount ${pathname}:`, error)
        return new Response('Internal Server Error', { status: 500 })
    }
}