import AccessDenied from "@/components/AccessDenied";
import AdminShell from "@/components/AdminShell";
import PromoCodeCreate from "@/components/PromoCodeCreate";
import { hasPermission, requireDashboardPage } from "@/lib/auth/admin";
import { getPromoCodeById, listEvents } from "@/lib/db";

export async function AdminPromoCodeCreateScreen({ cloneFrom }: { cloneFrom?: string }) {
  const currentUser = await requireDashboardPage();

  if (!hasPermission(currentUser, "promocodes")) {
    return (
      <AdminShell user={{ name: currentUser.name, role: currentUser.role }}>
        <AccessDenied what="manage promo codes" />
      </AdminShell>
    );
  }

  const [events, source] = await Promise.all([
    listEvents().then((all) => all.map((e) => ({ id: e.id, title: e.title }))),
    cloneFrom ? getPromoCodeById(cloneFrom) : undefined,
  ]);

  return (
    <AdminShell user={{ name: currentUser.name, role: currentUser.role }}>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">
          {source ? `Clone "${source.code}"` : "Create promo code"}
        </h1>
        <PromoCodeCreate events={events} cloneFrom={source} />
      </div>
    </AdminShell>
  );
}
