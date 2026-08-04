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

### define API interfaces between the web frontend and the backend in `api.ts`

```typescript
export const api = {
    getNetworkInfo: async function (name: string) {
        return await callAPI(arguments) as NetworkInfo[]
    }
}

export type BackendAPI = typeof api
```

Note that we follow the DRY principle whenever possible. Above code do the following at the same time:

- Define the API interface: `getNetworkInfo (name: string) ... as NetworkInfo[]`
- Implement the API at frontend: `return await callAPI(arguments)`
- Derive the API for the backend: `export type BackendAPI = typeof api`

All the major part of the API (signature, input params and return type) is written exactly once.

You can add your APIs following the same pattern.

### implement API in `api_impl.ts`

```typescript
import {api} from './api.ts'

export const apiImpl: BackendAPI = {
    getNetworkInfo: async function (name: string) {
        const ni = Deno.networkInterfaces()
        return ni.filter(n => !name || n.name === name)
    }
}
```

API name and signatures are written again here. **This is the only place where you need to repeat**.

### calling API in frontend code

```typescript
import {api} from '../api.ts'
...
const networkInfo = await api.getNetworkInfo('')
...
```

`startDenoUI` will start the http server, websocket server and launch browser to navigate to the corresponding web address.

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

1. run `deno run -A build.ts` to build the frontend and encode the assets
2. follow the [official guide](https://jsr.io/docs/publishing-packages#publishing-from-your-local-machine) to publish your app to JSR

#### background: why we need to encode resources

While we can import remote code from JSR, importing static assets like HTML, CSS, and other types isn't possible directly. To download these assets, we need to encode them into a single TypeScript source file for import. On the user’s machine, the backend will decode these assets and serve them from memory.

![jsr](doc/jsr.drawio.svg)

## Architecture

![architecture](doc/architecture.drawio.svg)

### API invoking

API invoking is done by websocket message. Websocket is also used to prove presence of the backend/frontend. The backend and frontend all together behaves as a single app:

- If the backend is killed, the frontend will close as well.
- If there is no frontend connected, the backend will exit as well (after a short delay).

## Development

### Step to publish changes

1. run `deno run -A build.ts` to update bootstrap files if there is any change in the sample-app folder

2. upgrade version in `jsr.json`

3. commit & push changes

4. run `deno publish`