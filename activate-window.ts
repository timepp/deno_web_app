// Use Deno FFI to activate an existing window on Windows

export function activateWindow(windowTitle: string): boolean {
    if (Deno.build.os !== 'windows') {
        return false
    }

    try {
        const user32 = Deno.dlopen("user32.dll", {
            FindWindowA: {
                parameters: ["pointer", "pointer"],
                result: "pointer",
            },
            SetForegroundWindow: {
                parameters: ["pointer"],
                result: "bool",
            },
            ShowWindow: {
                parameters: ["pointer", "i32"],
                result: "bool",
            },
            IsIconic: {
                parameters: ["pointer"],
                result: "bool",
            }
        });
        
        const windowNamePtr = new TextEncoder().encode(windowTitle + "\0");
        const hWnd = user32.symbols.FindWindowA(
            null,
            Deno.UnsafePointer.of(windowNamePtr)
        );
        
        if (hWnd && Deno.UnsafePointer.value(hWnd) !== 0n) {
            // If window is minimized, restore it first
            if (user32.symbols.IsIconic(hWnd)) {
                user32.symbols.ShowWindow(hWnd, 9); // SW_RESTORE
            }
            // Bring window to foreground
            const result = user32.symbols.SetForegroundWindow(hWnd);
            user32.close();
            return result;
        }
        
        user32.close();
        return false;
    } catch (e) {
        console.error('Error activating window:', e);
        return false;
    }
}
