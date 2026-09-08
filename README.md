# DenoUI: Developing Native Applications with a Modern Tech Stack

- **Modern**: Build with modern web technologies for a responsive user interface.
- **Clean**: Use Deno to provide a fast, secure backend environment.
- **Lightweight**: Leverage existing browsers (such as Edge or Chrome) to display the application interface.
- **Typed**: TypeScript for both frontend and backend code.
- **DRY**: Minimize boilerplate code by defining API interfaces once and deriving frontend and backend implementations.
- **Installation Free**: Can be packaged as a JSR component, enabling installation-free execution.

To see a demo app (which displays your network interfaces), simply run the following command:

```bash
deno run -A jsr:@timepp/dui/demo
```

![demo](doc/demo.png)

## Usage

### create your app with bootstrap code

```bash
deno run -A jsr:@timepp/dui@0.1.4 create-app app1
```

this will create an app in the new folder `app1`.

### define the typed local API in `api.ts`

```typescript
import { createClient } from "jsr:@timepp/dui/client"

export interface BackendAPI {
    getNetworkInfo(name: string): Promise<NetworkInfo[]>
}

export const api = createClient<BackendAPI>()
```

`createClient` creates a type-safe proxy. WebSocket connection, request IDs and transport details are managed by Deno UI.

### implement API in `api_impl.ts`

```typescript
import type { BackendAPI } from './api.ts'

export const apiImpl: BackendAPI = {
    getNetworkInfo: async function (name: string) {
        const ni = Deno.networkInterfaces()
        return ni.filter(n => !name || n.name === name)
    }
}
```

Using `BackendAPI` ensures that the local implementation matches the API available to the frontend.

### start the application

```typescript
import { startDenoUI } from "jsr:@timepp/dui"
import { apiImpl } from './api-impl.ts'

await startDenoUI({
    appName: 'dui-sample-app',
    ui: new URL('./frontend/ui.ts', import.meta.url),
    api: apiImpl
})
```

When `ui` points to a TypeScript or JavaScript module, Deno UI generates the HTML shell, starts the local servers, establishes the frontend connection and launches the browser.

An application that needs custom metadata, preload directives, a specific DOM skeleton, or other page-level behavior can provide HTML instead:

```typescript
await startDenoUI({
    appName: 'dui-sample-app',
    ui: new URL('./frontend/index.html', import.meta.url),
    api: apiImpl
})
```

In this mode Deno UI serves the supplied HTML as the page entry and does not generate or map a default HTML document. The HTML is responsible for loading the application module, for example `<script type="module" src="./ui.ts"></script>`.

### calling API in frontend code

```typescript
import {api} from '../api.ts'
...
const networkInfo = await api.getNetworkInfo('')
...
```

`startDenoUI` starts two distinct local servers and then launches the browser:

- a frontend server for HTML, JavaScript, CSS, and other web resources;
- an API server for the authenticated WebSocket RPC channel and health check.

The frontend and API always use separate ports. When `memoryAssets` is empty or omitted, Deno UI uses Vite as the frontend server. When pre-built `memoryAssets` are provided, it automatically uses a lightweight static frontend server. Applications do not need to select a development or release mode.

### Security model

Deno UI binds its HTTP and WebSocket servers to `127.0.0.1`. Each launch uses a cryptographically random session token, and WebSocket upgrades require both that token and the exact frontend Origin. This protects the RPC channel from LAN access and cross-site WebSocket requests.

### Platform support

The generated app can run without any change on Windows.
In other OS you need to provide the path to the browser executable when calling `startDenoUI`, e.g.:

```typescript
denoUI.startDenoUI({
    browser: '/usr/bin/google-chrome-stable',
    ...
})
```

### hosting your app in jsr

You can publish your app to JSR so that it can be run without installation.

For a simple application whose UI entry is a TypeScript or JavaScript module, no frontend build is required. Publish the application entry and UI source files directly. Deno UI loads the published UI module through Vite at runtime. The minimal demo uses this approach and can be run directly with:

```bash
deno run -A jsr:@timepp/dui/demo
```

Applications with custom HTML, CSS, images, or other static resources can optionally run `buildDenoUIAssets()` before publishing and pass the generated `memoryAssets` to `startDenoUI()`. Deno UI detects these assets automatically; there is no release flag.

#### background: when resources need encoding

TypeScript and JavaScript UI modules can be loaded directly from JSR. Static files such as HTML, CSS, and images are not imported the same way, so applications that need them can encode their built frontend into a TypeScript source file. On the user’s machine, the frontend server decodes and serves those assets from memory.

![jsr](doc/jsr.drawio.svg)

## Architecture

![architecture](doc/architecture.drawio.svg)

### API invoking

API invocation uses discriminated WebSocket messages. RPC requests use `rpc.request`, responses use `rpc.response`, and framework messages such as window placement have their own message types.

Unknown methods and exceptions thrown by local API implementations reject the frontend promise with `RPCError`. Its `code` is `METHOD_NOT_FOUND`, `HANDLER_ERROR`, `TOO_MANY_REQUESTS`, or `SERIALIZATION_ERROR`, and its `message` contains the relevant details.

Deno UI never asks the browser to close its page. By default, the backend continues running after all frontends disconnect. Applications can opt in to stopping the backend three seconds after the last frontend disconnects by setting `closeWhenNoClients: true`; this option only controls the backend process and does not close any browser page.

## Development

### Step to publish changes

1. run `deno run -A build.ts` to update bootstrap files if there is any change in the full sample folder

2. upgrade version in `deno.json`

3. commit & push changes

4. run `deno publish`