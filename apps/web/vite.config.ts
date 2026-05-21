// SPA pura con Vite — no SSR
// El frontend es client-only: React + TanStack Router en modo SPA
// nginx sirve el dist/ estático y redirige todas las rutas a index.html
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';
import type { Plugin } from 'vite';

// @clerk/react@5.54.0 imports `loadClerkUiScript` from @clerk/shared/loadClerkJsScript,
// but @clerk/shared@3.47.5 (the semver-compatible version) doesn't export it yet.
// This shim intercepts the import and adds the missing export as a no-op so the
// build succeeds. At runtime, clerk.js@3.x already bundles the UI.
function clerkLoadScriptShim(): Plugin {
  const shimId = '\0virtual:clerk-load-script';
  const realPath = fileURLToPath(
    new URL('./node_modules/@clerk/shared/dist/runtime/loadClerkJsScript.mjs', import.meta.url)
  );
  return {
    name: 'clerk-load-script-shim',
    enforce: 'pre',
    resolveId(id) {
      if (id === '@clerk/shared/loadClerkJsScript') return shimId;
    },
    load(id) {
      if (id !== shimId) return null;
      return [
        `import * as m from ${JSON.stringify(realPath)}`,
        `export const buildClerkJsScriptAttributes = m.buildClerkJsScriptAttributes`,
        `export const clerkJsScriptUrl = m.clerkJsScriptUrl`,
        `export const loadClerkJsScript = m.loadClerkJsScript`,
        `export const setClerkJsLoadingErrorPackageName = m.setClerkJsLoadingErrorPackageName`,
        `export async function loadClerkUiScript() { return undefined }`,
      ].join('\n');
    },
  };
}

export default defineConfig({
  plugins: [react(), clerkLoadScriptShim()],
  server: { port: 3000 },
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      // Map @pokemon-battle/shared → the monorepo types file.
      // The Dockerfile copies packages/shared into /app/packages/shared,
      // so at build time __dirname is /app/apps/web and this resolves correctly.
      '@pokemon-battle/shared': '../../packages/shared/types.ts',
    },
  },
});
