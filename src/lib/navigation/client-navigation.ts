export type ClientPrimaryAction = "assistant" | "new-consultation";

export interface ClientNavigation {
  consultationsHref: "/consultations";
  primaryHref: "/assistant";
  primaryAction: ClientPrimaryAction;
}

export function getClientNavigation(isAuthenticated: boolean): ClientNavigation {
  return {
    consultationsHref: "/consultations",
    primaryHref: "/assistant",
    primaryAction: isAuthenticated ? "new-consultation" : "assistant",
  };
}
