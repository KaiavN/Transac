import { pgTable, text, serial, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const validationResultsSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  suggestions: z.array(z.string()),
});

export type ValidationResults = z.infer<typeof validationResultsSchema>;

export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  prompt: text("prompt").notNull(),
  code: text("code").notNull(),
  validationResults: jsonb("validation_results").$type<ValidationResults>().notNull(),
  isValid: boolean("is_valid").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertContractSchema = createInsertSchema(contracts).pick({
  prompt: true,
  code: true,
  validationResults: true,
  isValid: true,
});

export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contracts.$inferSelect;

export const bankAccountSchema = z.object({
  accountNumber: z.string()
    .min(8, "Account number must be at least 8 characters")
    .max(17, "Account number must not exceed 17 characters")
    .regex(/^[0-9]+$/, "Account number must contain only digits")
    .transform((val) => val.replace(/\s+/g, '')),
  routingNumber: z.string()
    .length(9, "Routing number must be exactly 9 digits")
    .regex(/^[0-9]{9}$/, "Routing number must be exactly 9 digits")
    .refine((val) => {
      // ABA routing number validation algorithm
      const digits = val.split('').map(Number);
      const sum = 
        3 * (digits[0] + digits[3] + digits[6]) +
        7 * (digits[1] + digits[4] + digits[7]) +
        1 * (digits[2] + digits[5] + digits[8]);
      return sum % 10 === 0;
    }, "Invalid routing number checksum"),
  bankName: z.string()
    .min(2, "Bank name is required")
    .max(100, "Bank name must not exceed 100 characters")
    .regex(/^[a-zA-Z0-9\s\-\.,'&]+$/, "Bank name contains invalid characters"),
  accountType: z.enum(["checking", "savings"], {
    required_error: "Account type is required",
    invalid_type_error: "Invalid account type"
  }),
  accountHolderName: z.string()
    .min(2, "Account holder name is required")
    .max(100, "Account holder name must not exceed 100 characters")
    .regex(/^[a-zA-Z\s\-\.,']+$/, "Account holder name contains invalid characters"),
  swiftCode: z.string()
    .regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, "Invalid SWIFT/BIC code format")
    .optional(),
  ibanNumber: z.string()
    .regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,}$/, "Invalid IBAN format")
    .optional()
    .transform((val) => val?.replace(/\s+/g, ''))
});

export const paymentSchema = z.object({
  type: z.enum(["credit_card", "paypal", "bank_account"], {
    required_error: "Payment type is required",
    invalid_type_error: "Invalid payment type"
  }).superRefine((type, ctx) => {
    const parentData = ctx.path.length > 0 ? ctx.path[0] as { isBusinessAccount?: boolean } : undefined;
    const isBusinessAccount = parentData?.isBusinessAccount;
    if (isBusinessAccount && type !== "bank_account") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Business accounts must use bank account for payments"
      });
    }
  }),
  token: z.string().min(1, "Payment token is required"),
  last4: z.string().length(4, "Last 4 digits must be exactly 4 characters").optional(),
  bankDetails: bankAccountSchema.optional().superRefine((details, ctx) => {
    const parentData = ctx.path.length > 0 ? (ctx.path[0] as { type?: string }) : undefined;
    const paymentType = parentData?.type;
    if (paymentType === "bank_account" && !details) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bank account details are required for bank account payments"
      });
    }
  }),
  receivePaymentsTo: z.enum(["paypal", "bank_account"], {
    required_error: "Payment destination is required",
    invalid_type_error: "Invalid payment destination"
  }).superRefine((destination, ctx) => {
    const parentData = ctx.path.length > 0 ? ctx.path[0] as { isBusinessAccount?: boolean } : undefined;
    const isBusinessAccount = parentData?.isBusinessAccount;
    if (isBusinessAccount && destination !== "bank_account") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Business accounts must receive payments to bank account"
      });
    }
  }),
  receivePaymentsDetails: z.string().min(1, "Payment details are required")
});

export type Payment = z.infer<typeof paymentSchema>;

export const paymentSplitSchema = z.object({
  proposerId: z.string(),
  splits: z.array(z.object({
    userId: z.string(),
    percentage: z.number().min(0).max(100)
  })),
  status: z.enum(["pending", "accepted", "rejected", "counter"]),
  counterOffer: z.array(z.object({
    userId: z.string(),
    percentage: z.number().min(0).max(100)
  })).optional()
});

export const organizationSchema = z.object({
  id: z.string().uuid("Invalid organization ID format"),
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  country: z.string().min(2, "Country name must be at least 2 characters"),
  registrationNumber: z.string().min(1, "Registration number is required"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  billingAccount: paymentSchema,
  receivingAccount: paymentSchema,
  employees: z.array(z.string().uuid("Invalid employee ID format")).default([]),
  employeeRequests: z.array(z.string().uuid("Invalid employee request ID format")).default([]),
  activityLog: z.array(z.object({
    timestamp: z.string().datetime("Invalid timestamp format"),
    employeeId: z.string().uuid("Invalid employee ID format"),
    action: z.string().min(1, "Action description is required"),
    cost: z.number().positive("Cost must be positive").optional()
  })).default([]),
  createdAt: z.string().datetime("Invalid creation date format")
});

export type Organization = z.infer<typeof organizationSchema>;

export const userSchema = z.object({
  id: z.string().uuid("Invalid user ID format"),
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username must not exceed 50 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100, "Full name must not exceed 100 characters"),
  signatureKey: z.string().length(24, "Signature key must be exactly 24 characters"),
  payment: paymentSchema.optional(),
  contracts: z.array(z.string().uuid("Invalid contract ID format")).default([]),
  organizationId: z.string().uuid("Invalid organization ID format").optional(),
  isBusinessAccount: z.boolean().default(false),
  email: z.string().email("Invalid email format").optional(),
  password: z.string().optional()
});

export type User = z.infer<typeof userSchema>;

export const signatureSchema = z.object({
  userId: z.string(),
  signatureKey: z.string().length(24),
  date: z.string(),
});

export const contractPartySchema = z.object({
  userId: z.string(),
  hasConfirmed: z.boolean(),
  signatureKey: z.string().length(24).optional()
});

export const contractFormSchema = z.object({
  prompt: z.string().min(10, "Prompt must be at least 10 characters"),
  signatures: z.array(signatureSchema).min(2, "At least two signatures are required"),
});

export type ContractFormData = z.infer<typeof contractFormSchema>;