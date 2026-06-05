// Build-time stub for Node-only database drivers (mysql2, postgres) on
// Cloudflare Workers. vite.config.ts aliases those packages here when building
// with a cloudflare NITRO_PRESET — the drivers can't run on workerd (they
// require node:net/node:process at module evaluation) and aren't needed:
// Workers deployments use the D1 binding (DATABASE_PROVIDER=d1).
//
// Importing the stub is harmless; calling it throws a clear error.
function unavailable(): never {
  throw new Error(
    'This database driver is not available on Cloudflare Workers. ' +
      'Use DATABASE_PROVIDER=d1 (D1 binding) for Workers deployments.'
  );
}

const stub: any = new Proxy(unavailable, {
  get: () => stub,
  apply: unavailable,
  construct: unavailable,
});

export default stub;
// Named exports drizzle-orm's drivers reference (mysql2's createPool).
export const createPool = stub;
export const createConnection = stub;
