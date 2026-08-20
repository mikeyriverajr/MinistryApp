// src/utils/crypto.ts
// Utility for encrypting and decrypting data using the Web Crypto API
// This ensures data is secure before leaving the device.

// Derives a cryptographic key from a simple PIN or password
async function getKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypts a string (e.g., JSON stringified data) using a PIN
export async function encryptData(text: string, pin: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error("Cifrado no soportado. Usa HTTPS o instala la aplicación.");
  }
  try {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await getKey(pin, salt);

    const encryptedContent = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      enc.encode(text)
    );

    // Combine salt, iv, and encrypted content into a single base64 string for storage
    const encryptedBytes = new Uint8Array(encryptedContent);
    const combined = new Uint8Array(salt.length + iv.length + encryptedBytes.length);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(encryptedBytes, salt.length + iv.length);

    // Convert to base64
    const binary = Array.from(combined).map(b => String.fromCharCode(b)).join('');
    return btoa(binary);
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

// Decrypts a base64 string back into the original string
export async function decryptData(base64String: string, pin: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error("Descifrado no soportado. Usa HTTPS o instala la aplicación.");
  }
  try {
    const binary = atob(base64String);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      combined[i] = binary.charCodeAt(i);
    }

    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encryptedBytes = combined.slice(28);

    const key = await getKey(pin, salt);

    const decryptedContent = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encryptedBytes
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedContent);
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data. Invalid PIN or corrupted data.");
  }
}
