// Use Deno ffi to load user32.dll and call SetWindowPos to change the window size.

export function changeWindowSize(windowTitle: string, windowClass: string|null, x: number, y: number, width: number, height: number) {
    const user32 = Deno.dlopen("user32.dll", {
        FindWindowA: {
          parameters: ["pointer", "pointer"],
          result: "pointer",
        },
        SetWindowPos: {
          parameters: ["pointer", "pointer", "i32", "i32", "i32", "i32", "u32"],
          result: "bool",
        },
      });
      
      const nullptr = Deno.UnsafePointer.create(0n);
      
      function findWindow(className: string | null, windowName: string | null): Deno.PointerValue {
        const classNamePtr = className ? new TextEncoder().encode(className + "\0") : null;
        const windowNamePtr = windowName ? new TextEncoder().encode(windowName + "\0") : null;
        return user32.symbols.FindWindowA(
          classNamePtr ? Deno.UnsafePointer.of(classNamePtr) : null,
          windowNamePtr ? Deno.UnsafePointer.of(windowNamePtr) : null
        );
      }
      
      function setWindowPos(hWnd: Deno.PointerValue, x: number, y: number, cx: number, cy: number, uFlags: number): boolean {
        return user32.symbols.SetWindowPos(hWnd, nullptr, x, y, cx, cy, uFlags);
      }
      
      // Example usage
      const hWnd = findWindow(windowClass, windowTitle);
      
      if (hWnd) {
        return setWindowPos(hWnd, x, y, width, height, 0);
      } else {
        return false;
      }
}
