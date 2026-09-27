"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function useFollow(consultationId: string, initialFollowing: boolean) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (pending) return;
    const next = !following;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/tracking/${consultationId}`, { method: next ? "POST" : "DELETE" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Tracking could not be updated");
      setFollowing(next);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tracking could not be updated");
    } finally {
      setPending(false);
    }
  }

  return { following, toggle, pending, error };
}
