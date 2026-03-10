// Stream handler for managing WebSocket streaming sessions
import { getClientForSession, unregisterSession } from '../session-registry.ts'

// Send stream data to the specific client that initiated the command
export function sendStreamToClient(sessionId: string, data: string, done: boolean) {
    const client = getClientForSession(sessionId)
    
    if (!client) {
        console.warn(`No client found for session ${sessionId}`)
        return
    }
    
    if (client.readyState !== WebSocket.OPEN) {
        console.warn(`Client socket for session ${sessionId} is not open`)
        unregisterSession(sessionId)
        return
    }
    
    const message = JSON.stringify({
        type: 'stream',
        sessionId,
        data,
        done
    })
    
    client.send(message)
    
    // Clean up when done
    if (done) {
        unregisterSession(sessionId)
    }
}
