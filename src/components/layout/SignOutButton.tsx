"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({
  className,
  label = "Sign out & switch account",
}: {
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      disabled={busy}
      className={className}
      onClick={async () => {
        setBusy(true);
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      {busy ? "Signing out..." : label}
    </button>
  );
}
