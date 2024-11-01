import * as vite from 'npm:vite@5.3.3'
import {typeByExtension} from 'jsr:@std/media-types@1.0.1'
import { extname } from 'jsr:@std/path@1.0.0'
import * as enc from 'jsr:@std/encoding@1.0.1'
import { changeWindowSize } from './change-window-size.ts'

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

function startDenoWebAppService(root: string, port: number, apiImpl: {[key: string]: Function}, memoryAssets: Record<string, string> = {}) {
    const handlerCORS = async (req: Request) => {
        // handle websocket connection
        if (req.headers.get("upgrade") === "websocket") {
            const { socket, response } = Deno.upgradeWebSocket(req);
            let closeTimer = 0
            socket.onopen = () => {
                console.log("socket opened");
                clearTimeout(closeTimer)
                clients.push(socket)
            }
            socket.onmessage = async (e) => {
                const {id, cmd, args} = JSON.parse(e.data)
                console.log('received command:', cmd, args)
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
                closeTimer = setTimeout(() => {
                    if (clients.length === 0) {
                        console.log('no more clients, shutting down server')
                        ac.abort()
                    }   
                }, 2000)
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
                return new Response(content, {
                    headers: {
                        "content-type" : typeByExtension(extname(path)) || "text/plain"
                    }
                });
            }
            const file = await Deno.open(root + path);
            return new Response(file.readable, {
                headers: {
                    "content-type" : typeByExtension(extname(path)) || "text/plain"
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

const defaultDenoUIArgs = {
    appName: 'dui',
    // true: hosting the built frontend code (pure html/js/css) in deno; need to build the frontend first
    // false: hosting the frontend code in vite (for local development)
    // this need to be true when deploying the app to jsr
    release: false,
    browser: 'chrome',
    frontendRoot: '.',
    entryPoint: 'index.html',
    apiPort: 22312,
    webPort: 5173,
    // this won't take effect when `release` is false
    memoryAssets: {} as Record<string, string>,
    apiImpl: {} as {[key: string]: Function},
}

export type DenoUIArgs = typeof defaultDenoUIArgs

export async function startDenoUI(options: Partial<DenoUIArgs> = {}) {
    const args = {...defaultDenoUIArgs, ...options}

    appName = args.appName

    // try different ports if the default one is already in use
    let apiPort = args.apiPort
    let backend : Deno.HttpServer | null = null
    for (let i = 0; i < 10; i++) {
        try {
            backend = startDenoWebAppService(args.frontendRoot, apiPort, args.apiImpl, args.memoryAssets);
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
    ]
    const url = `http://localhost:${webPort}/${args.entryPoint}?_apiPort=${apiPort}`
    const browsers = args.browser === 'edge'? edge : args.browser === 'chrome'? chrome : args.browser? [args.browser] : [...chrome, ...edge]
    const wp = loadWindowPlacement()
    let cp: Deno.ChildProcess | null = null
    for (const browser of browsers) {
        console.log('trying to start browser:', browser)
        try {
            const args = [`--app=${url}`, `--new-window`]
            if (wp) {
                args.push(`--window-position=${wp.x},${wp.y}`)
                args.push(`--window-size=${wp.width},${wp.height}`)
            }
            const cmd = new Deno.Command(browser, {args})
            cp = cmd.spawn()
            break
        } catch (e) {
            console.warn('error starting browser:', e)
        }
    }

    if (!cp) {
        console.log('could not start browser. however, you can navigate to the following url to open the frontend manually:')
        console.log(url)
    } else {
        console.log('browser started, pid:', cp.pid)
    }

    if (wp) {
        for (let i = 0; i < 30; i++) {
            if (changeWindowSize(appName, null, wp.x, wp.y, wp.width, wp.height)) {
                break
            }
            await new Promise(r => setTimeout(r, 100))
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
