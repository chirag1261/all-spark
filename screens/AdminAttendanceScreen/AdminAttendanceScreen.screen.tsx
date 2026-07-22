import AdminShell from "@/components/AdminShell";
import AttendanceBoard from "@/components/AttendanceBoard";
import { requireAdminPage } from "@/lib/auth/admin";
import { listEvents } from "@/lib/db";

/** Live event-entry dashboard: sold vs. checked-in, per attendee. */
export async function AdminAttendanceScreen() {
  const currentUser = await requireAdminPage();
  const events = (await listEvents())
    .filter((e) => e.published)
    .map((e) => ({ id: e.id, title: e.title }));

  return (
    <AdminShell user={{ name: currentUser.name, role: currentUser.role }}>
      <h1 className="text-2xl font-bold mb-1">Attendance</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Live entry counts and per-attendee check-in status. Updates every few seconds.
      </p>
      <AttendanceBoard events={events} />
    </AdminShell>
  );
}
