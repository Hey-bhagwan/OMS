import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { prisma } from "@/server/db/prisma";

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

  const decoded = await verifySessionToken(token);
  if (!decoded) return null;

  // ✅ Verify user still exists and is active in the database.
  // This ensures deleted or deactivated users cannot use old JWT tokens.
  const dbUser = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  if (!dbUser || !dbUser.isActive) return null;

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
  };
}

export { SESSION_COOKIE_NAME };

/**
 * Use in route handlers that need a guaranteed authenticated user.
 * Returns the session user, or throws a Response-shaped error caught by the caller.
 * Usage: const user = await requireAuth(); // throws NextResponse 401 if not authed
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    // This will be caught by the try/catch in route handlers and returned as-is
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  return user;
}
