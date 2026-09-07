export type APIClient<T extends object> = {
    [K in keyof T]: T[K] extends (...args: infer Args) => infer Result
        ? (...args: Args) => Promise<Awaited<Result>>
        : never
}

type PendingRequest = {
    resolve: (value: unknown) => void
    reject: (reason: Error) => void
}

type StreamSubscriber = {
    onData: (data: string) => void
    onComplete: () => void
}

export class RPCError extends Error {
    constructor(public readonly code: string, message: string) {
        super(message)
        this.name = 'RPCError'
    }
}

let ws: WebSocket | null = null
let connecting: Promise<WebSocket> | null = null
let requestID = 100
let windowPlacementTimer: ReturnType<typeof setInterval> | undefined
const pendingRequests = new Map<number, PendingRequest>()
const streamSubscribers = new Map<string, StreamSubscriber>()
const browser = globalThis as typeof globalThis & Window

function getStartupContext() {
    const startupParams = new URLSearchParams(browser.location.search)
    const launchToken = startupParams.get('_duiToken')
    const sessionToken = launchToken ?? browser.sessionStorage.getItem('_duiToken')

    if (launchToken) {
        browser.sessionStorage.setItem('_duiToken', launchToken)
        const sanitizedUrl = new URL(browser.location.href)
        sanitizedUrl.searchParams.delete('_duiToken')
        browser.history.replaceState(browser.history.state, '', sanitizedUrl)
    }

    return { startupParams, sessionToken }
}

let lastWindowPlacement = [0, 0, 0, 0]
function saveWindowPlacement() {
    const placement = [browser.screenX, browser.screenY, browser.outerWidth, browser.outerHeight]
    if (placement.every((value, index) => value === lastWindowPlacement[index])) return
    lastWindowPlacement = placement
    ws?.send(JSON.stringify({ type: 'system.window-placement', placement }))
}

export async function connectWebSocket(): Promise<void> {
    await getWebSocket()
}

function getWebSocket(): Promise<WebSocket> {
    if (ws?.readyState === WebSocket.OPEN) return Promise.resolve(ws)
    if (connecting) return connecting

    connecting = new Promise<WebSocket>((resolve, reject) => {
        const { startupParams, sessionToken } = getStartupContext()
        if (!sessionToken) {
            reject(new Error('Missing Deno UI session token'))
            return
        }

        const protocol = browser.location.protocol
        const host = browser.location.hostname
        const port = startupParams.get('_apiPort') || browser.location.port || (protocol === 'https:' ? '443' : '80')
        const socketUrl = `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}:${port}/_dui/ws?token=${encodeURIComponent(sessionToken)}`
        const socket = new WebSocket(socketUrl)

        socket.onopen = () => {
            ws = socket
            if (startupParams.has('_saveWindow') && windowPlacementTimer === undefined) {
                windowPlacementTimer = setInterval(saveWindowPlacement, 1000)
            }
            resolve(socket)
        }
        socket.onerror = () => reject(new Error('Failed to connect to the Deno UI service'))
        socket.onclose = () => {
            if (ws === socket) ws = null
            connecting = null
            const error = new Error('Deno UI service connection closed')
            for (const pending of pendingRequests.values()) pending.reject(error)
            pendingRequests.clear()
        }
        socket.onmessage = event => {
            let message: Record<string, unknown>
            try {
                const value: unknown = JSON.parse(String(event.data))
                if (typeof value !== 'object' || value === null) throw new Error('Message is not an object')
                message = value as Record<string, unknown>
            } catch (error) {
                console.error('Ignored invalid message from Deno UI service:', error)
                return
            }
            if (message.type === 'stream') {
                if (typeof message.sessionId !== 'string') return
                const subscriber = streamSubscribers.get(message.sessionId)
                if (subscriber) {
                    if (typeof message.data === 'string') subscriber.onData(message.data)
                    if (message.done) {
                        subscriber.onComplete()
                        streamSubscribers.delete(message.sessionId)
                    }
                }
                return
            }

            if (message.type !== 'rpc.response' || !Number.isSafeInteger(message.id)) {
                console.error('Ignored unknown message from Deno UI service:', message)
                return
            }
            const id = message.id as number
            const pending = pendingRequests.get(id)
            if (!pending) return
            pendingRequests.delete(id)
            if (typeof message.error === 'object' && message.error !== null) {
                const error = message.error as Record<string, unknown>
                const code = typeof error.code === 'string' ? error.code : 'UNKNOWN_ERROR'
                const errorMessage = typeof error.message === 'string' ? error.message : 'Unknown RPC error'
                pending.reject(new RPCError(code, errorMessage))
            } else {
                pending.resolve(message.result)
            }
        }
    }).finally(() => {
        connecting = null
    })

    return connecting
}

async function callAPI(method: string, args: unknown[]): Promise<unknown> {
    const socket = await getWebSocket()
    const id = ++requestID
    socket.send(JSON.stringify({ type: 'rpc.request', id, method, params: args }))
    return await new Promise((resolve, reject) => pendingRequests.set(id, { resolve, reject }))
}

export function createClient<T extends object>(): APIClient<T> {
    return new Proxy({}, {
        get(_target, property) {
            if (typeof property !== 'string') return undefined
            return (...args: unknown[]) => callAPI(property, args)
        }
    }) as APIClient<T>
}

export function subscribeToStream(sessionId: string, onData: (data: string) => void, onComplete: () => void) {
    streamSubscribers.set(sessionId, { onData, onComplete })
}

export function unsubscribeFromStream(sessionId: string) {
    streamSubscribers.delete(sessionId)
}
