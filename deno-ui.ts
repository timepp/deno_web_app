import * as vite from 'npm:vite@6.3.5'
import {typeByExtension} from 'jsr:@std/media-types@1.0.1'
import { extname } from 'jsr:@std/path@1.0.0'
import * as enc from 'jsr:@std/encoding@1.0.1'
import { changeWindowSize } from './change-window-size.ts'
import { activateWindow } from './activate-window.ts'
import * as so from "jsr:@lambdalisue/systemopen@1.0.0";
import { registerSession, isSessionId } from './session-registry.ts'
import * as tu from "jsr:@timepp/uu@1.0.6"

const clients: WebSocket[] = []
let server: Deno.HttpServer | null = null
const ac = new AbortController()
let appName = 'dui'

export type APIHandler = (...args: any[]) => unknown | Promise<unknown>
export type APIImplementation = Record<string, APIHandler>

function isErrorWithCode(e: unknown): e is { code: string } {
    return typeof e === 'object' && e !== null && 'code' in e && typeof (e as { code: unknown }).code === 'string'
}

function saveWindowPlacement(x: number, y: number, width: number, height: number) {
    // filter out invalid values (e.g. when the window is minimized)
    if (x < 0 || y < 0 || width <= 0 || height <= 0) {
        return
    }
    const data = {x, y, width, height}
    const path = Deno.env.get('APPDATA') + '/' + appName + '-window.json'
    Deno.writeTextFileSync(path, JSON.stringify(data))
}

function loadWindowPlacement() {
    const path = Deno.env.get('APPDATA') + '/' + appName + '-window.json'
    try {
        const data = JSON.parse(Deno.readTextFileSync(path))
        // fix invalid values
        if (data.x < 0 || data.y < 0 || data.width <= 0 || data.height <= 0) {
            return null
        }
        return data
    } catch {
        return null
    }
}

function startDenoWebAppService(root: string, port: number, apiImpl: APIImplementation, memoryAssets: Record<string, string> = {}, closeWhenNoClients = false): Deno.HttpServer {
    const handlerCORS = async (req: Request) => {
        // handle websocket connection
        if (req.headers.get("upgrade") === "websocket") {
            const { socket, response } = Deno.upgradeWebSocket(req);
            let closeTimer: ReturnType<typeof setTimeout> | undefined
            socket.onopen = () => {
                clients.push(socket)
                console.log("socket opened, total clients:", clients.length);
                clearTimeout(closeTimer)
            }
            socket.onmessage = async (e) => {
                const {id, cmd, args} = JSON.parse(e.data)
                const argsStr = JSON.stringify(args)
                console.log('received command:', cmd, 'args:', tu.foldString(argsStr, 320))
                if (id === 0) {
                    // system message to update window size and position
                    const [x, y, width, height] = args
                    // save the information in a file under user data directory
                    saveWindowPlacement(x, y, width, height)
                    return
                }
                try {
                    let result: unknown = `unknown command: ${cmd}`
                    if (cmd in apiImpl) {
                        const func = apiImpl[cmd as keyof typeof apiImpl]
                        result = await func.apply(apiImpl, args)
                        
                        // If the result is a session ID, register it with this socket
                        if (isSessionId(result)) {
                            registerSession(result, socket)
                            console.log(`Registered session ${result} for client`)
                        }
                    }
                    // console.log('sending response:', result)
                    socket.send(JSON.stringify({id, result}))
                } catch (_e) {
                    console.error(_e)
                    socket.send(JSON.stringify({id, result:`error: ${_e}`}))
                }
            }
            socket.onclose = () => {
                console.log("socket closed");
                const i = clients.indexOf(socket)
                if (i >= 0) {
                    clients.splice(i, 1)
                }
                console.log("socket closed, total clients:", clients.length);
                clearTimeout(closeTimer)
                if (clients.length === 0 && closeWhenNoClients) {
                    console.log('no more clients, shutting down server in 3 seconds')
                    closeTimer = setTimeout(() => {
                        if (clients.length === 0) {
                            ac.abort()
                        }
                    }, 3000)
                }
            }
            socket.onerror = (e) => {
                console.log("socket error", e);
            }
            return response;
        }

        const response = await handler(req);
        response.headers.set("Access-Control-Allow-Origin", "*");
        return response;
    }
    const handler = async (req: Request) => {
        let path = new URL(req.url).pathname;
    
        // Health check endpoint for single instance detection
        if (path === "/_health") {
            return new Response(JSON.stringify({ appName }), {
                headers: { "content-type": "application/json" }
            });
        }
    
        if(path == "/"){
            path = `/index.html`;
        }
        try {
            console.log('serving', path)
            const relativePath = path.slice(1)
            if (relativePath in memoryAssets) {
                console.log('serving from assets', relativePath)
                const content = enc.decodeBase64(memoryAssets[relativePath])
                return new Response(new Uint8Array(content).buffer, {
                    headers: {
                        "content-type" : typeByExtension(extname(path)) || "text/plain"
                    }
                });
            }
            const filePath = root + decodeURIComponent(path);
            console.log('loading file from disk:', filePath)
            const file = await Deno.open(filePath, { read: true });
            return new Response(file.readable, {
                headers: {
                    "content-type" : typeByExtension(extname(path)) || "text/plain",
                    "Cache-Control": "public, max-age=31536000, immutable"
                }
            });
        } catch (e) {
            if (isErrorWithCode(e) && e.code === "ENOENT") {
                // check from static assets
                return new Response("Not Found", { status: 404 });
            }
            return new Response("Internal Server Error", { status: 500 });
        }
    };
    
    server = Deno.serve({ port, signal:ac.signal }, handlerCORS);
    return server
}

function stopDenoWebAppService() {
    clients.forEach(c => c.close())
}

function hashString(str: string) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    return hash
}

// Check if the same app instance is already running on the given port
async function checkSameAppRunning(port: number, expectedAppName: string): Promise<boolean> {
    try {
        const response = await fetch(`http://localhost:${port}/_health`, {
            method: 'GET',
            signal: AbortSignal.timeout(1000)
        })
        if (response.ok) {
            const data = await response.json()
            return data.appName === expectedAppName
        }
        return false
    } catch {
        return false
    }
}

/**
 * Full startup configuration for Deno UI.
 */
export interface DenoUIArgs {
    /**
     * App identity used for single-instance detection and persisted window placement file name.
     * @default "dui"
     */
    appName: string

    /**
     * `true`: serve built frontend assets from Deno server.
     * `false`: use Vite dev server (local development).
     * Set to `true` for release packaging (for example JSR distribution).
     * @default false
     */
    release: boolean

    /**
     * Browser executable to launch. Supports `msedge`, `chrome`, or an absolute executable path.
     * Falls back to system default browser if launch fails.
     * @default "chrome"
     */
    browser: string

    /**
     * Browser profile to use. Set it to empty string to use the last used profile.
     * @default 'Default'
     */
    browserProfile: string

    /**
     * Launch in app window mode (`--app=` style).
     * Currently supported on Windows only.
     * @default false
     */
    appMode: boolean

    /**
     * Whether to stop the backend server when no websocket clients remain.
     * If omitted by caller, runtime defaults to `true` when `appMode` is `true`, otherwise `false`.
     * @default true if `appMode` is `true`, otherwise `false`
     */
    closeWhenNoClients: boolean

    /**
     * Frontend project root (used by Vite in non-release mode).
     * @default "."
     */
    frontendRoot: string

    /**
     * Static resource root used by Deno file hosting.
     * @default "."
     */
    resourceRoot: string

    /**
     * Frontend entry file path, relative to frontend root.
     * @default "index.html"
     */
    entryPoint: string

    /**
     * Backend API port.
     * Use `0` to auto-generate a stable default based on app name.
     * @default 0
     */
    apiPort: number

    /**
     * Frontend web port (Vite in dev mode).
     * Use `0` to auto-generate a stable default based on app name.
     * @default 0
     */
    webPort: number

    /**
     * Embedded static assets (base64 content), used only when `release` is `true`.
     * @default {}
     */
    memoryAssets: Record<string, string>

    /**
     * Backend RPC API implementation object.
     * Keys are command names and values are callable handlers.
     * @default {}
     */
    apiImpl: APIImplementation
}

const defaultDenoUIArgs: DenoUIArgs = {
    appName: 'dui',
    release: false,
    browser: 'chrome',
    browserProfile: 'Default',
    appMode: false,
    closeWhenNoClients: false,
    frontendRoot: '.',
    resourceRoot: '.',
    entryPoint: 'index.html',
    apiPort: 0,
    webPort: 0,
    memoryAssets: {},
    apiImpl: {},
}

/**
 * Start Deno UI with optional overrides.
 *
 * Type a literal object for `options` to get full IntelliSense for all fields in {@link DenoUIArgs}.
 */
export async function startDenoUI(options: Partial<DenoUIArgs> = {}) {
    const runtimeArgsFix = {
        closeWhenNoClients: (options.appMode === true) ? true : false
    }
    const cfg = {...defaultDenoUIArgs, ...runtimeArgsFix, ...options}

    appName = cfg.appName

    let appMode = Deno.build.os === 'windows'? cfg.appMode : false

    if (cfg.apiPort === 0) {
        // get default api port by hash of app name
        cfg.apiPort = 3000 + (Math.abs(hashString(`${appName} api`)) % 1000)
    }
    if (cfg.webPort === 0) {
        // get default web port by hash of app name
        cfg.webPort = 4000 + (Math.abs(hashString(`${appName} web`)) % 1000)
    }

    // Try different ports if the default one is already in use
    let apiPort = cfg.apiPort
    let backend : Deno.HttpServer | null = null
    for (let i = 0; i < 10; i++) {
        // Check if the same app instance is already running on this port (single instance mode)
        if (appMode) {
            const isSameAppRunning = await checkSameAppRunning(apiPort, appName)
            if (isSameAppRunning) {
                console.log(`${appName} is already running on port ${apiPort}, activating existing window...`)
                if (activateWindow(appName)) {
                    console.log('Existing window activated successfully')
                } else {
                    console.log('Could not activate window, but instance is running')
                }
                Deno.exit(0)
            }
        }
        
        try {
            backend = startDenoWebAppService(cfg.resourceRoot, apiPort, cfg.apiImpl, cfg.memoryAssets, cfg.closeWhenNoClients);
            console.log(`Backend server started on port ${apiPort}`)
            break
        } catch (_e) {
            console.log(`Port ${apiPort} is in use by another app, trying next port...`)
            apiPort++
        }
    }

    if (!backend) {
        console.error('Could not start backend - all ports are in use')
        Deno.exit(1)
    }
    
    let webPort = apiPort
    let frontend: vite.ViteDevServer | null = null
    // Use Vite for local development
    if (!cfg.release) {
        console.log('starting vite frontend server')
        frontend = await vite.createServer({
            root: cfg.frontendRoot
        })
        webPort = cfg.webPort
        frontend.listen(webPort)
    }
    
    const edge = [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ]
    const chrome = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        'chrome'
    ]
    const appModeParam = appMode? '&_saveWindow' : ''
    const url = `http://localhost:${webPort}/${cfg.entryPoint}?_apiPort=${apiPort}${appModeParam}`
    const browsers = cfg.browser === 'edge'? edge : cfg.browser === 'chrome'? chrome : cfg.browser? [cfg.browser] : [...chrome, ...edge]
    let cp: Deno.ChildProcess | null = null

    for (const browser of browsers) {
        console.log('trying to start browser:', browser)
        try {
            const urlArg = appMode? `--app=${url}` : url
            const args = [urlArg]
            if (cfg.browserProfile) {
                args.push(`--profile-directory=${cfg.browserProfile}`)
            }
            const cmd = new Deno.Command(browser, { args })
            cp = cmd.spawn()
            break
        } catch (e) {
            console.warn('error starting browser:', e)
        }
    }

    if (!cp) {
        appMode = false
        console.log('open with default browser: ', url)
        so.systemopen(url)
    } else {
        console.log('browser started, pid:', cp.pid)
    }

    if (appMode) {
        const wp = loadWindowPlacement()
        if (wp) {
            for (let i = 0; i < 30; i++) {
                if (changeWindowSize(appName, null, wp.x, wp.y, wp.width, wp.height)) {
                    break
                }
                await new Promise(r => setTimeout(r, 100))
            }
        }
    }

    await backend.finished
    if (frontend) {
        // console.log('closing frontend server')
        // frontend.close()
    }
    // await apiImpl.cleanUp()
    console.log('App Exit')
    Deno.exit(0)
}

export function stopDenoUI() {
    stopDenoWebAppService()
}
