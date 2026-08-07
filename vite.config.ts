import path from 'node:path'
import { sveltekit } from '@sveltejs/kit/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { parseEnvFile } from './scripts/db-config.mjs'

const DEV_ENV_FILES = ['.env', '.env.local', '.env.dev']

function loadDevEnv() {
  const merged: Record<string, string> = {}
  for (const file of DEV_ENV_FILES) {
    const entries = Object.entries(parseEnvFile(path.resolve(process.cwd(), file))) as [
      string,
      string,
    ][]
    for (const [key, value] of entries) {
      merged[key] = value
    }
  }
  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

export default defineConfig(async ({ command, mode }) => {
  if (command === 'serve' && mode === 'development') {
    loadDevEnv()
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
            '$app/navigation': path.resolve('./src/test/mocks/app-navigation.ts'),
          },
          conditions: ['browser', 'default'],
        }
      : undefined,
    test: {
      include: ['src/**/*.{test,spec}.{ts,js}'],
      environment: 'jsdom',
      globals: true,
    },
  }
})
