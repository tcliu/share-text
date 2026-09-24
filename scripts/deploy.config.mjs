#!/usr/bin/env node
// deploy.config.mjs — deploy capability selection for this project.
//
// Base targets (vercel, cloudflare) are always available; a plugin not listed
// here is inert even though its module ships with the shared lib. `heartbeat`
// is intentionally absent: it activates only when CRONJOB_API_KEY is present.
export const plugins = ['env-sync', 'vercel-link']
