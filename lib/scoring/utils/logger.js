/**
 * Simple logging utility (from Boxscore scraper)
 */

export const logger = {
  info: (message, ...args) => {
    console.log(`[INFO] ${message}`, ...args);
  },

  error: (message, ...args) => {
    console.error(`[ERROR] ${message}`, ...args);
  },

  warn: (message, ...args) => {
    console.warn(`[WARN] ${message}`, ...args);
  },

  debug: (message, ...args) => {
    if (process.env.DEBUG === "true") {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
};
