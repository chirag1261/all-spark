import AccessDenied from "@/components/AccessDenied";
import AdminHeader from "@/components/AdminHeader";
import AdminUsersPanel from "@/components/AdminUsersPanel";
import { requireAdminPage } from "@/lib/auth/admin";
import { toPublicUser } from "@/lib/auth/admin-users";
import { listAdminUsers } from "@/lib/db";

export async function AdminUsersScreen() {
  const currentUser = await requireAdminPage();

  return (
    <div className="min-h-screen text-zinc-100">
      <AdminHeader currentUser={currentUser} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        {currentUser.role !== "super_admin" ? (
          <AccessDenied what="manage admin users" />
        ) : (
          <AdminUsersPanel
            users={(await listAdminUsers()).map(toPublicUser)}
            currentUserId={currentUser.id}
          />
        )}
      </main>
    </div>
  );
}
