import type { DesignStudioProviderStatuses } from "@/lib/design-studio/provider-status";

export type DesignStudioBadge = { className: string; label: string; detail?: string };

export const plannedBadge: DesignStudioBadge = { className: "bg-background text-muted", label: "Gepland" };

export function photoRoomBadge(status: DesignStudioProviderStatuses["photoroom"]): DesignStudioBadge {
  const { availability } = status;
  if (availability.status === "ready") {
    return { className: "bg-green-100 text-green-800", label: "Klaar", detail: `${availability.availableCredits} credits` };
  }
  if (availability.status === "insufficient_credits") {
    return { className: "bg-amber-100 text-amber-900", label: availability.availableCredits === 0 ? "Tegoed op" : "Tegoed te laag" };
  }
  if (availability.status === "invalid_configuration") {
    return { className: "bg-red-50 text-red-800", label: "Sleutel geweigerd" };
  }
  if (availability.status === "unavailable") {
    return { className: "bg-red-50 text-red-800", label: "Niet bereikbaar" };
  }
  return { className: "bg-red-50 text-red-800", label: "Niet geconfigureerd" };
}

export function vModelBadge(status: DesignStudioProviderStatuses["vmodel"]): DesignStudioBadge {
  if (!status.configured) return { className: "bg-red-50 text-red-800", label: "Niet geconfigureerd" };
  const remaining = Math.max(0, status.dailyLimit - status.attemptsUsed);
  if (remaining === 0) {
    return { className: "bg-amber-100 text-amber-900", label: "Limiet bereikt", detail: `${status.attemptsUsed} van ${status.dailyLimit} vandaag` };
  }
  return { className: "bg-green-100 text-green-800", label: "Klaar", detail: `${remaining} van ${status.dailyLimit} vandaag` };
}

export function copywriterBadge(status: DesignStudioProviderStatuses["copywriter"]): DesignStudioBadge {
  return status.configured
    ? { className: "bg-green-100 text-green-800", label: "Klaar" }
    : { className: "bg-red-50 text-red-800", label: "Niet geconfigureerd" };
}
