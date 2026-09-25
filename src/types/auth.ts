import type { Role } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  jobTitle?: string | null;
  organization?: string | null;
};
