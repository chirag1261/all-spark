import AccessDenied from "@/components/AccessDenied";
import AdminShell from "@/components/AdminShell";
import PromoCodeCreate from "@/components/PromoCodeCreate";
import { hasPermission, requireDashboardPage } from "@/lib/auth/admin";
import { listEvents } from "@/lib/db";

export async function AdminPromoCodeCreateScreen() {
  const currentUser = await requireDashboardPage();

  if (!hasPermission(currentUser, "promocodes")) {
    return (
      <AdminShell user={{ name: currentUser.name, role: currentUser.role }}>
        <AccessDenied what="manage promo codes" />
      </AdminShell>
    );
  }

  const events = (await listEvents()).map((e) => ({ id: e.id, title: e.title }));

  return (
    <AdminShell user={{ name: currentUser.name, role: currentUser.role }}>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Create promo code</h1>
        <PromoCodeCreate events={events} />
      </div>
    </AdminShell>
  );
}
