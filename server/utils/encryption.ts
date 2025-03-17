import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Environment variables for encryption keys should be properly set in production
// In production, these should be set as environment variables or loaded from a secure vault
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'fallback-key-for-development-only-32chars';

// Generate a unique IV for each encryption operation instead of using a static one
// This is more secure as it prevents patterns from being detected across multiple encryptions

// Check if we're using fallback keys in production
if (process.env.NODE_ENV === 'production' && 
    ENCRYPTION_KEY === 'fallback-key-for-development-only-32chars') {
  console.error('WARNING: Using fallback encryption keys in production environment!');
  // In a real production app, you might want to exit the process here
  // process.exit(1);
}

/**
 * Encrypts sensitive data before storing in database
 * Uses AES-256-GCM encryption algorithm which provides both confidentiality and authenticity
 * 
 * @param text - Plain text to encrypt
 * @returns Encrypted text with authentication tag and IV (JSON string)
 */
export function encrypt(text: string): string {
  try {
    if (!text) {
      throw new Error('Cannot encrypt empty or null data');
    }
    
    // Generate a random IV for each encryption operation (best practice)
    const iv = crypto.randomBytes(16);
    
    // Ensure key is proper length for AES-256
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    
    // Use GCM mode which provides authentication
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get the authentication tag
    const authTag = cipher.getAuthTag().toString('base64');
    
    // Return everything needed for decryption
    const result = {
      content: encrypted,
      iv: iv.toString('base64'),
      tag: authTag
    };
    
    return JSON.stringify(result);
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts data retrieved from database
 * 
 * @param encryptedData - Encrypted data JSON string containing content, iv, and tag
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string): string {
  try {
    // Parse the encrypted data
    let parsed;
    try {
      parsed = JSON.parse(encryptedData);
    } catch (e) {
      // Handle legacy format (for backward compatibility)
      return legacyDecrypt(encryptedData);
    }
    
    const { content, iv, tag } = parsed;
    
    if (!content || !iv || !tag) {
      throw new Error('Invalid encrypted data format');
    }
    
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const ivBuffer = Buffer.from(iv, 'base64');
    const authTag = Buffer.from(tag, 'base64');
    
    // Use GCM mode with authentication
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(content, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Legacy decryption function for backward compatibility
 * 
 * @param encryptedText - Encrypted text in old format (base64 encoded)
 * @returns Decrypted plain text
 */
function legacyDecrypt(encryptedText: string): string {
  try {
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    // Derive a deterministic IV from the key for legacy decryption
    const iv = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest().slice(0, 16);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Legacy decryption error:', error);
    throw new Error('Failed to decrypt data with legacy method');
  }
}

/**
 * Masks sensitive data for display or logging
 * 
 * @param accountNumber - Full account number
 * @returns Masked account number (e.g., ****1234)
 */
export function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber || accountNumber.length < 4) {
    return '****';
  }
  
  const lastFour = accountNumber.slice(-4);
  return '****' + lastFour;
}

/**
 * Sanitizes input to prevent injection attacks
 * More comprehensive sanitization for different contexts
 * 
 * @param input - User input to sanitize
 * @param context - Context of sanitization (default: 'text')
 * @returns Sanitized input
 */
export function sanitizeInput(input: string, context: 'text' | 'html' | 'sql' | 'js' = 'text'): string {
  if (!input) return '';
  
  switch (context) {
    case 'html':
      // For HTML contexts, replace special characters with HTML entities
      return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
      
    case 'sql':
      // For SQL contexts, escape quotes and remove dangerous patterns
      return input
        .replace(/'/g, "''")
        .replace(/;/g, '') // Remove semicolons to prevent multiple statements
        .replace(/--/g, '') // Remove SQL comments
        .replace(/\/\*/g, '')
        .replace(/\*\//g, '');
      
    case 'js':
      // For JavaScript contexts, escape quotes and remove script tags
      return input
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'") 
        .replace(/<\/?script/gi, '');
      
    case 'text':
    default:
      // For general text, remove potentially dangerous characters
      return input.replace(/[<>"'&;]/g, '');
  }
}

/**
 * Validates a routing number using the ABA algorithm
 * 
 * @param routingNumber - 9-digit routing number
 * @returns boolean indicating if routing number is valid
 */
export function validateRoutingNumber(routingNumber: string): boolean {
  // Clean the input first
  const cleaned = routingNumber.replace(/[^0-9]/g, '');
  
  if (!/^\d{9}$/.test(cleaned)) {
    return false;
  }
  
  // Check if it's not a test routing number
  if (/^\d{9}$/.test(cleaned) && 
      (cleaned.startsWith('00') || 
       cleaned === '111111111' || 
       cleaned === '123456789')) {
    return false;
  }
  
  const digits = cleaned.split('').map(Number);
  
  // First two digits should be valid Federal Reserve routing symbol (01-12)
  const frDigits = parseInt(cleaned.substring(0, 2), 10);
  if (frDigits < 1 || frDigits > 12) {
    return false;
  }
  
  // Apply the ABA checksum algorithm
  const sum = 
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    1 * (digits[2] + digits[5] + digits[8]);
  
  return sum % 10 === 0;
}

/**
 * Validates a sort code (UK bank code)
 * 
 * @param sortCode - 6-digit sort code
 * @returns boolean indicating if sort code format is valid
 */
export function validateSortCode(sortCode: string): boolean {
  // Clean the input first
  const cleaned = sortCode.replace(/[^0-9]/g, '');
  
  // UK sort codes are 6 digits
  return /^\d{6}$/.test(cleaned);
}

/**
 * Validates an IBAN (International Bank Account Number)
 * 
 * @param iban - IBAN to validate
 * @returns boolean indicating if IBAN is valid
 */
export function validateIBAN(iban: string): boolean {
  // Remove spaces and convert to uppercase
  const cleanedIBAN = iban.replace(/\s+/g, '').toUpperCase();
  
  // Basic format check
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(cleanedIBAN)) {
    return false;
  }
  
  // Move the first 4 characters to the end
  const rearranged = cleanedIBAN.substring(4) + cleanedIBAN.substring(0, 4);
  
  // Convert letters to numbers (A=10, B=11, ...)
  let converted = '';
  for (let i = 0; i < rearranged.length; i++) {
    const char = rearranged.charAt(i);
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) { // A-Z
      converted += (code - 55).toString();
    } else {
      converted += char;
    }
  }
  
  // Perform mod-97 operation
  let remainder = 0;
  for (let i = 0; i < converted.length; i += 7) {
    const chunk = remainder + converted.substring(i, i + 7);
    remainder = parseInt(chunk, 10) % 97;
  }
  
  return remainder === 1;
}

/**
 * Generates a secure random token
 * 
 * @param length - Length of the token to generate
 * @returns Secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}