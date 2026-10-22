"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";

/** Bumped by the header's Reload button; every useApi below it refetches. */
export const ReloadContext = createContext(0);

/** Calls a bidding-api action; refetches when the payload changes or on Reload. */
export function useApi<T>(action: string, payload: Record<string, unknown>) {
  const key = JSON.stringify(payload);
  const nonce = useContext(ReloadContext);
  const requestKey = `${key}#${nonce}`;
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null }>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    api<T>(action, JSON.parse(key))
      .then((data) => !cancelled && setState({ key: requestKey, data, error: null }))
      .catch((err) => !cancelled && setState((s) => ({ key: requestKey, data: s.data, error: errorMessage(err) })));
    return () => {
      cancelled = true;
    };
  }, [action, key, requestKey]);

  // Keep showing the previous data while the next request is in flight.
  return { data: state.data, error: state.error, loading: state.key !== requestKey };
}
