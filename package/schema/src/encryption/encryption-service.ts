export interface SchemaEncryptionService {
  encrypt(plaintext: string): Promise<string>
  decrypt(ciphertext: string): Promise<string>
  /**
   * Optional key rotation hook: re-protect a stored value under the current
   * key without producing plaintext. Return null when no change is needed.
   */
  rewrap?(ciphertext: string): Promise<string | null>
  /**
   * Optional: true when the value is already an encrypted envelope. Writes
   * skip such values, so a document read without decryption can be written
   * back without being encrypted twice.
   */
  isEncrypted?(value: string): boolean
}
