import PolicyPage, { type PolicySection } from "@/components/PolicyPage";

const SECTIONS: PolicySection[] = [
  {
    heading: "What are cookies",
    paragraphs: [
      "Cookies are small text files stored on your device when you visit a website. They let a site remember your session and preferences between requests.",
    ],
  },
  {
    heading: "How we use cookies",
    paragraphs: ["We keep our use of cookies to the minimum needed to run the site:"],
    bullets: [
      "Essential session and authentication cookies keep you signed in, secure the admin area and protect actions against cross-site request forgery.",
      "These cookies are strictly necessary — the booking and login flows will not work without them.",
      "We do not use advertising, analytics-profiling or cross-site tracking cookies, and we do not sell cookie data.",
    ],
  },
  {
    heading: "Third-party services",
    paragraphs: [
      "When you pay, the payment step is handled by Razorpay, which may set its own cookies under its policies to process the transaction securely. Please refer to Razorpay's cookie and privacy notices for details of their processing.",
    ],
  },
  {
    heading: "Managing cookies",
    paragraphs: [
      "You can control or delete cookies through your browser settings. Please note that blocking the essential cookies above will prevent you from signing in or completing a booking on this site.",
    ],
  },
  {
    heading: "Changes to this policy",
    paragraphs: [
      "We may update this Cookie Policy as the site evolves. The “last updated” date above reflects the latest revision.",
    ],
  },
];

export function CookiePolicyScreen() {
  return (
    <PolicyPage
      title="Cookie Policy"
      updated="Last updated: 21 July 2026"
      intro="This Cookie Policy explains how Utsav Events uses cookies and similar technologies on our website."
      sections={SECTIONS}
    />
  );
}
