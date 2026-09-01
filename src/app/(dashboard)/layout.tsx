import { redirect } from "next/navigation";
import { getUserRole, getSafeUser } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSafeUser();
  if (!user) redirect("/login");

  const role = (await getUserRole()) ?? "CITIZEN";

  // Only OPERATOR and ADMIN have dashboard access.
  if (!["OPERATOR", "ADMIN"].includes(role)) {
    // Send each role to their own home instead of a generic error page.
    switch (role) {
      case "FIELD_TEAM":
        redirect("/team");
      case "SHELTER_MANAGER":
        redirect("/shelter-manage");
      case "CITIZEN":
      default:
        redirect("/citizen");
    }
  }

  const name =
    user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Operator";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userName={name} userRole={role} />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
