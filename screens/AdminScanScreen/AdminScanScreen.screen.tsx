import AdminShell from "@/components/AdminShell";
import ScanConsole from "@/components/ScanConsole";
import { requireAdminPage } from "@/lib/auth/admin";
import { listEvents } from "@/lib/db";

/** Venue entry scanner. Reachable by every admin role, incl. gate staff. */
export async function AdminScanScreen() {
  const currentUser = await requireAdminPage();
  const events = (await listEvents())
    .filter((e) => e.published)
    .map((e) => ({ id: e.id, title: e.title }));

  return (
    <AdminShell user={{ name: currentUser.name, role: currentUser.role }}>
      <h1 className="text-2xl font-bold mb-1">Entry scanner</h1>
      <p className="text-sm text-slate-800 mb-6">
        Point the camera at a ticket QR to check attendees in at the gate.
      </p>
      <ScanConsole events={events} />
    </AdminShell>
  );
}
