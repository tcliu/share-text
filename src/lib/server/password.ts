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
