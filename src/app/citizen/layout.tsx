import { redirect } from "next/navigation";
import { getUserRole, getSafeUser } from "@/lib/supabase/server";

// Gate: CITIZEN may view this. All other roles go to their own dashboards.
export default async function CitizenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSafeUser();
  if (!user) redirect("/login");

  const role = await getUserRole();

  switch (role) {
    case "OPERATOR":
    case "ADMIN":
      redirect("/dashboard");
    case "FIELD_TEAM":
      redirect("/team");
    case "SHELTER_MANAGER":
      redirect("/shelter-manage");
    case "CITIZEN":
    default:
      break; // allowed
  }

  return <>{children}</>;
}
