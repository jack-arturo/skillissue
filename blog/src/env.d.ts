/// <reference types="astro/client" />
/// <reference path="../emdash-env.d.ts" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  EMDASH_ENCRYPTION_KEY?: string;
}

declare namespace App {
  interface Locals extends Runtime {}
}
