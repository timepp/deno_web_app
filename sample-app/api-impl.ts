// deno-lint-ignore-file require-await
import { BackendAPI } from './api.ts'
import { sendStreamToClient } from './stream-handler.ts'

export const apiImpl: BackendAPI = {
    getNetworkInfo: async function (name: string) {
        const ni = Deno.networkInterfaces()
        return ni.filter(n => !name || n.name === name)
    },
    runCommandAndCaptureOutput: async function (command: string, args: string[]) {
        // Generate a unique session ID
        const randomPart = Math.random().toString(36).slice(2, 11)
        const sessionId = `cmd-${Date.now()}-${randomPart}`
        
        // Start the command execution asynchronously
        (async () => {
            try {
                const cmd = new Deno.Command(command, {
                    args: args,
                    stdout: "piped",
                    stderr: "piped",
                })
                
                const process = cmd.spawn()
                
                // Stream stdout
                const textDecoderStream = new TextDecoderStream()
                process.stdout.pipeTo(textDecoderStream.writable)
                const reader = textDecoderStream.readable.getReader()
                
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    sendStreamToClient(sessionId, value, false)
                }
                
                // Wait for process to complete
                const status = await process.status
                
                // Send completion message
                if (!status.success) {
                    sendStreamToClient(sessionId, `\nCommand exited with code ${status.code}`, true)
                } else {
                    sendStreamToClient(sessionId, '', true)
                }
            } catch (error) {
                sendStreamToClient(sessionId, `\nError: ${error}`, true)
            }
        })()
        
        // Immediately return the session ID
        return sessionId
    }
}
