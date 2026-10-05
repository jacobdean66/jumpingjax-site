export const SEARCH_REVIEW_MS = 10_000;
export const SEARCH_DEADLINE_MS = 45_000;

/** One search, one free saved-artwork recovery check, then a hard stop. */
export async function superviseThemeSearch<T>(
  search: (signal: AbortSignal) => Promise<T>,
  recover: (signal: AbortSignal) => Promise<T | null>,
  options: { reviewMs?: number; deadlineMs?: number; onReview?: () => void } = {},
): Promise<T> {
  const controller = new AbortController();
  let review: ReturnType<typeof setTimeout>;
  let deadline: ReturnType<typeof setTimeout>;
  const recovery = new Promise<T>((resolve) => {
    review = setTimeout(() => {
      options.onReview?.();
      void recover(controller.signal).then(result => { if (result !== null) resolve(result); }).catch(() => {});
    }, options.reviewMs ?? SEARCH_REVIEW_MS);
  });
  const timeout = new Promise<never>((_resolve, reject) => {
    deadline = setTimeout(() => {
      controller.abort();
      reject(new Error("search_deadline_exceeded"));
    }, options.deadlineMs ?? SEARCH_DEADLINE_MS);
  });
  try { return await Promise.race([search(controller.signal), recovery, timeout]); }
  finally { clearTimeout(review!); clearTimeout(deadline!); controller.abort(); }
}
