import { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            role: string
            clientId?: string | null
            businessType?: string | null
            permissions?: any
        } & DefaultSession["user"]
    }

    interface User {
        id: string
        role: string
        clientId?: string | null
        businessType?: string | null
        permissions?: any
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string
        role: string
        clientId?: string | null
        businessType?: string | null
        permissions?: any
    }
}
