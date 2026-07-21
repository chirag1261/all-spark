import LoginWizard from "@/components/LoginWizard";
import SiteHeader from "@/components/SiteHeader";

/** Sign-in / sign-up presentation. The auth-redirect guard lives in the route. */
export function LoginScreen({ next }: { next: string }) {
  return (
    <div className="min-h-screen text-zinc-100">
      <SiteHeader />
      <main className="max-w-sm mx-auto px-4 py-12">
        <LoginWizard next={next} />
      </main>
    </div>
  );
}
