import AccountShell from "@/components/AccountShell";
import ProfileForm from "@/components/ProfileForm";
import { requireCustomerPage } from "@/lib/auth/customer";

export async function AccountScreen() {
  const customer = await requireCustomerPage("/account");

  return (
    <AccountShell active="/account">
      <h1 className="text-2xl font-bold mb-6">My Account</h1>
      <ProfileForm
        profile={{
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          emailVerified: customer.emailVerified,
          phoneVerified: customer.phoneVerified,
          hasPassword: Boolean(customer.passwordHash),
        }}
      />
    </AccountShell>
  );
}
