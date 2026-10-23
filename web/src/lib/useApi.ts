"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, errorMessage, type Service } from "@/lib/api";

/** Bumped by the header's Reload button; every useApi below it refetches. */
export const ReloadContext = createContext(0);

/** Calls a bidding-api / contract-api action; refetches when the payload changes or on Reload. */
export function useApi<T>(action: string, payload: Record<string, unknown>, service: Service = "bidding") {
  const key = JSON.stringify(payload);
  const nonce = useContext(ReloadContext);
  const requestKey = `${service}:${action}:${key}#${nonce}`;
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null }>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    api<T>(action, JSON.parse(key), service)
      .then((data) => !cancelled && setState({ key: requestKey, data, error: null }))
      .catch((err) => !cancelled && setState((s) => ({ key: requestKey, data: s.data, error: errorMessage(err) })));
    return () => {
      cancelled = true;
    };
  }, [action, key, service, requestKey]);

  // Keep showing the previous data while the next request is in flight.
  return { data: state.data, error: state.error, loading: state.key !== requestKey };
}
