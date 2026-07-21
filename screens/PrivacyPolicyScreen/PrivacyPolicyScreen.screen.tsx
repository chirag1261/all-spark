import PolicyPage, { type PolicySection } from "@/components/PolicyPage";

const SECTIONS: PolicySection[] = [
  {
    heading: "Information we collect",
    paragraphs: ["To let you book and attend events, we collect only what we need:"],
    bullets: [
      "Your name, and your email address and/or phone number (verified with a one-time code).",
      "The attendee name you enter for each seat, so we can issue an individual ticket per person.",
      "Booking and payment records — order ID, amount, status and ticket IDs. Card, UPI and net-banking details are handled entirely by our payment gateway (Razorpay) and are never seen or stored by us.",
      "Basic technical data — cookies, IP address and device/browser information — used to keep you signed in and to protect the platform.",
    ],
  },
  {
    heading: "How we use your information",
    bullets: [
      "Create your account, confirm bookings and issue QR tickets.",
      "Send one-time login codes, booking confirmations and essential event updates.",
      "Process payments and refunds through Razorpay.",
      "Detect and prevent fraud, seat-hoarding and abuse, and secure your account.",
      "Meet legal, tax and accounting obligations.",
    ],
  },
  {
    heading: "Sharing and disclosure",
    paragraphs: ["We do not sell your personal data. We share it only where necessary:"],
    bullets: [
      "With Razorpay to process payments and refunds.",
      "With email and SMS delivery providers to send your one-time codes and tickets.",
      "With the event organiser and venue for entry management on the event day.",
      "With authorities when required by law or to protect our rights and users.",
    ],
  },
  {
    heading: "Cookies",
    paragraphs: [
      "We use a small number of essential cookies to keep you signed in and to secure the site. We do not use advertising or cross-site tracking cookies. See our Cookie Policy for details.",
    ],
  },
  {
    heading: "Data retention",
    paragraphs: [
      "We keep booking and payment records for as long as needed to provide the service and to meet legal, tax and accounting requirements, after which they are deleted or anonymised.",
    ],
  },
  {
    heading: "Security",
    paragraphs: [
      "Data is transmitted over encrypted connections, credentials and one-time codes are stored only as salted hashes, and access is restricted. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.",
    ],
  },
  {
    heading: "Your rights",
    paragraphs: [
      "You can ask us to access, correct or delete your personal information, or withdraw consent, by emailing us. We will respond within a reasonable time and in line with applicable law.",
    ],
  },
  {
    heading: "Children",
    paragraphs: [
      "The platform is not directed at children under 16. We do not knowingly collect their data; if you believe a child has provided us information, contact us and we will remove it.",
    ],
  },
  {
    heading: "Changes to this policy",
    paragraphs: [
      "We may update this policy from time to time. Material changes will be reflected by the “last updated” date above, and continued use of the site means you accept the revised policy.",
    ],
  },
];

export function PrivacyPolicyScreen() {
  return (
    <PolicyPage
      title="Privacy Policy"
      updated="Last updated: 21 July 2026"
      intro="This Privacy Policy explains what information Utsav Events collects when you use our website to book events, how we use it, and the choices you have. By using the site you agree to the practices described here."
      sections={SECTIONS}
    />
  );
}
