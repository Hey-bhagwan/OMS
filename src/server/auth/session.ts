import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || "koa-living-production-super-secret-key-32-chars-min"
);

const SESSION_COOKIE_NAME = "koa_session_token";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export type Permission =
  | "orders:view"
  | "orders:edit"
  | "orders:allocate"
  | "orders:override"
  | "inventory:view"
  | "inventory:adjust"
  | "inventory:receipt"
  | "production:view"
  | "production:edit"
  | "packing:view"
  | "packing:edit"
  | "dispatch:view"
  | "dispatch:edit"
  | "settings:view"
  | "settings:edit"
  | "users:manage"
  | "reports:view"
  | "reports:export";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "orders:view", "orders:edit", "orders:allocate", "orders:override",
    "inventory:view", "inventory:adjust", "inventory:receipt",
    "production:view", "production:edit",
    "packing:view", "packing:edit",
    "dispatch:view", "dispatch:edit",
    "settings:view", "settings:edit",
    "users:manage",
    "reports:view", "reports:export"
  ],
  OPERATIONS_MANAGER: [
    "orders:view", "orders:edit", "orders:allocate", "orders:override",
    "inventory:view", "inventory:adjust",
    "production:view", "production:edit",
    "packing:view", "packing:edit",
    "dispatch:view", "dispatch:edit",
    "reports:view", "reports:export"
  ],
  INVENTORY_MANAGER: [
    "orders:view",
    "inventory:view", "inventory:adjust", "inventory:receipt",
    "reports:view", "reports:export"
  ],
  PRODUCTION_STAFF: [
    "orders:view",
    "inventory:view",
    "production:view", "production:edit"
  ],
  PACKING_STAFF: [
    "orders:view",
    "inventory:view",
    "packing:view", "packing:edit"
  ],
  DISPATCH_STAFF: [
    "orders:view",
    "inventory:view",
    "dispatch:view", "dispatch:edit"
  ],
  AUDITOR: [
    "orders:view",
    "inventory:view",
    "production:view",
    "packing:view",
    "dispatch:view",
    "reports:view", "reports:export"
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY);
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}

export { SESSION_COOKIE_NAME };
