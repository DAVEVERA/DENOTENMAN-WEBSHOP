"use client";

export function LogoutButton() {
  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="inline-flex min-h-11 items-center font-heading text-body-sm font-semibold text-muted underline decoration-border-hover underline-offset-4 hover:text-text"
    >
      Uitloggen
    </button>
  );
}
