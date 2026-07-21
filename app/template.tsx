/**
 * Root template — unlike layout.tsx, a template re-mounts on EVERY route
 * navigation, which replays the `page-in` entrance animation (fade + rise +
 * de-blur). This is what gives every screen its professional transition
 * without any per-page code or logic changes. Motion is disabled for
 * prefers-reduced-motion users in globals.css.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-transition flex-1 flex flex-col">{children}</div>;
}
