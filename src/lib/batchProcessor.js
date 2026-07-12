/**
 * Runs an async worker function over an array of items with controlled concurrency.
 * Each item is processed independently — if one fails, the rest continue.
 * Calls onItemComplete(index, result) after each item finishes (success or error).
 *
 * @param {Array} items - Array of items to process
 * @param {Function} worker - async (item, index) => result
 * @param {Object} opts
 * @param {number} opts.concurrency - max parallel workers (default 5)
 * @param {Function} opts.onItemComplete - (index, { ok, result, error }) => void
 * @returns {Promise<{ succeeded: number, failed: number, errors: Array }>}
 */
export async function runBatch(items, worker, opts = {}) {
  const concurrency = Math.min(opts.concurrency || 5, items.length || 1);
  const results = new Array(items.length);
  let cursor = 0;
  let succeeded = 0;
  let failed = 0;
  const errors = [];

  async function runNext() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        const result = await worker(items[index], index);
        results[index] = { ok: true, result };
        succeeded++;
        opts.onItemComplete?.(index, { ok: true, result });
      } catch (err) {
        results[index] = { ok: false, error: err };
        failed++;
        errors.push({ index, error: err });
        opts.onItemComplete?.(index, { ok: false, error: err });
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => runNext());
  await Promise.all(workers);
  return { succeeded, failed, errors, results };
}

/**
 * Debounces a function by a given delay.
 * Returns a wrapper that only invokes fn after `delay` ms have elapsed since the last call.
 */
export function debounce(fn, delay = 800) {
  let timer = null;
  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn(...args); }, delay);
  };
  debounced.cancel = () => { if (timer) clearTimeout(timer); timer = null; };
  debounced.flush = (...args) => { if (timer) clearTimeout(timer); timer = null; fn(...args); };
  return debounced;
}