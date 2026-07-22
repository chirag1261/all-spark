import AccessDenied from "@/components/AccessDenied";
import AdminShell from "@/components/AdminShell";
import AdminUsersPanel from "@/components/AdminUsersPanel";
import { requireDashboardPage } from "@/lib/auth/admin";
import { toPublicUser } from "@/lib/auth/admin-users";
import { listAdminUsers } from "@/lib/db";

export async function AdminUsersScreen() {
  const currentUser = await requireDashboardPage();

  return (
    <AdminShell user={{ name: currentUser.name, role: currentUser.role }}>
      {currentUser.role !== "super_admin" ? (
        <AccessDenied what="manage admin users" />
      ) : (
        <AdminUsersPanel
          users={(await listAdminUsers()).map(toPublicUser)}
          currentUserId={currentUser.id}
        />
      )}
    </AdminShell>
  );
}
