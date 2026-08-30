export type UserRole = "partner" | "consultant" | "client";

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  roleTitle: string;
  email: string;
  companyName?: string;
  caseReference?: string;
  avatarInitials: string;
}

export const PRESET_USERS: Record<string, AuthUser> = {
  partner: {
    id: "usr-partner-001",
    name: "Hendrik Prasetyo, BAP, S.H.",
    role: "partner",
    roleTitle: "Senior Tax Partner",
    email: "hendrik.prasetyo@meridiantax.com",
    avatarInitials: "HP",
  },
  consultant: {
    id: "usr-consultant-002",
    name: "Maya Kusuma, S.E., BKP",
    role: "consultant",
    roleTitle: "Transfer Pricing & Controversy Lead",
    email: "maya.kusuma@meridiantax.com",
    avatarInitials: "MK",
  },
  client: {
    id: "usr-client-001",
    name: "Budi Santoso",
    role: "client",
    roleTitle: "Director of Finance",
    companyName: "PT Nusantara Jaya Abadi",
    caseReference: "MER-2026-8921",
    email: "budi.santoso@nusantarajaya.co.id",
    avatarInitials: "BS",
  },
};

const SESSION_COOKIE_NAME = "meridian_auth_session";

export function getClientSession(): AuthUser | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) return null;
  try {
    const raw = decodeURIComponent(match.split("=")[1]);
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setClientSession(user: AuthUser): void {
  if (typeof document === "undefined") return;
  const val = encodeURIComponent(JSON.stringify(user));
  document.cookie = `${SESSION_COOKIE_NAME}=${val}; path=/; max-age=86400; SameSite=Lax`;
}

export function clearClientSession(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}
