import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/auth-context";

// Define the form schema
const organizationFormSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  country: z.string().min(2, "Country must be at least 2 characters"),
  registrationNumber: z.string().min(2, "Registration number is required"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  
  // Billing account details
  billingType: z.literal("bank_account"),
  billingToken: z.string().min(1, "Billing token is required"),
  billingAccountNumber: z.string()
    .min(8, "Billing account number must be at least 8 characters")
    .max(17, "Billing account number must not exceed 17 characters")
    .regex(/^[0-9]+$/, "Billing account number must contain only digits")
    .transform((val) => val.replace(/\s+/g, '')),
  billingRoutingNumber: z.string()
    .length(9, "Billing routing number must be exactly 9 digits")
    .regex(/^[0-9]{9}$/, "Billing routing number must contain only 9 digits")
    .refine((val) => {
      // ABA routing number validation algorithm
      const digits = val.split('').map(Number);
      const sum = 
        3 * (digits[0] + digits[3] + digits[6]) +
        7 * (digits[1] + digits[4] + digits[7]) +
        1 * (digits[2] + digits[5] + digits[8]);
      return sum % 10 === 0;
    }, "Invalid billing routing number checksum"),
  billingBankName: z.string()
    .min(2, "Billing bank name is required")
    .max(100, "Billing bank name must not exceed 100 characters")
    .regex(/^[a-zA-Z0-9\s\-\.,'&]+$/, "Billing bank name contains invalid characters"),
  billingAccountType: z.enum(["checking", "savings"], {
    required_error: "Billing account type is required",
    invalid_type_error: "Invalid billing account type"
  }),
  billingAccountHolderName: z.string()
    .min(2, "Billing account holder name is required")
    .max(100, "Billing account holder name must not exceed 100 characters")
    .regex(/^[a-zA-Z\s\-\.,']+$/, "Billing account holder name contains invalid characters"),
  billingSwiftCode: z.string()
    .regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, "Invalid billing SWIFT/BIC code format")
    .optional(),
  billingIbanNumber: z.string()
    .regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,}$/, "Invalid billing IBAN format")
    .optional()
    .transform((val) => val?.replace(/\s+/g, '')),
    
  // Receiving account details - UK format
  receivingAccountHolderName: z.string()
    .min(2, "Account holder name is required")
    .max(100, "Account holder name must not exceed 100 characters")
    .regex(/^[a-zA-Z\s\-\.,']+$/, "Account holder name contains invalid characters"),
  receivingSortCode: z.string()
    .length(6, "Sort code must be exactly 6 digits")
    .regex(/^[0-9]{6}$/, "Sort code must contain only digits"),
  receivingAccountNumber: z.string()
    .length(8, "Account number must be exactly 8 digits")
    .regex(/^[0-9]+$/, "Account number must contain only digits")
    .transform((val) => val.replace(/\s+/g, ''))
});

type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

export function CreateOrganizationPage() {
  const { user, updateUser } = useAuth();
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    // Update form default values
    defaultValues: {
      name: "",
      country: "",
      registrationNumber: "",
      address: "",
      // Billing account defaults
      billingType: "bank_account",
      billingToken: "default_token", // Add default token
      billingAccountNumber: "",
      billingRoutingNumber: "",
      billingBankName: "",
      billingAccountType: "checking",
      billingAccountHolderName: "",
      billingSwiftCode: "",
      billingIbanNumber: "",
      // Receiving account defaults - UK format
      receivingAccountHolderName: "",
      receivingSortCode: "",
      receivingAccountNumber: ""
    }
  });

  const onSubmit = async (data: OrganizationFormValues) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to create an organization",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Update form submission data structure
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id // Add user ID header for authentication
        },
        body: JSON.stringify({
          name: data.name,
          country: data.country,
          registrationNumber: data.registrationNumber,
          address: data.address,
          billingAccount: {
            type: data.billingType,
            token: data.billingToken,
            bankDetails: {
              accountNumber: data.billingAccountNumber,
              routingNumber: data.billingRoutingNumber,
              bankName: data.billingBankName,
              accountType: data.billingAccountType,
              accountHolderName: data.billingAccountHolderName,
              swiftCode: data.billingSwiftCode || undefined,
              ibanNumber: data.billingIbanNumber || undefined
            }
          },
          receivingAccount: {
            type: "bank_account",
            token: "default_token", // Add required token
            bankDetails: {
              accountNumber: data.receivingAccountNumber,
              sortCode: data.receivingSortCode,
              accountHolderName: data.receivingAccountHolderName
            }
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create organization");
      }

      const organization = await response.json();

      // Update user with organization ID
      if (updateUser && user) {
        updateUser({
          ...user,
          organizationId: organization.id,
          isBusinessAccount: true
        });
      }

      toast({
        title: "Organization created",
        description: `${data.name} has been successfully created`
      });

      // Navigate to organization dashboard
      navigate(`/organization`);
    } catch (error) {
      console.error("Create organization error:", error);
      toast({
        title: "Failed to create organization",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Create Organization</CardTitle>
          <CardDescription>
            Set up your business account to manage contracts and employees
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Inc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="United States" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="registrationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration Number</FormLabel>
                      <FormControl>
                        <Input placeholder="123456789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Address</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main St, City" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="text-lg font-medium mb-4">Billing Account Information</h3>
                <p className="text-sm text-muted-foreground mb-4">This account will be used for paying for services</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="billingAccountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter account number" type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="billingRoutingNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Routing Number</FormLabel>
                        <FormControl>
                          <Input placeholder="9-digit routing number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="billingBankName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter bank name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="billingAccountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select account type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="checking">Checking</SelectItem>
                            <SelectItem value="savings">Savings</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="billingAccountHolderName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Holder Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter account holder name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="billingSwiftCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SWIFT Code (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter SWIFT code" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="billingIbanNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IBAN Number (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter IBAN number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-6">
                <h3 className="text-lg font-medium mb-4">Receiving Account Information</h3>
                <p className="text-sm text-muted-foreground mb-4">This account will be used for receiving payments</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="receivingAccountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter account number" type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="receivingSortCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sort Code</FormLabel>
                        <FormControl>
                          <Input placeholder="6-digit sort code" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="receivingAccountHolderName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Holder Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter account holder name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Organization"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}