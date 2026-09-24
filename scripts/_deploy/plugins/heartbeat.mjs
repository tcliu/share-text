#!/usr/bin/env node
// _deploy/plugins/heartbeat.mjs — wire the cron-job.org heartbeat that calls
// GET /api/cron/scan. Auto-gated: it activates only when CRONJOB_API_KEY
// resolves, so copying the module into a project never wires a job by itself.
import { logEvent } from '../../log-event.mjs'
import { applyHeartbeat, isHeartbeatConfigurable } from '../../lib/heartbeat.mjs'

export const heartbeatPlugin = {
  name: 'heartbeat',
  enabled: () => isHeartbeatConfigurable(),
  steps: ctx => [
    {
      name: 'heartbeat',
      phase: 'heartbeat',
      run: async () => {
        if (ctx.heartbeat !== 'cron-job' && ctx.heartbeat !== 'none') {
          logEvent({ action: 'heartbeat_skip', details: { target: ctx.target.name } })
          return
        }
        // The Cloudflare target derives its live URL (`state.appUrl`); other
        // targets read APP_BASE_URL from the overlay.
        const options = ctx.state?.appUrl ? { baseUrl: ctx.state.appUrl } : {}
        await applyHeartbeat(ctx.heartbeat, undefined, ctx.target.name, options)
      },
    },
  ],
}
