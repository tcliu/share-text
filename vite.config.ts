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
