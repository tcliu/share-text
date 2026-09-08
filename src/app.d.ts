declare global {
  namespace App {
    interface Locals {
      user: { id: number; username: string; email: string } | null
    }
  }
}

export {}
