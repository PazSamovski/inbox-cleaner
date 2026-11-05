/**
 * Runs `worker` over `items` with at most `concurrency` calls in flight,
 * reporting progress as each item finishes. Results keep the input order.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onItemDone?: (done: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let done = 0;
  // Once any item fails, the other runners stop picking up work and stop
  // reporting progress, so the caller never sees progress after a failure.
  let failed = false;

  async function run(): Promise<void> {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        failed = true;
        throw error;
      }
      if (!failed) onItemDone?.(++done);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, run);
  await Promise.all(runners);
  return results;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
