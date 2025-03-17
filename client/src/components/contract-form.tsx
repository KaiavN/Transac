import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { contractFormSchema, type ContractFormData } from "@shared/schema";
import { ClauseInput } from "./ui/clause-input";
import { GuidedClauseInput } from "./ui/guided-clause-input";
import { useToast } from "@/hooks/use-toast";

interface ContractFormProps {
  onSubmit: (data: ContractFormData) => void;
  isLoading: boolean;
  user: {
    id: string;
    organizationId?: string;
  };
}

const CONTRACT_TEMPLATES = {
  retail: "Create a retail contract with standard terms for product sales, delivery, and returns...",
  insurance: "Create an insurance contract covering general liability, terms of coverage, and claims process...",
  realEstate: "Create a real estate contract for property sale including terms, conditions, and closing requirements...",
  custom: "",
};

export function ContractForm({ onSubmit, isLoading, user }: ContractFormProps) {
  const { toast } = useToast();
  const [signatures, setSignatures] = useState<Array<{name: string, signature: string, date: string}>>([]);
  const [template, setTemplate] = useState<keyof typeof CONTRACT_TEMPLATES | null>(null);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [parties, setParties] = useState<Array<{userId: string, signatureKey: string}>>([]);
  const [hasBilling, setHasBilling] = useState(false);
  const [showBillingDialog, setShowBillingDialog] = useState(false);
  const [currentSignatureKey, setCurrentSignatureKey] = useState("");
  const [paymentSplits, setPaymentSplits] = useState<Array<{userId: string, percentage: number}>>([]);
  const [paymentSplitStatus, setPaymentSplitStatus] = useState<"pending" | "accepted" | "rejected" | "counter">("pending");

  const validatePaymentSplits = () => {
    if (paymentSplits.length === 0) return false;
    const total = paymentSplits.reduce((sum, split) => sum + split.percentage, 0);
    return Math.abs(total - 100) < 0.01; // Allow for small floating point differences
  };

  const handlePaymentSplitUpdate = (userId: string, percentage: number) => {
    const newSplits = [...paymentSplits];
    const index = newSplits.findIndex(p => p.userId === userId);
    if (index >= 0) {
      newSplits[index].percentage = percentage;
    } else {
      newSplits.push({ userId, percentage });
    }
    setPaymentSplits(newSplits);
  };

  const handlePaymentSplitSubmit = async () => {
    if (!validatePaymentSplits()) {
      toast({
        title: "Invalid Payment Split",
        description: "Total percentage must equal 100%",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch('/api/payment-splits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposerId: user.id,
          splits: paymentSplits,
          status: "pending"
        })
      });
    
      if (!response.ok) {
        throw new Error('Failed to submit payment split');
      }
    
      toast({
        title: "Payment Split Submitted",
        description: "Waiting for other parties to accept"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit payment split",
        variant: "destructive"
      });
    }
  };

  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      prompt: "",
    },
  });

  const handleTemplateSelect = (value: keyof typeof CONTRACT_TEMPLATES) => {
    try {
      setTemplate(value);
      if (!user?.id) {
        toast({
          title: "Authentication Required",
          description: "Please log in to create contracts",
          variant: "destructive"
        });
        return;
      }
      if (value === "custom") {
        setIsCustomizing(true);
      } else {
        form.setValue("prompt", CONTRACT_TEMPLATES[value]);
        setIsCustomizing(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to select template",
        variant: "destructive"
      });
    }
  };

  const validateSignatureKey = (key: string): boolean => {
    return /^[A-Za-z0-9]{24}$/.test(key);
  };

  const handleSignatureKeyChange = (value: string) => {
    if (value.length <= 24) {
      setCurrentSignatureKey(value);
      if (value.length === 24 && !validateSignatureKey(value)) {
        toast({
          title: "Invalid Signature Key",
          description: "Signature key must be 24 alphanumeric characters",
          variant: "destructive"
        });
      }
    }
  };

  const handlePartyUpdate = (index: number, userId: string) => {
    const newParties = [...parties];
    newParties[index] = { ...newParties[index], userId };
    
    // Check for duplicate user IDs
    const isDuplicate = newParties.some(
      (party, i) => i !== index && party.userId === userId
    );
    
    if (isDuplicate) {
      toast({
        title: "Duplicate Party",
        description: "This user is already added to the contract",
        variant: "destructive"
      });
      return;
    }
    
    setParties(newParties);
  };

  const handleClausesComplete = async (clauses: string[]) => {
    try {
      if (!clauses.length) {
        toast({
          title: "Error",
          description: "At least one clause is required",
          variant: "destructive"
        });
        return;
      }
    
      if (!user?.id) {
        toast({
          title: "Authentication Required",
          description: "Please log in to create contracts",
          variant: "destructive"
        });
        return;
      }
    
      if (!currentSignatureKey || !validateSignatureKey(currentSignatureKey)) {
        toast({
          title: "Invalid Signature",
          description: "Please provide a valid signature key",
          variant: "destructive"
        });
        return;
      }
    
      if (parties.some(p => !p.userId || !p.signatureKey)) {
        toast({
          title: "Incomplete Party Information",
          description: "All parties must provide both user ID and signature key",
          variant: "destructive"
        });
        return;
      }
    
      const cost = calculateContractCost(parties.length + 1);
      const costPerParty = cost / (parties.length + 1);
    
      // Check if business account and cost > 1000
      if (user?.organizationId && cost > 1000) {
        const approved = await verifyBusinessTransaction(cost, user.organizationId);
        if (!approved) {
          toast({
            title: "Transaction Requires Approval",
            description: "This transaction requires business approval before proceeding.",
            variant: "destructive"
          });
          return;
        }
      }
    
      // Verify payment splits
      if (!validatePaymentSplits()) {
        toast({
          title: "Invalid Payment Split",
          description: "Payment splits must be properly configured and total 100%",
          variant: "destructive"
        });
        return;
      }
    
      // Verify all parties have paid
      let paymentVerified = false;
      try {
        paymentVerified = await verifyAllPartiesPayment(parties, costPerParty);
      } catch (error) {
        toast({
          title: "Payment Verification Error",
          description: error instanceof Error ? error.message : "Failed to verify payments",
          variant: "destructive"
        });
        return;
      }
    
      if (!paymentVerified) {
        toast({
          title: "Payment Required",
          description: "All parties must complete payment before contract deployment",
          variant: "destructive"
        });
        return;
      }
    
      const prompt = `Create a custom smart contract with the following clauses:\n${clauses
        .map((clause, i) => `${i + 1}. ${clause}`)
        .join("\n")}`;
      form.setValue("prompt", prompt);
      setIsCustomizing(false);
    
      // Submit the form
      await form.handleSubmit(onSubmit)();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };


  const updateSignature = (index: number, field: keyof typeof signatures[0], value: string) => {
    const updatedSignatures = [...signatures];
    if (updatedSignatures[index]) {
      updatedSignatures[index][field] = value;
      setSignatures(updatedSignatures);
    }
  };

  const addSignatureLine = () => {
    setSignatures([...signatures, { name: '', signature: '', date: '' }]);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 border border-border/50 p-6 rounded-lg shadow-lg">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-card-foreground mb-4">Contract Details</h2>
          <p className="text-muted-foreground mb-4">Select a template or create a custom contract</p>
        </div>
        <FormField
          control={form.control}
          name="prompt"
          render={() => (
            <FormItem>
              <FormLabel>Select Contract Template</FormLabel>
              <Select onValueChange={handleTemplateSelect}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="retail">Retail Contract</SelectItem>
                  <SelectItem value="insurance">Insurance Contract</SelectItem>
                  <SelectItem value="realEstate">Real Estate Contract</SelectItem>
                  <SelectItem value="employment">Employment Agreement</SelectItem>
                  <SelectItem value="custom">Custom Contract</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {template && (
          template === "custom" ? (
            <ClauseInput onClausesComplete={handleClausesComplete} />
          ) : (
            <GuidedClauseInput 
              template={template} 
              onClausesComplete={handleClausesComplete}
            />
          )
        )}

        {!isCustomizing && template && (
            <div className="mt-6 space-y-4">
              <h3 className="text-lg font-semibold">Contract Parties</h3>
              <div className="space-y-4">
                <div className="p-4 border rounded bg-secondary">
                  <h4 className="font-medium mb-2">Your Signature</h4>
                  <Input
                    type="password"
                    placeholder="Enter your 24-character signature key"
                    value={currentSignatureKey}
                    onChange={(e) => setCurrentSignatureKey(e.target.value)}
                    maxLength={24}
                  />
                </div>
                <div className="p-4 border rounded bg-secondary">
                  <h4 className="font-medium mb-2">Other Parties</h4>
                  {parties.map((party, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <Input
                        type="text"
                        placeholder="Enter counterparty user ID"
                        value={party.userId}
                        onChange={(e) => {
                          const newParties = [...parties];
                          newParties[index].userId = e.target.value;
                          setParties(newParties);
                        }}
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => {
                          const newParties = parties.filter((_, i) => i !== index);
                          setParties(newParties);
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => setParties([...parties, { userId: '', signatureKey: '' }])}
                  >
                    Add Another Party
                  </Button>
                </div>

                <div className="p-6 border rounded-lg mt-4 bg-secondary">
                  <h4 className="font-semibold mb-4 text-lg text-card-foreground">Payment Split</h4>
                  <p className="text-sm text-muted-foreground mb-4">Define how contract costs will be split between parties</p>
                  {[user?.id, ...parties.map(p => p.userId)].filter(Boolean).map((partyId, index) => (
                    <div key={index} className="flex gap-2 mb-2 items-center">
                      <span className="w-1/3">{partyId === user.id ? 'You' : `Party ${index}`}</span>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Percentage"
                        value={paymentSplits.find(p => p.userId === partyId)?.percentage || ''}
                        onChange={(e) => {
                          const newSplits = [...paymentSplits];
                          const index = newSplits.findIndex(p => p.userId === partyId);
                          const value = Number(e.target.value);
                          if (index >= 0) {
                            newSplits[index].percentage = value;
                          } else {
                            newSplits.push({ userId: partyId, percentage: value });
                          }
                          setPaymentSplits(newSplits);
                        }}
                      />
                      <span>%</span>
                    </div>
                  ))}
                  {paymentSplitStatus !== "pending" && (
                    <div className="mt-2">
                      <h5 className="font-medium">Status: {paymentSplitStatus}</h5>
                      {paymentSplitStatus === "counter" && (
                        <Button
                          variant="outline"
                          className="mt-2"
                          onClick={() => setPaymentSplitStatus("pending")}
                        >
                          View Counter Offer
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <AlertDialog open={!hasBilling && showBillingDialog}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Billing Required</AlertDialogTitle>
                      <AlertDialogDescription>
                        To create smart contracts, you need to add a payment method for AI usage and contract deployment fees.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setShowBillingDialog(false)}>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => window.location.href = '/billing'}>Add Payment Method</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <Alert>
                <AlertTitle>Note</AlertTitle>
                <AlertDescription>
                  Both parties must have a Transac account and provide their signature keys to complete the contract.
                </AlertDescription>
              </Alert>
            </div>
          )}
      </form>
    </Form>
  );
}

// Placeholder functions -  These need to be implemented based on your backend and payment system
interface PaymentVerificationResponse {
  verified: boolean;
  message?: string;
}

interface Party {
  userId: string;
  signatureKey: string;
}

async function verifyAllPartiesPayment(parties: Party[], costPerParty: number): Promise<boolean> {
  try {
    if (!Array.isArray(parties) || parties.length === 0) {
      throw new Error("No parties to verify payments for");
    }

    if (costPerParty <= 0) {
      throw new Error("Invalid cost per party amount");
    }

    const verificationPromises = parties.map(async (party) => {
      if (!party.userId || !party.signatureKey) {
        throw new Error(`Invalid party: missing ${!party.userId ? 'userId' : 'signatureKey'}`);
      }

      try {
        const response = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${party.signatureKey}`
          },
          body: JSON.stringify({ 
            userId: party.userId, 
            amount: costPerParty,
            timestamp: Date.now()
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: response.statusText }));
          throw new Error(
            errorData.message || `Payment verification failed for user ${party.userId}: ${response.statusText}`
          );
        }

        const result: PaymentVerificationResponse = await response.json();
        if (!result || typeof result.verified !== 'boolean') {
          throw new Error(`Invalid verification response format for user ${party.userId}`);
        }

        if (!result.verified && result.message) {
          throw new Error(`Payment verification failed: ${result.message}`);
        }

        return result;
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Payment verification failed for user ${party.userId}: ${error.message}`);
        }
        throw new Error(`Payment verification failed for user ${party.userId}: Unknown error`);
      }
    });
    
    try {
      const results = await Promise.all(verificationPromises);
      return results.every(result => result.verified);
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to verify all payments');
    }
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unknown payment verification error');
  }
}

interface BusinessVerificationResponse {
  approved: boolean;
  reason?: string;
}

async function verifyBusinessTransaction(cost: number, organizationId: string): Promise<boolean> {
  try {
    if (cost <= 0) {
      throw new Error("Invalid transaction cost");
    }

    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    const response = await fetch('/api/organizations/verify-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, cost })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Business transaction verification failed: ${response.statusText}`
      );
    }
    
    const result: BusinessVerificationResponse = await response.json();
    if (!result || typeof result.approved !== 'boolean') {
      throw new Error('Invalid business verification response format');
    }
    
    return result.approved;
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unknown business verification error');
  }
}

function calculateContractCost(numParties: number): number {
  const baseCost = 50; // Base cost for contract generation
  const costPerParty = 25; // Cost per additional party
  const complexityFactor = 1.2; // Additional factor for contract complexity
  
  return Math.ceil((baseCost + (numParties * costPerParty)) * complexityFactor);
}

