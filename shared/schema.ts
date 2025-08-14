import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const medications = pgTable("medications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  genericName: text("generic_name").notNull(),
  medicalName: text("medical_name").notNull(),
  type: text("type").notNull(), // rapid, long, intermediate, other
  dose: text("dose").notNull(),
  quantity: integer("quantity").notNull(),
  expirationDate: date("expiration_date").notNull(),
  location: text("location").notNull(),
  administrativeForm: text("administrative_form").notNull(), // ADD THIS LINE
});


export const medicationTransactions = pgTable("medication_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  medicationId: varchar("medication_id").notNull(),
  medicationName: text("medication_name").notNull(),
  type: text("type").notNull(), // "addition" or "dispensed"
  quantity: integer("quantity").notNull(),
  timestamp: timestamp("timestamp").notNull().default(sql`now()`),
  notes: text("notes"),
});

export const insertMedicationSchema = createInsertSchema(medications).omit({
  id: true,
});

export const insertTransactionSchema = createInsertSchema(medicationTransactions).omit({
  id: true,
  timestamp: true,
});

export type InsertMedication = z.infer<typeof insertMedicationSchema>;
export type Medication = typeof medications.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type MedicationTransaction = typeof medicationTransactions.$inferSelect;
