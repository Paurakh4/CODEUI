import "server-only"

import crypto from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const SALT = "codeui-byok-v1"
const KEY_LENGTH = 32

let cachedKey: Buffer | null = null

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey

  const envKey = process.env.BYOK_ENCRYPTION_KEY
  if (!envKey) {
    throw new Error(
      "BYOK_ENCRYPTION_KEY is not set. Generate one with: openssl rand -hex 32",
    )
  }

  cachedKey = crypto.scryptSync(envKey, SALT, KEY_LENGTH)
  return cachedKey
}

export interface EncryptedPayload {
  ciphertext: string
  iv: string
}

export function encrypt(plaintext: string): EncryptedPayload {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])

  const authTag = cipher.getAuthTag()

  return {
    ciphertext: Buffer.concat([encrypted, authTag]).toString("base64"),
    iv: iv.toString("base64"),
  }
}

export function decrypt(ciphertext: string, iv: string): string {
  const key = getEncryptionKey()
  const rawData = Buffer.from(ciphertext, "base64")
  const ivBuf = Buffer.from(iv, "base64")

  const authTag = rawData.subarray(rawData.length - 16)
  const encryptedData = rawData.subarray(0, rawData.length - 16)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuf)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}

export function hasEncryptionKey(): boolean {
  return Boolean(process.env.BYOK_ENCRYPTION_KEY)
}
