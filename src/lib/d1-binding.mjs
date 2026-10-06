// The D1 binding name, shared by the deploy flow (which renders the
// `[[d1_databases]] binding` in the generated wrangler config) and the runtime
// selector (which reads it off the Cloudflare request env). Defined once so the
// two halves of the D1 feature cannot drift; dependency-free so both the
// SvelteKit server and the standalone deploy scripts can import it.
export const D1_BINDING_NAME = 'DB'
