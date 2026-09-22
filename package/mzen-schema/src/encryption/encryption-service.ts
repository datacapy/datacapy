export interface SchemaEncryptionService {
  /**
   * `context` (optional, backward-compatible) binds the ciphertext to
   * something identifying where it belongs - typically the field's path -
   * so a value copied to a different location fails to decrypt rather than
   * silently succeeding. The same string must be supplied to `decrypt()`.
   */
  encrypt(plaintext: string, context?: string): Promise<string>
  decrypt(ciphertext: string, context?: string): Promise<string>
}
