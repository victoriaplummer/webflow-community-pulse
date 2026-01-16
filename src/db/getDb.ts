import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export const getDb = (locals: App.Locals) => {
  const { env } = locals.runtime;
  return drizzle(env.DB, { schema });
};

export type Database = ReturnType<typeof getDb>;
