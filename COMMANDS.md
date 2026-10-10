# Commands

Run these from the project folder in a terminal (PowerShell or VS Code's terminal).

## First-time setup

```bash
npm install
```

Installs dependencies into `node_modules/`. Run it again whenever `package.json` changes
(for example after pulling someone else's changes).

The app also needs a `.env` file in the project root with the Supabase settings:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Run the app locally

```bash
npm run dev
```

Starts the dev server and prints a local URL (usually http://localhost:5173). Open it in a
browser. Edits to the code reload the page automatically. Press `Ctrl+C` in the terminal to stop.

To open it on a phone or another device on the same network:

```bash
npm run dev -- --host
```

## Build

```bash
npm run build
```

Creates a production build in `dist/`. Takes about a minute.

```bash
npm run preview
```

Serves the `dist/` build locally so you can check it before deploying. Run `npm run build` first.

## Publish to GitHub Pages

Pushing to `main` publishes the site automatically
(`.github/workflows/deploy.yml`). It goes live at
https://ericmelgaard.github.io/Studio_Bolt_main/ a minute or two later.

```bash
git push
```

Check progress in the repo's **Actions** tab. To redeploy without new changes, open
**Actions → Deploy to GitHub Pages → Run workflow**.

## Checks

```bash
npm run typecheck   # TypeScript errors, no output files
npm run lint        # ESLint
```
