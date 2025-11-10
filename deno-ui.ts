import * as vite from 'npm:vite@6.3.5'
import {typeByExtension} from 'jsr:@std/media-types@1.0.1'
import { extname } from 'jsr:@std/path@1.0.0'
import * as enc from 'jsr:@std/encoding@1.0.1'
import { changeWindowSize } from './change-window-size.ts'
import * as so from "jsr:@lambdalisue/systemopen@1.0.0";

const clients: WebSocket[] = []
let server: Deno.HttpServer | null = null
const ac = new AbortController()
let appName = 'dui'

function saveWindowPlacement(x: number, y: number, width: number, height: number) {
    const data = {x, y, width, height}
    const path = Deno.env.get('APPDATA') + '/' + appName + '-window.json'
    Deno.writeTextFileSync(path, JSON.stringify(data))
}

function loadWindowPlacement() {
    const path = Deno.env.get('APPDATA') + '/' + appName + '-window.json'
    try {
        const data = JSON.parse(Deno.readTextFileSync(path))
        return data
    } catch {
        return null
    }
}

function startDenoWebAppService(root: string, port: number, apiImpl: {[key: string]: Function}, memoryAssets: Record<string, string> = {}, closeWhenNoClients = false): Deno.HttpServer {
    const handlerCORS = async (req: Request) => {
        // handle websocket connection
        if (req.headers.get("upgrade") === "websocket") {
            const { socket, response } = Deno.upgradeWebSocket(req);
            let closeTimer = 0
            socket.onopen = () => {
                clients.push(socket)
                console.log("socket opened, total clients:", clients.length);
                clearTimeout(closeTimer)
            }
            socket.onmessage = async (e) => {
                const {id, cmd, args} = JSON.parse(e.data)
                console.log('received command:', cmd)
                if (id === 0) {
                    // system message to update window size and position
                    const [x, y, width, height] = args
                    // save the information in a file under user data directory
                    saveWindowPlacement(x, y, width, height)
                    return
                }
                try {
                    let result = `unknown command: ${cmd}`
                    if (cmd in apiImpl) {
                        const func = apiImpl[cmd as keyof typeof apiImpl]
                        result = await func.apply(apiImpl, args)
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
        } catch(e){
            if((e as any).code === "ENOENT"){
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

const defaultDenoUIArgs = {
    appName: 'dui',

    // true: hosting the built frontend code (pure html/js/css) in deno; need to build the frontend first
    // false: hosting the frontend code in vite (for local development)
    // this need to be true when deploying the app to jsr
    release: false,

    // msedge,chrome, or other browser path
    // if browser is not found, it will open with the default browser
    browser: 'chrome',

    // the app mode has separate window frame
    // note that it's currently only supported on Windows
    appMode: false,

    // close the server when no clients connected
    // It will follow the appMode setting by default
    closeWhenNoClients: false,

    frontendRoot: '.',
    resourceRoot: '.',
    entryPoint: 'index.html',
    apiPort: 0,
    webPort: 0,

    // this won't take effect when `release` is false
    memoryAssets: {} as Record<string, string>,

    apiImpl: {} as {[key: string]: Function},
}

export type DenoUIArgs = typeof defaultDenoUIArgs

export async function startDenoUI(options: Partial<DenoUIArgs> = {}) {
    const runtimeArgsFix = {
        closeWhenNoClients: (options.appMode === true) ? true : false
    }
    const args = {...defaultDenoUIArgs, ...runtimeArgsFix, ...options}

    appName = args.appName

    let appMode = Deno.build.os === 'windows'? args.appMode : false

    if (args.apiPort === 0) {
        // get default api port by hash of app name
        args.apiPort = 3000 + (Math.abs(hashString(`${appName} api`)) % 1000)
    }
    if (args.webPort === 0) {
        // get default web port by hash of app name
        args.webPort = 4000 + (Math.abs(hashString(`${appName} web`)) % 1000)
    }

    // try different ports if the default one is already in use
    let apiPort = args.apiPort
    let backend : Deno.HttpServer | null = null
    for (let i = 0; i < 10; i++) {
        try {
            backend = startDenoWebAppService(args.resourceRoot, apiPort, args.apiImpl, args.memoryAssets, args.closeWhenNoClients);
            break
        } catch (_e) {
            apiPort++
        }
    }

    if (!backend) {
        console.error('could not start backend')
        Deno.exit(1)
    }
    
    let webPort = apiPort
    let frontend: vite.ViteDevServer | null = null
    // Use Vite for local development
    if (!args.release) {
        console.log('starting vite frontend server')
        frontend = await vite.createServer({
            root: args.frontendRoot
        })
        webPort = args.webPort
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
    const url = `http://localhost:${webPort}/${args.entryPoint}?_apiPort=${apiPort}${appModeParam}`
    const browsers = args.browser === 'edge'? edge : args.browser === 'chrome'? chrome : args.browser? [args.browser] : [...chrome, ...edge]
    let cp: Deno.ChildProcess | null = null

    for (const browser of browsers) {
        console.log('trying to start browser:', browser)
        try {
            const urlArg = appMode? `--app=${url}` : url
            const cmd = new Deno.Command(browser, { args: [urlArg] })
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
