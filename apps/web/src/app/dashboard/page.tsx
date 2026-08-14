import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Dashboard } from "@/components/Dashboard";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <Dashboard />;
}
