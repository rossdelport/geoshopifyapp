// A process-wide cap on calls that are open at once (Treg, Claude). Calls over the cap wait their
// turn, first come first served. The cap is read on every call, so an env change (or a test) applies
// at once. Per process only: two processes each have their own cap.

export interface Gate {
  /** Run `fn` once a slot is free; the slot is given back when it settles, even if it throws. */
  run<T>(fn: () => Promise<T>): Promise<T>;
  /** Calls running now, calls waiting, and the most that ever ran at once (for tests and logs). */
  stats(): { open: number; waiting: number; mostOpen: number };
  resetStats(): void;
}

export function gate(limit: () => number): Gate {
  let open = 0;
  let mostOpen = 0;
  const queue: (() => void)[] = [];
  const cap = () => Math.max(1, Math.floor(limit()) || 1);

  const release = () => {
    open--;
    while (queue.length && open < cap()) {
      open++;
      mostOpen = Math.max(mostOpen, open);
      queue.shift()!();
    }
  };

  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      if (open < cap()) {
        open++;
        mostOpen = Math.max(mostOpen, open);
      } else {
        await new Promise<void>((resolve) => queue.push(resolve)); // the slot is taken for us in release()
      }
      try {
        return await fn();
      } finally {
        release();
      }
    },
    stats: () => ({ open, waiting: queue.length, mostOpen }),
    resetStats: () => {
      mostOpen = open;
    },
  };
}

/** A positive whole number from the environment, or the default. */
export function envLimit(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}
