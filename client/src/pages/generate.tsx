import { ContractForm } from "@/components/contract-form";
import { useMutation } from "@tanstack/react-query";
import { generateContract } from "@/lib/code-generator";
import { useToast } from "@/hooks/use-toast";
import type { Contract } from "@shared/schema";
import { useState } from "react";
import { CodeEditor } from "@/components/ui/code-editor";
import { ValidationResults } from "@/components/validation-results";
import { useAuth } from "@/context/auth-context";

export default function Generate() {
  const { user } = useAuth();
  const [contract, setContract] = useState<Contract | null>(null);
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: generateContract,
    onSuccess: (data) => {
      setContract(data);
      toast({
        title: "Contract generated",
        description: "Your smart contract has been generated and validated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Extract the necessary fields safely
  const safeUser = user ? { id: user.id, organizationId: user.organizationId } : undefined;

  return (
      <div className="container mx-auto py-8 px-4 max-w-5xl min-h-screen bg-background">
        <div className="space-y-8 pb-16">
          <h1 className="text-3xl font-bold text-foreground">Generate New Contract</h1>
          <div className="grid gap-8 md:grid-cols-2">
            {safeUser && (
                <ContractForm
                    onSubmit={(data) => generateMutation.mutate(data.prompt)}
                    isLoading={generateMutation.isPending}
                    user={safeUser} // safely pass minimal required user info here
                />
            )}

            {!safeUser && <div>Please log in to generate contracts.</div>}

            {contract && (
                <div className="space-y-6 bg-card p-6 rounded-lg shadow-lg">
                  <ValidationResults results={contract.validationResults} />
                </div>
            )}
          </div>
          {contract && <CodeEditor code={contract.code} className="w-full" />}
        </div>
      </div>
  );
}