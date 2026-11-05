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

  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
      onItemDone?.(++done);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, run);
  await Promise.all(runners);
  return results;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
