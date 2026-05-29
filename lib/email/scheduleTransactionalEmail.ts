import "server-only";

import { after } from "next/server";

/**
 * Run transactional email after the server action / route handler response is sent.
 * Plain `void sendEmail()` is often killed when the request ends (especially serverless).
 */
export function scheduleTransactionalEmail(task: () => Promise<void>): void {
  const run = async () => {
    try {
      await task();
    } catch (err) {
      console.error("[email] scheduled send failed:", err);
    }
  };

  try {
    after(run);
  } catch {
    void run();
  }
}
