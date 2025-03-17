
import { useState } from "react";
import { Button } from "./button";
import { Textarea } from "./textarea";
import { Label } from "./label";
import { Alert } from "./alert";

interface ClauseGuide {
  title: string;
  description: string;
  placeholder: string;
}

const TEMPLATE_GUIDES: Record<string, ClauseGuide[]> = {
  retail: [
    {
      title: "Product Description",
      description: "Define the products being sold, including specifications and quantities",
      placeholder: "Enter details about the products covered by this contract..."
    },
    {
      title: "Pricing Terms",
      description: "Specify pricing, payment terms, and any volume discounts",
      placeholder: "Define the pricing structure and payment terms..."
    },
    {
      title: "Delivery Terms",
      description: "Outline delivery timeframes, shipping responsibilities, and costs",
      placeholder: "Specify delivery and shipping arrangements..."
    },
    {
      title: "Return Policy",
      description: "Detail the conditions and process for returns or exchanges",
      placeholder: "Define the return policy terms..."
    }
  ],
  insurance: [
    {
      title: "Coverage Scope",
      description: "Define what is being insured and coverage limits",
      placeholder: "Specify the insurance coverage details..."
    },
    {
      title: "Premium Terms",
      description: "Detail the premium amount, payment schedule, and conditions",
      placeholder: "Define the premium structure..."
    },
    {
      title: "Claims Process",
      description: "Outline the process for filing and handling claims",
      placeholder: "Specify the claims procedure..."
    },
    {
      title: "Exclusions",
      description: "List situations or conditions not covered by the insurance",
      placeholder: "Detail the exclusions..."
    }
  ],
  realEstate: [
    {
      title: "Property Details",
      description: "Describe the property including location and specifications",
      placeholder: "Enter property details..."
    },
    {
      title: "Purchase Price",
      description: "Specify the purchase price and payment terms",
      placeholder: "Define the purchase price and payment structure..."
    },
    {
      title: "Closing Terms",
      description: "Detail the closing process and requirements",
      placeholder: "Specify closing conditions..."
    },
    {
      title: "Contingencies",
      description: "List any conditions that must be met for the sale",
      placeholder: "Define contingencies..."
    }
  ],
  employment: [
    {
      title: "Position and Duties",
      description: "Define the job title, responsibilities, and reporting structure",
      placeholder: "Specify the role and key responsibilities..."
    },
    {
      title: "Compensation",
      description: "Detail salary, bonuses, benefits, and payment schedule",
      placeholder: "Define the compensation package..."
    },
    {
      title: "Term and Termination",
      description: "Specify employment duration, notice periods, and termination conditions",
      placeholder: "Enter employment term and termination details..."
    },
    {
      title: "Confidentiality",
      description: "Define confidentiality obligations and intellectual property rights",
      placeholder: "Specify confidentiality terms..."
    },
    {
      title: "Working Conditions",
      description: "Detail work hours, location, and any special conditions",
      placeholder: "Define working arrangements..."
    }
  ]
};

interface GuidedClauseInputProps {
  template: string;
  onClausesComplete: (clauses: string[]) => void;
}

export function GuidedClauseInput({ template, onClausesComplete }: GuidedClauseInputProps) {
  const guides = TEMPLATE_GUIDES[template] || [];
  const [clauses, setClauses] = useState<string[]>(Array(guides.length).fill(""));

  const updateClause = (index: number, value: string) => {
    const newClauses = [...clauses];
    newClauses[index] = value;
    setClauses(newClauses);
  };

  const handleComplete = () => {
    const validClauses = clauses.filter((clause) => clause.trim() !== "");
    if (validClauses.length === guides.length) {
      onClausesComplete(validClauses);
    }
  };

  return (
    <div className="space-y-6">
      {guides.map((guide, index) => (
        <div key={index} className="space-y-2">
          <Label className="text-lg font-semibold">{guide.title}</Label>
          <Alert className="mb-2">{guide.description}</Alert>
          <Textarea
            value={clauses[index]}
            onChange={(e) => updateClause(index, e.target.value)}
            placeholder={guide.placeholder}
            className="min-h-[100px]"
          />
        </div>
      ))}
      <Button 
        onClick={handleComplete} 
        className="w-full"
        disabled={clauses.some(clause => !clause.trim())}
      >
        Complete Contract
      </Button>
    </div>
  );
}
