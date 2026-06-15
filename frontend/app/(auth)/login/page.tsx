"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="flex justify-center items-center py-20 bg-canvas text-ink">
      <div className="text-center flex flex-col gap-2">
        <h2 className="font-cal text-xl font-bold">Local Playground</h2>
        <p className="text-caption text-muted">Authentication is bypassed in this local workspace. Redirecting...</p>
      </div>
    </div>
  );
}
