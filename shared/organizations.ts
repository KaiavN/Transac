import { pgTable, text, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { paymentSchema } from "./schema";

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  registrationNumber: text("registration_number").notNull(),
  address: text("address").notNull(),
  billingAccount: jsonb("billing_account").$type<z.infer<typeof paymentSchema>>().notNull(),
  receivingAccount: jsonb("receiving_account").$type<z.infer<typeof paymentSchema>>().notNull(),
  employees: jsonb("employees").$type<string[]>().notNull().default([]),
  employeeRequests: jsonb("employee_requests").$type<string[]>().notNull().default([]),
  adminUsers: jsonb("admin_users").$type<string[]>().notNull().default([]),
  activityLog: jsonb("activity_log").$type<{
    timestamp: string;
    employeeId: string;
    action: string;
    cost?: number;
    details?: Record<string, any>;
  }[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  fullName: text("full_name").notNull(),
  signatureKey: text("signature_key").notNull(),
  payment: jsonb("payment").$type<z.infer<typeof paymentSchema>>(),
  contracts: jsonb("contracts").$type<string[]>().notNull().default([]),
  organizationId: text("organization_id"),
  isBusinessAccount: boolean("is_business_account").notNull().default(false),
  email: text("email"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export type User = typeof users.$inferSelect;

export const insertOrganizationSchema = createInsertSchema(organizations).pick({
  name: true,
  country: true,
  registrationNumber: true,
  address: true,
  billingAccount: true,
  receivingAccount: true
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export const employeeRequestSchema = z.object({
  action: z.enum(["approve", "reject"], {
    required_error: "Action is required",
    invalid_type_error: "Action must be either 'approve' or 'reject'"
  }),
  employeeId: z.string().uuid("Invalid employee ID format")
});

export const transactionCategoryEnum = z.enum(["default", "emergency", "recurring"]);

export const verifyTransactionSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID format"),
  cost: z.number().positive("Cost must be positive").finite("Cost must be a finite number"),
  description: z.string().min(1, "Description is required").max(500, "Description must not exceed 500 characters"),
  category: transactionCategoryEnum.default("default")
});

export type VerifyTransaction = z.infer<typeof verifyTransactionSchema>;