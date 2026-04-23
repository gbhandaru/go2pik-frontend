# Go2Pik Frontend

Vite + React implementation of the Go2Pik ordering experience. The repo mirrors the foof-order-app flow so you can push to GitHub, run the usual npm scripts, and deploy the compiled assets to Firebase Hosting / Google Cloud.

## Prerequisites

- Node.js 20.x (match the foof-order-app toolchain)
- npm 10.x (enable via Corepack if needed: `corepack enable`)
- Firebase CLI (`npm install -g firebase-tools`) for deployments

## Environment variables

| File | Purpose |
| --- | --- |
| `.env.development` | Local dev API base URL (`VITE_API_BASE_URL`) |
| `.env.preview` | Firebase preview API base URL |
| `.env.production` | Production API base URL |

Create a `.env.local` file to override development values without committing secrets.

## Local development

```bash
npm install
npm run dev
```

That spins up Vite at `http://localhost:5173`. The `/api` proxy in `vite.config.js` forwards requests to `http://localhost:5000` to mimic the foof-order-app backend. Update or remove the proxy if your local API runs elsewhere.

## Build & preview

```bash
npm run build     # outputs dist/
npm run build:preview   # build with .env.preview
npm run build:production # build with .env.production
npm run preview   # serves the production build locally
```

## Deploying to Firebase Hosting

1. Authenticate and pick your project: `firebase login` then `firebase use <project-id>`.
2. Build and deploy preview: `npm ci && npm run deploy:preview`.
3. Build and deploy production: `npm ci && npm run deploy:production` (`hosting:live`).

The Firebase Hosting target should point its public directory to `dist/`. Add rewrite rules for single-page app routing (same as foof-order-app) so that all paths fall back to `index.html`.

## Testing & QA

- `npm run dev` – manual smoke tests while developing.
- `npm run preview` – verify the production bundle before deploying.
- Add Cypress/Playwright suites similar to foof-order-app as the UI evolves.
