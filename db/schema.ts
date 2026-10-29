import { sqliteTable, text } from "drizzle-orm/sqlite-core";
export const workspace = sqliteTable("workspace", {
  id: text("id").primaryKey(),
  payload: text("payload").notNull(),
});
