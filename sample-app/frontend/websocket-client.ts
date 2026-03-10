let ws: WebSocket | null = null
let requestID = 100
const pendingPromises = new Map<number, (value: any) => void>()
const streamSubscribers = new Map<string, {
    onData: (data: string) => void,
    onComplete: () => void
}>()

let windowPlacement = [0, 0, 0, 0]
// Since browser won't remember app window placement, we need to save it in the app
function saveWindowPlacement() {
    const w = globalThis as any
    const wp = [w.screenX, w.screenY, w.outerWidth, w.outerHeight]
    if (wp.every((v, i) => v === windowPlacement[i])) return
    windowPlacement = wp
    ws?.send(JSON.stringify({ id: 0, cmd: 'setWindowSize', args: wp }))
}

export async function connectWebSocket() {
    await getWebSocket()
}

export async function getWebSocket(): Promise<WebSocket> {
    if (!ws) {
        const proto = window.location.protocol
        const host = window.location.hostname
        const params = new URLSearchParams(window.location.search)
        const port = params.get('_apiPort') || window.location.port || (proto === 'https:' ? '443' : '80')
        const url = (proto === 'https:' ? 'wss:' : 'ws:') + '//' + host + ':' + port
        ws = new WebSocket(url)
        if (params.get('_saveWindow') !== null) {
            setInterval(saveWindowPlacement, 1000);
        }
        ws.onclose = () => { 
            console.log('service closed.')
            // close() 
        }
        ws.onmessage = e => {
            const message = JSON.parse(e.data)
            
            // Handle stream messages
            if (message.type === 'stream') {
                const { sessionId, data, done } = message
                const subscriber = streamSubscribers.get(sessionId)
                if (subscriber) {
                    if (data) {
                        subscriber.onData(data)
                    }
                    if (done) {
                        subscriber.onComplete()
                        streamSubscribers.delete(sessionId)
                    }
                }
                return
            }
            
            // Handle RPC response messages
            const { id, result } = message
            const resolver = pendingPromises.get(id)
            if (resolver) {
                resolver(result)
                pendingPromises.delete(id)
            }
        }
        await new Promise(resolve => ws!.onopen = resolve)
    }
    return ws
}

// call api using web socket
export async function callAPI(args: IArguments, cmd?: string): Promise<unknown> {
    if (!cmd) {
        const parent = new Error().stack?.split('\n')[2].match(/at ([^(]+)/)?.[1]
        cmd = parent?.split('.').slice(-1)[0].trim()
    }
    const ws = await getWebSocket()
    ws.send(JSON.stringify({ id: ++requestID, cmd, args: [...args] }))
    return new Promise(resolve => pendingPromises.set(requestID, resolve))
}

// Subscribe to a stream session
export function subscribeToStream(
    sessionId: string,
    onData: (data: string) => void,
    onComplete: () => void
) {
    streamSubscribers.set(sessionId, { onData, onComplete })
}

// Unsubscribe from a stream session
export function unsubscribeFromStream(sessionId: string) {
    streamSubscribers.delete(sessionId)
}
