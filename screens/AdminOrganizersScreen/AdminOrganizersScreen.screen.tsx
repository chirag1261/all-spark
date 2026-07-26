import AccessDenied from "@/components/AccessDenied";
import AdminOrganizersPanel from "@/components/AdminOrganizersPanel";
import AdminShell from "@/components/AdminShell";
import { hasPermission, requireDashboardPage } from "@/lib/auth/admin";
import { listOrganizers } from "@/lib/db";
import { cloudinaryConfigured } from "@/lib/integrations/cloudinary";

export async function AdminOrganizersScreen() {
  const currentUser = await requireDashboardPage();

  if (!hasPermission(currentUser, "organizers")) {
    return (
      <AdminShell user={{ name: currentUser.name, role: currentUser.role }}>
        <AccessDenied what="manage organizers" />
      </AdminShell>
    );
  }

  const organizers = await listOrganizers();

  return (
    <AdminShell user={{ name: currentUser.name, role: currentUser.role }}>
      <AdminOrganizersPanel organizers={organizers} cloudinaryEnabled={cloudinaryConfigured()} />
    </AdminShell>
  );
}
