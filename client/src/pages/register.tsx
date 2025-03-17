import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Copy, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

// Form validation schema
const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  accountType: z.enum(["personal", "business"]),
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: "You must agree to the terms and conditions",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export default function Register() {
  const [, navigate] = useLocation();
  const { register } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [signature, setSignature] = useState("");
  const [hasCopied, setHasCopied] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  // Generate a random 24-character signature
  const generateSignature = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 24; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };

  // Initialize the form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      fullName: "",
      password: "",
      confirmPassword: "",
      accountType: "personal",
      agreeToTerms: false,
    },
  });

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      // Generate a signature for the user
      const newSignature = generateSignature();
      setSignature(newSignature);

      // Register the user with the generated signature
      await register({
        email: values.email,
        fullName: values.fullName,
        password: values.password,
        isBusinessAccount: values.accountType === "business",
        signatureKey: newSignature, // Include the signature in registration
        payment: {
          type: 'credit_card',
          token: 'placeholder',
          receivePaymentsTo: 'bank_account',
          receivePaymentsDetails: 'placeholder'
        }
      });

      toast({
        title: "Registration successful!",
        description: "Your account has been created successfully.",
      });
      
      // Show the signature information
      setRegistrationComplete(true);
      
      // After showing the signature, redirect to home after 10 seconds
      setTimeout(() => {
        navigate("/");
      }, 10000);
    } catch (error) {
      console.error("Registration error:", error);
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySignature = () => {
    navigator.clipboard.writeText(signature);
    setHasCopied(true);
    
    toast({
      title: "Signature copied!",
      description: "Your digital signature has been copied to clipboard",
    });
    
    setTimeout(() => setHasCopied(false), 2000);
  };

  // If registration is complete, show the signature confirmation screen
  if (registrationComplete) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-md">
        <Card className="p-6 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Registration Complete!</h1>
            <p className="text-muted-foreground mt-2">
              Your account has been created successfully.
            </p>
          </div>
          
          <div className="bg-muted p-4 rounded-md">
            <h2 className="font-semibold text-lg mb-2">Your Digital Signature</h2>
            <p className="text-sm mb-2">
              This is your unique digital signature. You'll need it to sign contracts and verify your identity.
            </p>
            <div className="flex items-center gap-2 bg-background p-2 rounded">
              <code className="flex-1 font-mono text-sm overflow-x-auto">{signature}</code>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleCopySignature}
              >
                {hasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-amber-600 font-medium">
              ⚠️ Please save this signature in a secure location. You will need it to sign contracts.
            </p>
            <p className="text-sm text-muted-foreground">
              You can always view or regenerate your signature from your account page.
            </p>
          </div>
          
          <Button className="w-full" asChild>
            <Link href="/">Continue to Dashboard</Link>
          </Button>
        </Card>
      </div>
    );
  }

  // Registration form
  return (
    <div className="container mx-auto py-8 px-4 max-w-md">
      <Card className="p-6 space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create Your Account</h1>
          <p className="text-muted-foreground mt-1">
            Sign up to start creating and signing contracts
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accountType"
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
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Business accounts have additional features for organizations
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="agreeToTerms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      I agree to the terms of service and privacy policy
                    </FormLabel>
                    <FormDescription>
                      By creating an account, you agree to our Terms of Service and Privacy Policy
                    </FormDescription>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
        </Form>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Button variant="link" asChild className="p-0">
              <Link href="/">Sign in</Link>
            </Button>
          </p>
        </div>

        <div className="text-xs text-muted-foreground border-t pt-4 mt-4">
          <p>
            When you create an account, we'll generate a unique digital signature for you. 
            This signature will be used to sign contracts and verify your identity on the platform.
          </p>
        </div>
      </Card>
    </div>
  );
}