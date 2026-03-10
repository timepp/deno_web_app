// Global session registry for mapping session IDs to WebSocket clients
// This allows deno-ui.ts to register sessions without circular dependencies

const sessionToClient = new Map<string, WebSocket>()

export function registerSession(sessionId: string, client: WebSocket) {
    sessionToClient.set(sessionId, client)
}

export function getClientForSession(sessionId: string): WebSocket | undefined {
    return sessionToClient.get(sessionId)
}

export function unregisterSession(sessionId: string) {
    sessionToClient.delete(sessionId)
}

// Check if a result looks like a session ID
export function isSessionId(value: unknown): value is string {
    return typeof value === 'string' && value.startsWith('cmd-')
}
