import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

import { config } from "dotenv";
config({ path: ".env" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

export const db = drizzle(pool, { schema });

export const connectToDB = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    await client.query("SELECT NOW()");
    client.release();
    console.log("✅ Database connected");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return false;
  }
};
