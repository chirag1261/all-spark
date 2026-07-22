import AccessDenied from "@/components/AccessDenied";
import AdminEventCreate from "@/components/AdminEventCreate";
import AdminShell from "@/components/AdminShell";
import BackLink from "@/components/BackLink";
import { hasPermission, requireDashboardPage } from "@/lib/auth/admin";
import { cloudinaryConfigured } from "@/lib/integrations/cloudinary";

export async function AdminEventCreateScreen() {
  const currentUser = await requireDashboardPage();
  const shellUser = { name: currentUser.name, role: currentUser.role };

  if (!hasPermission(currentUser, "events")) {
    return (
      <AdminShell user={shellUser}>
        <AccessDenied what="create events" />
      </AdminShell>
    );
  }

  return (
    <AdminShell user={shellUser}>
      <BackLink href="/admin/events" className="mb-4">
        All events
      </BackLink>
      <h1 className="font-heading text-3xl font-semibold mb-6">Create event</h1>
      <AdminEventCreate cloudinaryEnabled={cloudinaryConfigured()} />
    </AdminShell>
  );
}
