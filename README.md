# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Running Locally

The app has two parts: the **backend** (Express + Socket.IO game server on port `3001`) and the **frontend** (React dev server on port `3000`). Both need to be running. Use two terminals.

First, install dependencies for both (one-time):

```bash
npm install            # frontend deps (run in the project root)
cd server && npm install && cd ..   # backend deps
```

### Terminal 1 — backend

```bash
npm run server         # node server/index.js  → http://localhost:3001
# or, with auto-restart on changes (nodemon):
npm run server:dev
```

### Terminal 2 — frontend

```bash
npm start              # http://localhost:3000 (hot reload)
```

Then open [http://localhost:3000](http://localhost:3000). In development the frontend connects to the backend at `http://localhost:3001/flippinghusks`.

## Deploying to Render (free tier)

The whole app ships as **one** Render Web Service: `server/index.js` (Express + Socket.IO) serves the built React app, and the client connects to `window.location.origin` in production — so no code changes are needed.

A [`render.yaml`](./render.yaml) blueprint is included. Either push it and use **New → Blueprint** on Render, or create the service manually:

- **Type:** Web Service · **Plan:** Free · **Runtime:** Node
- **Build Command:** `npm install && CI=false GENERATE_SOURCEMAP=false npm run build`
- **Start Command:** `node server/index.js` (⚠️ do **not** leave the default `npm start` — that runs the dev server)

Render injects `PORT` automatically (the server already reads `process.env.PORT`). WebSockets work on Render with no extra config.

**Free-tier caveat:** the service sleeps after ~15 min idle. Waking it takes ~30–60s (cold start), and because game state lives in memory it is **wiped on every sleep/restart** — so after a cold start, everyone should rejoin a fresh room.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
