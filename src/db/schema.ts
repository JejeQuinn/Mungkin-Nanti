import { relations } from "drizzle-orm";
import { integer, pgTable, serial, text, timestamp, boolean, real } from "drizzle-orm/pg-core";

// Users table (Firebase Auth linked)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(), // Firebase Auth UID
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Jadwal Pakan (Feeding schedules)
export const schedules = pgTable("jadwal_pakan", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  waktu: text("waktu").notNull(), // e.g. "07:00"
  isActive: boolean("is_active").default(true).notNull(),
  triggerManual: boolean("trigger_manual").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Log Pakan (Feeding execution history log)
export const feedingLogs = pgTable("log_pakan", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  waktuEksekusi: timestamp("waktu_eksekusi").defaultNow().notNull(),
  metode: text("metode").notNull(), // "Manual" or "Otomatis"
  status: text("status").notNull(), // "Berhasil"
  createdAt: timestamp("created_at").defaultNow(),
});

// Status Pakan (Feeder state / level)
export const statusPakan = pgTable("status_pakan", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull().unique(),
  persentase: integer("persentase").default(100).notNull(),
  jarakCm: real("jarak_cm").default(3.0).notNull(),
  terakhirDiperbarui: timestamp("terakhir_diperbarui").defaultNow().notNull(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  schedules: many(schedules),
  feedingLogs: many(feedingLogs),
  statusPakan: many(statusPakan),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  user: one(users, {
    fields: [schedules.userId],
    references: [users.id],
  }),
}));

export const feedingLogsRelations = relations(feedingLogs, ({ one }) => ({
  user: one(users, {
    fields: [feedingLogs.userId],
    references: [users.id],
  }),
}));

export const statusPakanRelations = relations(statusPakan, ({ one }) => ({
  user: one(users, {
    fields: [statusPakan.userId],
    references: [users.id],
  }),
}));
