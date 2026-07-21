import { EventLayout, LayoutRow, SeatSegment } from "@/types";

/**
 * Real-venue layouts modeled seat-for-seat. Kept as data so they can seed an
 * event or pre-fill the admin layout builder.
 */

const seg = (count: number, side?: "L" | "R", blocked?: boolean): SeatSegment => ({
  count,
  ...(side ? { side } : {}),
  ...(blocked ? { blocked: true } : {}),
});

const letter = (i: number) => String.fromCharCode(65 + i);

/**
 * Dr. Babu Jagajeevanram Bhavan Auditorium — 1796 physical seats.
 *
 * Lower floor (1298): rows A–Z. A/B are held back; C–I ₹2500, J–S ₹1500,
 * T–Z ₹1000. Balcony (498): rows A–J with a center block plus Left/Right side
 * wings; A–C ₹1500, D–H ₹1000; both side wings are blocked for now (but still
 * modeled). Seats on sale after blocking: 1608.
 *
 * Note: the source sheet lists Balcony row G as "50+11"; taken as Right 6 /
 * Left 5 so the balcony totals the stated 498.
 */
function lowerRows(): LayoutRow[] {
  const rows: LayoutRow[] = [];
  for (let i = 0; i < 26; i++) {
    const label = letter(i);
    if (i === 0) {
      rows.push({ label, tierId: "t2500", blocked: true, segments: [seg(15), seg(16), seg(15)] }); // A · 46
    } else if (i === 1) {
      rows.push({ label, tierId: "t2500", blocked: true, segments: [seg(16), seg(16), seg(16)] }); // B · 48
    } else if (i === 25) {
      rows.push({ label, tierId: "t1000", segments: [seg(54)] }); // Z · 54, single block
    } else {
      const tierId = i <= 8 ? "t2500" : i <= 18 ? "t1500" : "t1000"; // C–I / J–S / T–Y
      rows.push({ label, tierId, segments: [seg(17), seg(16), seg(17)] }); // 50
    }
  }
  return rows;
}

function balconyRows(): LayoutRow[] {
  // right wing, left wing, center size (0 = side-only row), price tier
  const spec = [
    { r: 3, l: 3, center: 50, tierId: "tb1500" }, // A
    { r: 3, l: 4, center: 50, tierId: "tb1500" }, // B
    { r: 4, l: 4, center: 50, tierId: "tb1500" }, // C
    { r: 4, l: 4, center: 50, tierId: "tb1000" }, // D
    { r: 5, l: 5, center: 50, tierId: "tb1000" }, // E
    { r: 5, l: 5, center: 50, tierId: "tb1000" }, // F
    { r: 6, l: 5, center: 50, tierId: "tb1000" }, // G
    { r: 6, l: 6, center: 54, tierId: "tb1000" }, // H
    { r: 6, l: 6, center: 0, tierId: "tb1000" }, // I (side-only)
    { r: 5, l: 5, center: 0, tierId: "tb1000" }, // J (side-only)
  ];
  return spec.map((s, i) => {
    const segments: SeatSegment[] = [seg(s.r, "R", true)]; // right wing — blocked
    if (s.center === 50) segments.push(seg(17), seg(16), seg(17));
    else if (s.center === 54) segments.push(seg(54));
    segments.push(seg(s.l, "L", true)); // left wing — blocked
    return { label: letter(i), tierId: s.tierId, segments };
  });
}

export const BABU_JAGAJEEVANRAM_LAYOUT: EventLayout = {
  sections: [
    {
      id: "LWR",
      name: "Lower Floor",
      tiers: [
        { id: "t2500", name: "Premium", price: 250000 },
        { id: "t1500", name: "Standard", price: 150000 },
        { id: "t1000", name: "Economy", price: 100000 },
      ],
      rows: lowerRows(),
    },
    {
      id: "BAL",
      name: "Balcony",
      tiers: [
        { id: "tb1500", name: "Standard", price: 150000 },
        { id: "tb1000", name: "Economy", price: 100000 },
      ],
      rows: balconyRows(),
    },
  ],
};
