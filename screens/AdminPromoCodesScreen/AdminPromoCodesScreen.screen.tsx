import AccessDenied from "@/components/AccessDenied";
import AdminPromoCodesPanel from "@/components/AdminPromoCodesPanel";
import AdminShell from "@/components/AdminShell";
import { hasPermission, requireDashboardPage } from "@/lib/auth/admin";
import { listEvents, listPromoCodes } from "@/lib/db";

export async function AdminPromoCodesScreen() {
  const currentUser = await requireDashboardPage();

  if (!hasPermission(currentUser, "promocodes")) {
    return (
      <AdminShell user={{ name: currentUser.name, role: currentUser.role }}>
        <AccessDenied what="manage promo codes" />
      </AdminShell>
    );
  }

  const [codes, events] = await Promise.all([listPromoCodes(), listEvents()]);

  return (
    <AdminShell user={{ name: currentUser.name, role: currentUser.role }}>
      <AdminPromoCodesPanel
        codes={codes}
        events={events.map((e) => ({ id: e.id, title: e.title }))}
      />
    </AdminShell>
  );
}
