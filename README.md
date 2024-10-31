# Deno Web app

Building native applications using modern tech stack:

- Use web technologies (html, css, typescript, vite) for the frontend
- Use Deno for the backend
- Leverage existing browsers (Edge, Chrome or others) for hosting the UI
- Use typescript for both frontend and backend
- Be able to publish as JSR component, so that it can be run without installation

Check the demo app (which shows all your network interfaces) with the following single line command:

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

### hosting your app in jsr

You can publish your app to JSR so that it can be run without installation.

1. run `deno run -A build.ts` to build the frontend and encode the assets
2. follow the [official guide](https://jsr.io/docs/publishing-packages#publishing-from-your-local-machine) to publish your app to JSR

#### background: why we need to encode resources

Although we can import remote code from JSR, static assets (HTML, CSS and other types) are not able to be downloaded by `imports`. However, we can encode all the static assets into one json file which can be imported from typescript. One user machine, the backend will decode them in memory and serve them as if they are static assets.

![jsr](doc/jsr.drawio.svg)

## Architecture

![architecture](doc/architecture.drawio.svg)

### API invoking

API invoking is done by websocket message. Websocket is also used to prove presence of the backend/frontend. The backend and frontend all together behaves as a single app:

- If the backend is killed, the frontend will close as well.
- If there is no frontend connected, the backend will exit as well (after a short delay).

## Platform support

Currently only fully works on Windows.

The reason is that when we launch app we used hard coded browser app path. For other platform, you need to manually navigate to the url shown in the console.
