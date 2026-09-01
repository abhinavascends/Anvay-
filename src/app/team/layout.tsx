import { redirect } from "next/navigation";
import { getUserRole, getSafeUser } from "@/lib/supabase/server";

// Gate: only FIELD_TEAM (and ADMIN) may access the team console.
export default async function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSafeUser();
  if (!user) redirect("/login");

  const role = await getUserRole();

  switch (role) {
    case "FIELD_TEAM":
    case "ADMIN":
      break; // allowed
    case "OPERATOR":
      redirect("/dashboard");
    case "SHELTER_MANAGER":
      redirect("/shelter-manage");
    case "CITIZEN":
    default:
      redirect("/citizen");
  }

  return <>{children}</>;
}
