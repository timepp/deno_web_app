import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { resolveStaticMounts, serveStaticMount } from './static-mounts.ts'

Deno.test('static mounts serve files and support HEAD', async () => {
    const root = await Deno.makeTempDir()
    try {
        await Deno.writeTextFile(`${root}/photo.jpg`, 'image data')
        const mounts = await resolveStaticMounts({ '/db': root })

        const response = await serveStaticMount('GET', '/db/photo.jpg', mounts)
        assertEquals(response?.status, 200)
        assertEquals(response?.headers.get('content-type'), 'image/jpeg')
        assertEquals(response?.headers.get('cache-control'), 'public, max-age=86400')
        assertEquals(await response?.text(), 'image data')

        const headResponse = await serveStaticMount('HEAD', '/db/photo.jpg', mounts)
        assertEquals(headResponse?.status, 200)
        assertEquals(headResponse?.headers.get('cache-control'), 'public, max-age=86400')
        assertEquals(headResponse?.body, null)
    } finally {
        await Deno.remove(root, { recursive: true })
    }
})

Deno.test('static mounts enforce path boundaries', async () => {
    const parent = await Deno.makeTempDir()
    const root = `${parent}/root`
    try {
        await Deno.mkdir(root)
        await Deno.writeTextFile(`${parent}/private.txt`, 'private')
        const mounts = await resolveStaticMounts({ '/db': root })

        assertEquals(await serveStaticMount('GET', '/database/file.jpg', mounts), null)
        assertEquals((await serveStaticMount('GET', '/db/../private.txt', mounts))?.status, 404)
        assertEquals((await serveStaticMount('GET', '/db/%E0%A4%A', mounts))?.status, 404)
        assertEquals((await serveStaticMount('POST', '/db/file.jpg', mounts))?.status, 405)
    } finally {
        await Deno.remove(parent, { recursive: true })
    }
})