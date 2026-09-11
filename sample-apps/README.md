# Samples

The samples demonstrate the three ways to define a Deno UI frontend, from the smallest setup to a structured web application.

## `minimal`

A complete application in one TypeScript file. The backend API, inline UI callback, and startup configuration are defined together. This style is best for small tools, scripts, and simple forms that do not need external frontend modules or assets.

## `module-ui`

A small application with the frontend in a separate TypeScript module. Deno UI generates the HTML shell and uses Vite to load the UI module. This style keeps the frontend and backend separate without requiring custom HTML or a frontend build.

## `custom-html`

A structured application with custom HTML, CSS, images, a shared API contract, and a separate backend implementation. It also demonstrates building and embedding frontend assets for direct execution from JSR. This style is intended for larger applications that need full control over the page and project structure.