import type { Logger } from "../logger";
import { errMessage } from "../errors";

/** One resource to release on shutdown. */
export interface ShutdownStep {
  name: string;
  run(): unknown;
}

export interface ShutdownOptions {
  logger: Logger;
  /** Give up and exit(1) after this long; keep it below PM2's kill_timeout. */
  timeoutMs: number;
}

export interface Shutdown {
  /** Add a step; steps run sequentially in the order they were added. */
  add(step: ShutdownStep): void;
  /** Run every step once, then exit. Repeat calls return the same promise. */
  shutdown(reason: string): Promise<void>;
}

async function runSteps(steps: ShutdownStep[], logger: Logger): Promise<void> {
  for (const step of steps) {
    try {
      await step.run();
      logger.info("shutdown step done", { step: step.name });
    } catch (error) {
      logger.error("shutdown step failed", { step: step.name, error: errMessage(error) });
    }
  }
}

export function createShutdown(options: ShutdownOptions): Shutdown {
  const { logger, timeoutMs } = options;
  const steps: ShutdownStep[] = [];
  let running: Promise<void> | undefined;

  async function run(reason: string): Promise<void> {
    logger.info("shutting down", { reason });
    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), timeoutMs);
    });
    const outcome = await Promise.race([runSteps([...steps], logger), timedOut]);
    clearTimeout(timer);
    if (outcome === "timeout") logger.error("shutdown timed out", { timeoutMs });
    else logger.info("shutdown complete");
    process.exit(outcome === "timeout" ? 1 : 0);
  }

  return {
    add(step) {
      steps.push(step);
    },
    shutdown(reason) {
      running ??= run(reason);
      return running;
    },
  };
}

/**
 * Route stop requests to `shutdown`: SIGINT/SIGTERM (Ctrl+C, PM2 on POSIX) and
 * PM2's `shutdown` IPC message (`shutdown_with_message`, needed on Windows).
 * Signals are bound with `once`, so a second Ctrl+C falls back to Node's
 * default and kills the process immediately.
 */
export function bindShutdownTriggers(shutdown: Shutdown): void {
  process.once("SIGINT", () => void shutdown.shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown.shutdown("SIGTERM"));
  process.on("message", (message) => {
    if (message === "shutdown") void shutdown.shutdown("pm2 shutdown message");
  });
}
