import { Lock } from "lucide-react";

export default function AccessDenied({ what }: { what: string }) {
  return (
    <div className="max-w-md mx-auto text-center py-20">
      <div className="w-14 h-14 rounded-full bg-red-50 text-red-700 flex items-center justify-center mx-auto mb-5">
        <Lock className="w-6 h-6" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-bold mb-2">Access denied</h1>
      <p className="text-sm text-slate-500">
        Your admin account doesn&apos;t have permission to {what}. Ask a super admin to grant it.
      </p>
    </div>
  );
}
