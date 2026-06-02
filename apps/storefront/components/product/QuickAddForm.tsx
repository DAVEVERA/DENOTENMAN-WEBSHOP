"use client";

import { useState } from "react";
import { Icon } from "../ui/Icon";

type QuickAddFormProps = {
  ariaLabel?: string;
  buttonLabel?: string;
  className?: string;
  iconName?: string;
  quantity?: number;
  slug: string;
  statusId?: string;
  variantId?: string | null;
  weightId?: string | null;
};

type QuickAddStatus = "idle" | "pending" | "success" | "error";

export function QuickAddForm({
  ariaLabel,
  buttonLabel = "Snel toevoegen",
  className = "",
  iconName = "plus_icon",
  quantity = 1,
  slug,
  statusId,
  variantId = null,
  weightId = null,
}: QuickAddFormProps) {
  const [status, setStatus] = useState<QuickAddStatus>("idle");
  const [message, setMessage] = useState("");
  const noticeId = statusId ?? `${slug}-quick-status`;

  async function handleAdd() {
    setStatus("pending");
    setMessage("");

    try {
      const response = await fetch("/api/cart/quick-add", {
        body: JSON.stringify({
          quantity,
          slug,
          variantId,
          weightId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message || "Toevoegen is niet gelukt.");
      }

      setStatus("success");
      setMessage(payload.message || "Toegevoegd aan je winkelwagen.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Toevoegen is niet gelukt.");
    }
  }

  return (
    <form className={`quick-add-form ${className}`.trim()}>
      <button
        type="button"
        disabled={status === "pending"}
        aria-describedby={status === "success" || status === "error" ? noticeId : undefined}
        aria-label={ariaLabel}
        onClick={handleAdd}
      >
        <Icon name={iconName} />
        <span>{status === "pending" ? "Toevoegen..." : buttonLabel}</span>
      </button>

      {(status === "success" || status === "error") && (
        <p className={`quick-add-form__notice quick-add-form__notice--${status}`} id={noticeId} role="status">
          {message}
        </p>
      )}
    </form>
  );
}
