import "server-only";

interface Entry<T> {
  value?: T;
  expiresAt: number;
  promise?: Promise<T>;
}

// Kept on globalThis so that the cache survives hot reloads in development.
const globalStore = globalThis as unknown as { __untisCache?: Map<string, Entry<unknown>> };
const store = (globalStore.__untisCache ??= new Map());

const MAX_ENTRIES = 500;

/**
 * In-memory TTL cache with in-flight de-duplication: concurrent callers for the
 * same key share one request. Failed requests are not cached.
 */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = store.get(key) as Entry<T> | undefined;
  if (entry) {
    if (entry.promise) return entry.promise;
    if (entry.expiresAt > now) return entry.value as T;
  }

  const promise = load().then(
    (value) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    },
    (error) => {
      store.delete(key);
      throw error;
    },
  );
  store.set(key, { expiresAt: 0, promise });

  if (store.size > MAX_ENTRIES) {
    for (const [k, e] of store) {
      if (!e.promise && e.expiresAt <= now) store.delete(k);
    }
  }
  return promise;
}

export function clearUntisCache() {
  store.clear();
}

/** Runs `fn` over `items` with at most `limit` concurrent executions. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
