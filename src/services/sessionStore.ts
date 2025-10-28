/**
 * Secure session store for the current user's password
 * This is needed to load keys from the database consistently across all screens
 * 
 * SECURITY NOTE: In production, consider using a more secure approach like:
 * - Encrypted session tokens
 * - Device-specific key derivation
 * - Biometric authentication
 * 
 * For now, we store the password in memory only (cleared on app close/refresh)
 */

let currentPassword: string | null = null;

export function setSessionPassword(password: string): void {
  currentPassword = password;
}

export function getSessionPassword(): string | null {
  return currentPassword;
}

export function clearSessionPassword(): void {
  currentPassword = null;
}
