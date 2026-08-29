import "server-only";

export interface AnonymousActor {
  kind: "anonymous";
  requestId: string;
}

export interface GuestActor {
  kind: "guest";
  intakeSessionId: string;
  token: string;
  requestId: string;
}

export interface UserActor {
  kind: "user";
  userId: string;
  requestId: string;
}

export interface SystemActor {
  kind: "system";
  service: string;
  requestId: string;
}

export type Actor = AnonymousActor | GuestActor | UserActor | SystemActor;
