#!/usr/bin/env node
// _deploy/plugins/env-sync.mjs — push the target's env file to the platform
// before build/deploy. The target owns the specifics (which sync script runs,
// and any state the sync updates) and exposes them through its `envSync`
// capability; this plugin only schedules the step and makes it selectable.
export const envSyncPlugin = {
  name: 'env-sync',
  steps: ctx => (ctx.target?.envSync ? [{ name: 'env-sync', phase: 'env', run: () => ctx.target.envSync(ctx) }] : []),
}
