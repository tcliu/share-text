import path from 'node:path'
import { sveltekit } from '@sveltejs/kit/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

// Vite exposes only VITE_* to the client and never puts dotenv values into
// the server's process.env, but server code reads process.env directly.
// Fill missing keys from the dotenv files (`loadEnv` handles .env,
// .env.local, .env.[mode], .env.[mode].local precedence) for `vite dev`
// only; real environment always wins.
function loadDevEnv(mode: string) {
  const fileValues = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(fileValues)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

// Ignore only this checkout's worktrees root (sibling checkouts when running
// in the default worktree). Anchored to process.cwd() so `vite dev` inside a
// worktree keeps watching its own files: a `**/.worktrees/**` glob tests the
// whole absolute path and would match every file when the root itself lives
// under the worktrees root. `loadDevEnv` has loaded `.env.local` before the
// watcher calls this, so a relocatable WORKTREES_DIR is honored too.
function isWorktreesPath(id: string) {
  const configured = process.env.WORKTREES_DIR?.trim()
  const root = configured
    ? path.isAbsolute(configured)
      ? configured
      : path.join(process.cwd(), configured)
    : path.join(process.cwd(), '.worktrees')
  const prefix = root + path.sep
  const abs = path.isAbsolute(id) ? id : path.join(process.cwd(), id)
  return abs.startsWith(prefix)
}

export default defineConfig(async ({ command, mode }) => {
  if (command === 'serve' && mode === 'development') {
    loadDevEnv(mode)
  }
  const isTest = process.env.VITEST === 'true'
  let plugins = isTest ? [svelte({ compilerOptions: { dev: true } }), tailwindcss()] : [sveltekit(), tailwindcss()]
  return {
    plugins,
    server: {
      watch: {
        ignored: [
          '**/.vercel/**',
          '**/.data/**',
          '**/.tmp/**',
          '**/.svelte-kit/**',
          '**/coverage/**',
          '**/.git/**',
          isWorktreesPath,
        ],
      },
    },
    resolve: isTest
      ? {
          alias: {
            $lib: path.resolve('./src/lib'),
            '$app/stores': path.resolve('./src/test/mocks/app-stores.ts'),
            '$app/state': path.resolve('./src/test/mocks/app-state.ts'),
            '$app/navigation': path.resolve('./src/test/mocks/app-navigation.ts'),
            '$app/environment': path.resolve('./src/test/mocks/app-environment.ts'),
          },
          conditions: ['browser', 'default'],
        }
      : undefined,
    test: {
      include: ['src/**/*.{test,spec}.{ts,js}'],
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/vitest-setup.ts'],
    },
  }
})
