"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AnalysisRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="flex flex-col justify-center items-center py-24 text-center bg-canvas text-ink">
      <span className="text-caption text-muted font-bold uppercase tracking-wider block mb-1">
        Consolidating Workspace...
      </span>
      <p className="text-caption text-muted m-0">
        Redirecting you to the unified Data Analyst Workstation on the homepage.
      </p>
    </div>
  );
}
