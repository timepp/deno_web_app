# DenoUI: Developing Native Applications with a Modern Tech Stack

- **Modern**: Build with modern web technologies for a responsive user interface.
- **Clean**: Use Deno to provide a fast, secure backend environment.
- **Lightweight**: Leverage existing browsers (such as Edge or Chrome) to display the application interface.
- **Typed**: TypeScript for both frontend and backend code.
- **DRY**: Minimize boilerplate by deriving the typed frontend API from the backend implementation.
- **Installation Free**: Can be packaged as a JSR component, enabling installation-free execution.

## Demos

Try the minimal demo to see how little code a Deno UI application needs. It consists of a single TypeScript file in `sample-apps/minimal` and displays the system uptime:

```bash
deno run -A jsr:@timepp/dui/examples/minimal
```

The module UI demo separates the frontend into its own TypeScript module while keeping the application small. Its source is in `sample-apps/module-ui`:

```bash
deno run -A jsr:@timepp/dui/examples/module-ui
```

For a more complete example, run the custom HTML demo. Its source is in `sample-apps/custom-html` and demonstrates a structured frontend project communicating with a local Deno backend. The application displays the machine's network interfaces:

```bash
deno run -A jsr:@timepp/dui/examples/custom-html
```

Add `--appMode` to launch the custom HTML demo in a standalone browser app window:

```bash
deno run -A jsr:@timepp/dui/examples/custom-html --appMode
```

![demo](doc/demo.png)

## Usage

### Typical usage

First, implement the backend API and export its inferred type:

```typescript
// api-impl.ts
export const apiImpl = {
    getNetworkInfo: async (name: string) => {
        const interfaces = Deno.networkInterfaces()
        return interfaces.filter(item => !name || item.name === name)
    }
}

export type BackendAPI = typeof apiImpl
```

Here, the API contract is derived directly from the implementation. Larger projects can declare `BackendAPI` separately when they need an explicit, stable contract.

Then, create the typed frontend client:

```typescript
// api.ts
import { createClient } from "jsr:@timepp/dui/client"
import type { BackendAPI } from './api-impl.ts'

export const api = createClient<BackendAPI>()
```

Frontend modules can now call the backend through the typed client:

```typescript
import { api } from '../api.ts'

const networkInfo = await api.getNetworkInfo('')
```

Finally, pass the frontend entry and API implementation to `startDenoUI()`. No installation or project configuration is required:

```typescript
import { startDenoUI } from "jsr:@timepp/dui"
import { apiImpl } from './api-impl.ts'

await startDenoUI({
    appName: 'my-app',
    title: 'Sample App',
    ui: new URL('./frontend/ui.ts', import.meta.url),
    api: apiImpl
})
```

Deno UI starts the frontend and API servers, connects the frontend to the local backend, and opens the browser.

When `ui` points to a TypeScript or JavaScript module, Deno UI generates the HTML shell automatically. `title` controls the browser title and the Windows AppMode window lookup; it defaults to `appName`.

Use an HTML entry when the application needs custom metadata, preload directives, a specific DOM structure, or other page-level behavior:

```typescript
await startDenoUI({
    appName: 'my-app',
    ui: new URL('./frontend/index.html', import.meta.url),
    api: apiImpl
})
```

### Single-file usage for small utilities

For a small utility, define the frontend as an inline callback. Its `api` parameter is inferred from the local API implementation, allowing the entire application to live in one file:

```typescript
// a single-file utility
import { startDenoUI } from "jsr:@timepp/dui"

await startDenoUI({
    appName: 'uptime',
    api: {
        getUptime: () => Deno.osUptime()
    },
    ui(api) {
        const output = document.createElement('p')
        document.body.appendChild(output)

        setInterval(async () => {
            output.textContent = `Uptime: ${await api.getUptime()} seconds`
        }, 1000)
    }
})
```

> Note: The inline `ui` callback runs in the browser and must be self-contained. It can use its `api` parameter and locally declared variables, but cannot capture variables or imports from the surrounding Deno module.

## Advanced Topics

### Serving pre-built assets

`startDenoUI` starts two distinct local servers and then launches the browser:

- a frontend server for HTML, JavaScript, CSS, and other web resources;
- an API server for the authenticated WebSocket RPC channel and health check.

The frontend and API always use separate ports. When `memoryAssets` is empty or omitted, Deno UI uses Vite as the frontend server. When pre-built `memoryAssets` are provided, it uses a lightweight static frontend server.

### Serving local resource directories

Use `staticMounts` when the frontend needs files outside its own directory. Each key is a URL path prefix and each value is a local directory:

```typescript
await startDenoUI({
    appName: 'photo-browser',
    ui: new URL('./frontend/ui.ts', import.meta.url),
    api: apiImpl,
    staticMounts: {
        '/db': 'D:\\photo-database',
        '/exports': new URL('./generated-exports/', import.meta.url)
    }
})
```

The frontend can then load a file with `<img src="/db/xxxx.jpg">`. The same mapping works with both the Vite and pre-built `memoryAssets` frontend servers. Mounts only serve files under the configured directory, do not list directories, and require Deno read permission for those directories. Responses are cached by the browser for one day; use a new filename or a version query parameter when replacing a file at the same path.

### Security model

Deno UI binds its HTTP and WebSocket servers to `127.0.0.1`. Each launch uses a cryptographically random session token, and WebSocket upgrades require both that token and the exact frontend Origin. This protects the RPC channel from LAN access and cross-site WebSocket requests.

### Platform support

The generated app runs without changes on Windows. On other operating systems, provide the path to the browser executable when calling `startDenoUI`:

```typescript
denoUI.startDenoUI({
    browser: '/usr/bin/google-chrome-stable',
    ...
})
```

### Hosting your app on JSR

You can publish your app to JSR so that it can be run without installation.

For a simple application whose UI entry is a TypeScript or JavaScript module, no frontend build is required. Publish the application entry and UI source files directly. Deno UI loads the published UI module through Vite at runtime. The module UI demo uses this approach and can be run directly with:

```bash
deno run -A jsr:@timepp/dui/examples/module-ui
```

Applications with custom HTML, CSS, images, or other static resources can optionally import `buildDenoUIAssets()` from `jsr:@timepp/dui/build`, run it before publishing, and pass the generated `memoryAssets` to `startDenoUI()`. Deno UI detects these assets automatically; there is no release flag.

#### Background: when resources need encoding

TypeScript and JavaScript UI modules can be loaded directly from JSR. Static files such as HTML, CSS, and images are not imported the same way, so applications that need them can encode their built frontend into a TypeScript source file. On the user’s machine, the frontend server decodes and serves those assets from memory.

![jsr](doc/jsr.drawio.svg)

## Architecture

![architecture](doc/architecture.drawio.svg)

### API invocation

API invocation uses discriminated WebSocket messages. RPC requests use `rpc.request`, responses use `rpc.response`, and framework messages such as window placement have their own message types.

Unknown methods and exceptions thrown by local API implementations reject the frontend promise with `RPCError`. Its `code` is `METHOD_NOT_FOUND`, `HANDLER_ERROR`, `TOO_MANY_REQUESTS`, or `SERIALIZATION_ERROR`, and its `message` contains the relevant details.

Deno UI never asks the browser to close its page. By default, the backend continues running after all frontends disconnect. Applications can opt in to stopping the backend three seconds after the last frontend disconnects by setting `closeWhenNoClients: true`; this option only controls the backend process and does not close any browser page.

## Development

### Test the latest published version

```sh
deno run -A --minimum-dependency-age=0 jsr:@timepp/dui@0.3.6/examples/minimal
```

### Publish changes

1. Run `build.bat` to rebuild the custom HTML sample assets when its frontend changes.

2. Update the version in `deno.json`.

3. Commit and push the changes.

4. Run `deno publish`.