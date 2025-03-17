import { apiRequest } from "./queryClient";
import type { Contract, ValidationResults } from "@shared/schema";

export async function generateContract(prompt: string): Promise<Contract> {
  try {
    if (!prompt || prompt.trim().length < 10) {
      throw new Error("Prompt must be at least 10 characters long");
    }

    const response = await apiRequest("POST", "/api/contracts/generate", { prompt });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Contract generation failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Validate response data structure
    if (!data || typeof data !== 'object') {
      throw new Error("Invalid response format from server");
    }

    if (!data.code || typeof data.code !== 'string') {
      throw new Error("Missing or invalid contract code in response");
    }

    if (!data.validationResults || typeof data.validationResults !== 'object') {
      throw new Error("Missing or invalid validation results in response");
    }

    const validationResults = data.validationResults as ValidationResults;
    if (typeof validationResults.isValid !== 'boolean' || !Array.isArray(validationResults.errors)) {
      throw new Error("Invalid validation results structure");
    }

    return data as Contract;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to generate contract: Unknown error");
  }
}
