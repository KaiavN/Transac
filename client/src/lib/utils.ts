import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function generateSignatureKey(): Promise<string> {
  // Generate a secure encryption key
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // Export the key to raw format
  const rawKey = await crypto.subtle.exportKey("raw", key);
  const keyArray = Array.from(new Uint8Array(rawKey));
  return keyArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function encryptSignatureKey(key: string): Promise<string> {
  // Generate a secure encryption key
  const encryptionKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    encryptionKey,
    data
  );

  const encryptedArray = new Uint8Array(encrypted);
  return btoa(String.fromCharCode(...iv, ...encryptedArray));
}

export function calculateContractCost(partiesCount: number): number {
  const baseCost = 10; // Base cost in USD
  return baseCost * (1 + (0.05 * (partiesCount - 1)));
}