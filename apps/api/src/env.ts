// Bindings and vars come from `wrangler types` (worker-configuration.d.ts); secrets are declared here
declare global {
  namespace Cloudflare {
    interface Env {
      ADMIN_TOKEN: string;
    }
  }
}

export type Env = Cloudflare.Env;

export type AppEnv = { Bindings: Env };
