import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

type SqlClient = ReturnType<typeof postgres>;

const stubOptions = {
  parsers: {} as Record<string, unknown>,
  serializers: {} as Record<string, unknown>,
};

const globalForDb = globalThis as typeof globalThis & {
  __sebakulSqlClient?: { connectionString: string; client: SqlClient };
};

function getSqlClient(): SqlClient {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("Konfigurasi DATABASE_URL belum tersedia.");
  }

  if (globalForDb.__sebakulSqlClient?.connectionString === connectionString) {
    return globalForDb.__sebakulSqlClient.client;
  }

  // Use transaction pooler (port 6543); must disable prepared statements
  const rawClient = postgres(connectionString, {
    prepare: false,
    // Vercel functions are short-lived; a single connection per warm instance
    // prevents autoscaling from exhausting the Supabase pool.
    max: process.env.VERCEL === "1" ? 1 : 10,
    ssl: process.env.VERCEL === "1" ? "require" : undefined,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  Object.assign(rawClient.options.parsers, stubOptions.parsers);
  Object.assign(rawClient.options.serializers, stubOptions.serializers);
  globalForDb.__sebakulSqlClient = { connectionString, client: rawClient };
  return rawClient;
}

const client = new Proxy((() => undefined) as unknown as SqlClient, {
  get(_target, property) {
    if (property === "options") {
      return globalForDb.__sebakulSqlClient ? globalForDb.__sebakulSqlClient.client.options : stubOptions;
    }
    const active = getSqlClient();
    const value = Reflect.get(active, property, active);
    return typeof value === "function" ? value.bind(active) : value;
  },
  apply(_target, thisArg, args) {
    return Reflect.apply(getSqlClient() as unknown as (...callArgs: unknown[]) => unknown, thisArg, args);
  },
});

export const db = drizzle(client, { schema });
