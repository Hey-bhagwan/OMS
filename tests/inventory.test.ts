import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken } from "../src/server/auth/session";

describe("Security & Session Authentication", () => {
  it("creates and verifies cryptographic session tokens for user roles", async () => {
    const user = {
      id: "usr-12345",
      email: "ops@koaliving.com",
      name: "Ops Head",
      role: "OPERATIONS_MANAGER" as const,
    };

    const token = await createSessionToken(user);
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");

    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(user.id);
    expect(verified?.email).toBe(user.email);
    expect(verified?.role).toBe("OPERATIONS_MANAGER");
  });

  it("fails verification for tampered or invalid tokens", async () => {
    const verified = await verifySessionToken("invalid_tampered_jwt_token");
    expect(verified).toBeNull();
  });
});
