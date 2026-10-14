import { assertEquals, assertRejects } from 'jsr:@std/assert@1.0.14'
import { createClient, RPCError } from './client.ts'

class FakeWebSocket {
    static readonly OPEN = 1
    static latest: FakeWebSocket

    readyState = 0
    sent: string[] = []
    onopen: (() => void) | null = null
    onerror: (() => void) | null = null
    onclose: (() => void) | null = null
    onmessage: ((event: { data: string }) => void) | null = null

    constructor(_url: string) {
        FakeWebSocket.latest = this
    }

    open() {
        this.readyState = FakeWebSocket.OPEN
        this.onopen?.()
    }

    send(data: string) {
        this.sent.push(data)
    }

    receive(message: unknown) {
        this.onmessage?.({ data: JSON.stringify(message) })
    }
}

async function waitForMessages(socket: FakeWebSocket, count: number) {
    while (socket.sent.length < count) await new Promise(resolve => setTimeout(resolve, 0))
}

Deno.test('API callbacks return awaited values and errors', async () => {
    const globals = ['WebSocket', 'location', 'document', 'sessionStorage', 'history'] as const
    const descriptors = new Map(globals.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))

    Object.defineProperties(globalThis, {
        WebSocket: { configurable: true, value: FakeWebSocket },
        location: {
            configurable: true,
            value: {
                search: '?_duiToken=test-token',
                protocol: 'http:',
                hostname: 'localhost',
                port: '8000',
                href: 'http://localhost:8000/?_duiToken=test-token'
            }
        },
        document: { configurable: true, value: { title: '' } },
        sessionStorage: {
            configurable: true,
            value: {
                getItem: () => null,
                setItem: () => undefined
            }
        },
        history: {
            configurable: true,
            value: {
                state: null,
                replaceState: () => undefined
            }
        }
    })

    try {
        type TestAPI = {
            review(callback: (value: string) => Promise<string>): Promise<string>
        }
        const api = createClient<TestAPI>()
        const resultPromise = api.review(async value => `accepted:${value}`)
        const socket = FakeWebSocket.latest
        socket.open()
        await waitForMessages(socket, 1)

        const request = JSON.parse(socket.sent[0])
        socket.receive({
            type: 'rpc.callback',
            callbackId: request.params[0].$duiCallback,
            invocationId: 1,
            params: ['file.txt']
        })
        await waitForMessages(socket, 2)
        assertEquals(JSON.parse(socket.sent[1]), {
            type: 'rpc.callback.response',
            invocationId: 1,
            result: 'accepted:file.txt'
        })

        socket.receive({ type: 'rpc.response', id: request.id, result: 'complete' })
        assertEquals(await resultPromise, 'complete')

        const failedPromise = api.review(async () => {
            throw new Error('declined')
        })
        const rejectionAssertion = assertRejects(() => failedPromise, RPCError, 'declined')
        await waitForMessages(socket, 3)
        const failedRequest = JSON.parse(socket.sent[2])
        socket.receive({
            type: 'rpc.callback',
            callbackId: failedRequest.params[0].$duiCallback,
            invocationId: 2,
            params: ['file.txt']
        })
        await waitForMessages(socket, 4)
        assertEquals(JSON.parse(socket.sent[3]), {
            type: 'rpc.callback.response',
            invocationId: 2,
            error: { message: 'declined' }
        })

        socket.receive({
            type: 'rpc.response',
            id: failedRequest.id,
            error: { code: 'HANDLER_ERROR', message: 'declined' }
        })
        await rejectionAssertion
    } finally {
        for (const name of globals) {
            const descriptor = descriptors.get(name)
            if (descriptor) Object.defineProperty(globalThis, name, descriptor)
            else delete (globalThis as Record<string, unknown>)[name]
        }
    }
})
