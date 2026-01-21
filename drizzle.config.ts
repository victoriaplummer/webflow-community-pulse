import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "sqlite",
  // Use Cloudflare D1 driver
  driver: "d1-http",
  // Enable verbose logging for debugging
  verbose: true,
  // Use strict mode for better type safety
  strict: true,
  // Migrations configuration
  migrations: {
    // Use timestamp prefix for migration files
    prefix: "timestamp",
  },
});
