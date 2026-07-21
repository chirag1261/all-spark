import AccountTabs from "../AccountTabs";
import SiteHeader from "../SiteHeader";

/** Shared frame for the signed-in customer's account pages. */
export default function AccountShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen text-zinc-100">
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <AccountTabs active={active} />
        {children}
      </main>
    </div>
  );
}
