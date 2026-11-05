/**
 * Soft light behind the interface, so the glass surfaces have something to refract.
 * Slow drift, very low contrast; static when reduced motion is requested.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="ambient-orb absolute -top-[18%] -left-[12%] h-[60vmax] w-[60vmax] rounded-full bg-[radial-gradient(closest-side,var(--orb-a),transparent)] [animation-duration:38s]" />
      <div className="ambient-orb absolute -right-[18%] top-[30%] h-[55vmax] w-[55vmax] rounded-full bg-[radial-gradient(closest-side,var(--orb-b),transparent)] [animation-delay:-12s] [animation-duration:46s]" />
      <div className="ambient-orb absolute -bottom-[25%] left-[20%] h-[50vmax] w-[50vmax] rounded-full bg-[radial-gradient(closest-side,var(--orb-c),transparent)] [animation-delay:-24s] [animation-duration:52s]" />
      {/* Fine grain keeps large gradients from banding. */}
      <div className="absolute inset-0 opacity-[0.035] mix-blend-overlay [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22><filter id=%22n%22><feTurbulence baseFrequency=%220.8%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/></svg>')]" />
    </div>
  )
}
