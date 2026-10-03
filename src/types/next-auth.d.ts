import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      firstName: string;
      lastName: string;
      jobTitle?: string | null;
      organization?: string | null;
      mustChangePassword?: boolean;
    };
  }

  interface User {
    role: Role;
    firstName: string;
    lastName: string;
    jobTitle?: string | null;
    organization?: string | null;
    sessionVersion?: number;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    firstName?: string;
    lastName?: string;
    jobTitle?: string | null;
    organization?: string | null;
    sessionVersion?: number;
    mustChangePassword?: boolean;
  }
}
