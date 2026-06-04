# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start        # dev server at http://localhost:3000 (hot reload)
npm test         # run tests in watch mode
npm test -- --watchAll=false  # run tests once (CI mode)
npm test -- --testPathPattern=App  # run a single test file
npm run build    # production build to /build
```

## Architecture

This is a standard Create React App project (React 19, no eject). Entry point is `src/index.js`, which mounts `src/App.js` into `#root`. Testing uses React Testing Library with Jest (configured via `react-scripts`). No custom webpack config, no TypeScript — plain JavaScript JSX throughout.
