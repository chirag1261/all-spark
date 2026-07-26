import PolicyPage, { type PolicySection } from "@/components/PolicyPage";

const SECTIONS: PolicySection[] = [
  {
    heading: "General",
    paragraphs: [
      "Tickets are generally non-refundable and non-transferable once a booking is confirmed, except in the situations set out below. Please double-check the event, date and seats before completing payment.",
    ],
  },
  {
    heading: "Eligibility",
    paragraphs: [
      "There is no minimum age requirement to book or attend events on Utsav Events, and none is applied when considering a refund request.",
    ],
  },
  {
    heading: "Cancellation window and refund amount",
    paragraphs: [
      "If you cancel your own booking, the refund amount depends on how far in advance of the event you request it:",
    ],
    bullets: [
      "More than 7 days before the event starts — full refund of the ticket amount.",
      "Less than 7 days (but 24 hours or more) before the event starts — 50% refund of the ticket amount.",
      "Less than 24 hours before the event starts — refunds can no longer be requested; the booking is final and non-refundable at that point.",
    ],
  },
  {
    heading: "If the organiser cancels the event",
    paragraphs: [
      "If an event is cancelled by the organiser, you are entitled to a full refund of the ticket amount to your original payment method regardless of timing. No action is usually needed — we process eligible refunds automatically and notify you by email.",
    ],
  },
  {
    heading: "If the event is rescheduled",
    paragraphs: [
      "If an event is moved to a new date, your existing ticket remains valid for the new date. If you are unable to attend the rescheduled date, you may request a refund, subject to the cancellation window above measured against the new date.",
    ],
  },
  {
    heading: "How refunds are processed",
    paragraphs: [
      "Approved refunds are issued through Razorpay to the original payment method used at booking. Refunds typically reach your account within 5–7 working days, depending on your bank or card issuer.",
    ],
  },
  {
    heading: "Failed or duplicate payments",
    paragraphs: [
      "If money was deducted but your booking did not confirm (for example a network drop during payment), the amount is automatically reversed by your bank or Razorpay. You can check the status any time under “Find my booking”.",
    ],
  },
  {
    heading: "No-shows and late arrival",
    paragraphs: [
      "No refund is available for tickets that go unused, for no-shows, or where entry is denied due to late arrival or failure to meet the venue's entry conditions.",
    ],
  },
  {
    heading: "How to request a refund",
    paragraphs: [
      "Email us with your booking ID (it begins with “BKG…” and is in your confirmation email and under My Bookings) and the email address you booked with. We will confirm eligibility and process any refund due as described above. Requests made less than 24 hours before the event starts cannot be accepted or processed, even if sent in time — our system blocks refunds inside that window.",
    ],
  },
];

export function RefundPolicyScreen() {
  return (
    <PolicyPage
      title="Refund & Cancellation Policy"
      updated="Last updated: 26 July 2026"
      intro="This policy explains when and how refunds are available for events booked through Utsav Events. It forms part of our Terms & Conditions."
      sections={SECTIONS}
    />
  );
}
