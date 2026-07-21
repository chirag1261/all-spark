import PolicyPage, { type PolicySection } from "@/components/PolicyPage";

const SECTIONS: PolicySection[] = [
  {
    heading: "Acceptance of terms",
    paragraphs: [
      "By accessing or using the Utsav Events website and booking any event through it, you agree to be bound by these Terms & Conditions. If you do not agree, please do not use the platform.",
    ],
  },
  {
    heading: "Eligibility and your account",
    paragraphs: [
      "You sign in with your email or phone number verified by a one-time code. You are responsible for keeping access to that contact secure and for the accuracy of the details you provide. You must be capable of entering into a binding contract to make a booking.",
    ],
  },
  {
    heading: "Bookings and tickets",
    bullets: [
      "Every attendee in a booking receives their own individual QR ticket. The ticket ID is the access credential — keep it private, as anyone holding it can view that ticket.",
      "Entry is subject to the venue's rules and to carrying a valid photo ID where required.",
      "The organiser may refuse entry for misconduct, invalid or duplicate tickets, or breach of venue policy, without a refund.",
      "Seats you select are held for a short window (about 8 minutes) during checkout; if payment is not completed in time they are released.",
    ],
  },
  {
    heading: "Pricing and payment",
    paragraphs: [
      "All prices are shown in Indian Rupees (₹) and include applicable charges displayed at checkout. Payments are processed securely by Razorpay; we do not store your card, UPI or net-banking details. The amount payable is always computed on our servers from the seats you select.",
    ],
  },
  {
    heading: "Cancellations and refunds",
    paragraphs: [
      "Cancellations and refunds are governed by our Refund & Cancellation Policy, which forms part of these Terms. Please read it before booking.",
    ],
  },
  {
    heading: "Acceptable use",
    bullets: [
      "Do not resell, transfer for profit, forge or tamper with tickets.",
      "Do not use bots or scripts to hoard seats or disrupt the platform.",
      "Do not attempt to gain unauthorised access to accounts, the admin area or our systems.",
    ],
  },
  {
    heading: "Intellectual property",
    paragraphs: [
      "The Utsav Events name, logo, content and design are owned by Utsav Events or its licensors and may not be used without permission.",
    ],
  },
  {
    heading: "Limitation of liability",
    paragraphs: [
      "The platform is provided on an “as is” and “as available” basis. To the extent permitted by law, Utsav Events is not liable for indirect or consequential losses. Where an event is changed or cancelled by the organiser, our liability is limited to the refund available under the Refund & Cancellation Policy.",
    ],
  },
  {
    heading: "Governing law and jurisdiction",
    paragraphs: [
      "These Terms are governed by the laws of India. The courts at Bangalore, Karnataka have exclusive jurisdiction over any dispute arising from them.",
    ],
  },
];

export function TermsScreen() {
  return (
    <PolicyPage
      title="Terms & Conditions"
      updated="Last updated: 21 July 2026"
      intro="These Terms & Conditions govern your use of the Utsav Events website and your bookings made through it. Please read them carefully."
      sections={SECTIONS}
    />
  );
}
