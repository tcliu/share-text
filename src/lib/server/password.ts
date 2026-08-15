import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

function scryptAsync(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, (error, derivedKey) => {
      if (error) {
        reject(error)
      } else {
        resolve(derivedKey)
      }
    })
  })
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const derived = await scryptAsync(password, salt, 32)
  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`
}

function isCanonicalBase64(value: string): boolean {
  if (!value) {
    return false
  }
  const decoded = Buffer.from(value, 'base64')
  return decoded.length > 0 && decoded.toString('base64') === value
}

export function isPasswordHash(value: string): boolean {
  const parts = value.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false
  }
  if (!isCanonicalBase64(parts[1]) || !isCanonicalBase64(parts[2])) {
    return false
  }
  const salt = Buffer.from(parts[1], 'base64')
  const derived = Buffer.from(parts[2], 'base64')
  return salt.length === 16 && derived.length === 32
}

export async function verifyPassword(password: string, hash: string) {
  const parts = hash.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false
  }
  const salt = Buffer.from(parts[1], 'base64')
  const expected = Buffer.from(parts[2], 'base64')
  const actual = await scryptAsync(password, salt, expected.length)
  return timingSafeEqual(actual, expected)
}
