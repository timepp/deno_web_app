// Global session registry for mapping session IDs to WebSocket clients
// This allows deno-ui.ts to register sessions without circular dependencies

const sessionToClient = new Map<string, WebSocket>()

export function registerSession(sessionId: string, client: WebSocket) {
    const existingClient = sessionToClient.get(sessionId)
    if (existingClient && existingClient !== client) {
        throw new Error('Session ID is already registered')
    }
    sessionToClient.set(sessionId, client)
}

export function getClientForSession(sessionId: string): WebSocket | undefined {
    return sessionToClient.get(sessionId)
}

export function unregisterSession(sessionId: string) {
    sessionToClient.delete(sessionId)
}

export function unregisterSessionsForClient(client: WebSocket) {
    for (const [sessionId, sessionClient] of sessionToClient) {
        if (sessionClient === client) {
            sessionToClient.delete(sessionId)
        }
    }
}

// Check if a result looks like a session ID
export function isSessionId(value: unknown): value is string {
    return typeof value === 'string' && /^cmd-[A-Za-z0-9_-]{16,128}$/.test(value)
}
