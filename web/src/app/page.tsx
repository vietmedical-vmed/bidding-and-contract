"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Static export has no server redirects: send "/" to the bidding dashboard on the client. */
export default function Home() {
  const router = useRouter();
  useEffect(() => router.replace("/thau/"), [router]);
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="spinner" />
    </div>
  );
}
