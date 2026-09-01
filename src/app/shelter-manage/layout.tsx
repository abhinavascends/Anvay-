import { redirect } from "next/navigation";
import { getUserRole, getSafeUser } from "@/lib/supabase/server";

// Gate: only SHELTER_MANAGER (and ADMIN) may access the shelter console.
export default async function ShelterManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSafeUser();
  if (!user) redirect("/login");

  const role = await getUserRole();

  switch (role) {
    case "SHELTER_MANAGER":
    case "ADMIN":
      break; // allowed
    case "OPERATOR":
      redirect("/dashboard");
    case "FIELD_TEAM":
      redirect("/team");
    case "CITIZEN":
    default:
      redirect("/citizen");
  }

  return <>{children}</>;
}
