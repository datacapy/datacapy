export interface SchemaEncryptionService {
  encrypt(plaintext: string): Promise<string>
  decrypt(ciphertext: string): Promise<string>
  /**
   * Optional key rotation hook: re-protect a stored value under the current
   * key without producing plaintext. Return null when no change is needed.
   */
  rewrap?(ciphertext: string): Promise<string | null>
}
