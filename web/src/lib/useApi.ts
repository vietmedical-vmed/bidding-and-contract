"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";

/** Calls a bidding-api action and refetches whenever the payload changes. */
export function useApi<T>(action: string, payload: Record<string, unknown>) {
  const key = JSON.stringify(payload);
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null }>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    api<T>(action, JSON.parse(key))
      .then((data) => !cancelled && setState({ key, data, error: null }))
      .catch((err) => !cancelled && setState({ key, data: null, error: errorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [action, key]);

  // Keep showing the previous data while the next request is in flight.
  return { data: state.data, error: state.error, loading: state.key !== key };
}
