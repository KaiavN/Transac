import { contracts, type Contract, type InsertContract } from "@shared/schema";

export interface IStorage {
  createContract(contract: InsertContract): Promise<Contract>;
  getContract(id: number): Promise<Contract | undefined>;
  getAllContracts(): Promise<Contract[]>;
}

export class MemStorage implements IStorage {
  private contracts: Map<number, Contract>;
  private currentId: number;

  constructor() {
    this.contracts = new Map();
    this.currentId = 1;
  }

  async createContract(contract: InsertContract): Promise<Contract> {
    const id = this.currentId++;
    const newContract: Contract = {
      ...contract,
      id,
      createdAt: new Date(),
      isValid: contract.isValid ?? false, // Ensure isValid has a default value
    };
    this.contracts.set(id, newContract);
    return newContract;
  }

  async getContract(id: number): Promise<Contract | undefined> {
    return this.contracts.get(id);
  }

  async getAllContracts(): Promise<Contract[]> {
    return Array.from(this.contracts.values());
  }
}

export const storage = new MemStorage();