declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    DIARY_ACCESS_HASH?: string;
    DIARY_SESSION_SECRET?: string;
  }
}
