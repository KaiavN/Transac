import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";

interface ValidationResultsProps {
  results: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
  };
}

export function ValidationResults({ results }: ValidationResultsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {results.isValid ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-500" />
          )}
          Validation Results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {results.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold">Errors:</div>
              <ul className="list-disc pl-4">
                {results.errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {results.warnings.length > 0 && (
          <Alert variant="default">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold">Warnings:</div>
              <ul className="list-disc pl-4">
                {results.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {results.suggestions.length > 0 && (
          <Alert>
            <AlertDescription>
              <div className="font-semibold">Suggestions:</div>
              <ul className="list-disc pl-4">
                {results.suggestions.map((suggestion, i) => (
                  <li key={i}>{suggestion}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}