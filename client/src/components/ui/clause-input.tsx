
import { useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Textarea } from "./textarea";

interface ClauseInputProps {
  onClausesComplete: (clauses: string[]) => void;
}

export function ClauseInput({ onClausesComplete }: ClauseInputProps) {
  const [clauses, setClauses] = useState<string[]>([""]);

  const addClause = () => {
    setClauses([...clauses, ""]);
  };

  const updateClause = (index: number, value: string) => {
    const newClauses = [...clauses];
    newClauses[index] = value;
    setClauses(newClauses);
  };

  const removeClause = (index: number) => {
    const newClauses = clauses.filter((_, i) => i !== index);
    setClauses(newClauses);
  };

  const handleComplete = () => {
    const validClauses = clauses.filter((clause) => clause.trim() !== "");
    onClausesComplete(validClauses);
  };

  return (
    <div className="space-y-4">
      {clauses.map((clause, index) => (
        <div key={index} className="flex gap-2">
          <Textarea
            value={clause}
            onChange={(e) => updateClause(index, e.target.value)}
            placeholder={`Clause ${index + 1}`}
            className="flex-1"
          />
          <Button
            variant="destructive"
            size="icon"
            onClick={() => removeClause(index)}
            className="shrink-0"
          >
            X
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button onClick={addClause} variant="outline" className="flex-1">
          Add Clause
        </Button>
        <Button onClick={handleComplete} className="flex-1">
          Complete
        </Button>
      </div>
    </div>
  );
}
