import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { config } from "../config/index.js";

/**
 * HIPAA-compliant encryption utilities for PHI at rest
 * Uses AES-256-GCM encryption
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

/**
 * Encrypt sensitive data (PHI) for storage
 * @param text - Plaintext to encrypt
 * @returns Encrypted data as hex string including IV
 */
export function encrypt(text: string): string {
  const key = Buffer.from(config.encryption.key, "hex");
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Combine IV + encrypted data + auth tag
  return iv.toString("hex") + ":" + encrypted + ":" + authTag.toString("hex");
}

/**
 * Decrypt sensitive data (PHI) from storage
 * @param encryptedData - Encrypted data as hex string (IV:data:authTag)
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const key = Buffer.from(config.encryption.key, "hex");
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];
  const authTag = Buffer.from(parts[2], "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Generate a new secure encryption key
 * Returns 32-byte (64 hex chars) key for AES-256
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}
