// Brand mark for Next on Wembley. Inlined as JSX so strokes can inherit
// the parent's text color via `currentColor` — set the wrapper's
// `text-…` class and the logo follows the theme (light/dark) without
// needing a CSS filter swap.

type Props = {
  className?: string;
  // Accessible label override. When the logo is itself the link content,
  // give the WRAPPING <Link> the aria-label and pass title="" here so AT
  // doesn't double-announce.
  title?: string;
};

export function Logo({ className, title = "Next on Wembley" }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="180 115 440 290"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <path
          id="logo-leaf"
          d="M 0,0 C -6,-10 -12,-12 -12,-22 C -12,-32 -2,-35 0,-42 C 2,-35 12,-32 12,-22 C 12,-10 6,-10 0,0 Z"
        />
        <path
          id="logo-leaf-tilted"
          d="M 0,0 C 5,-8 12,-11 16,-20 C 20,-29 13,-34 14,-42 C 7,-38 0,-31 -4,-23 C -8,-15 -4,-7 0,0 Z"
        />
      </defs>
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Roof */}
        <path strokeWidth={5} d="M 220,230 L 400,120 L 580,230" />
        {/* Walls */}
        <path strokeWidth={5} d="M 255,222 L 255,340 L 545,340 L 545,222" />
        {/* Steps */}
        <line strokeWidth={4} x1="240" y1="340" x2="560" y2="340" />
        <line strokeWidth={4} x1="225" y1="350" x2="575" y2="350" />
        <line strokeWidth={4} x1="210" y1="360" x2="590" y2="360" />
        <line strokeWidth={4} x1="195" y1="370" x2="605" y2="370" />
        {/* Ground waves */}
        <path
          strokeWidth={5}
          d="M 160,410 C 260,370 380,385 540,380 C 580,378 610,383 640,392"
        />
        <path
          strokeWidth={5}
          d="M 375,382 C 430,372 510,370 640,402"
        />
        {/* Window frame */}
        <rect strokeWidth={4} x="285" y="226" width="230" height="74" />
        <line strokeWidth={4} x1="345" y1="226" x2="345" y2="300" />
        <line strokeWidth={4} x1="455" y1="226" x2="455" y2="300" />
      </g>
      {/* Pendant lamps */}
      <g fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <line strokeWidth={3.5} x1="380" y1="226" x2="380" y2="246" fill="none" />
        <path d="M 368,253 A 12,12 0 0 1 392,253 Z" />
        <circle cx="380" cy="257" r="2" />
        <line strokeWidth={3.5} x1="420" y1="226" x2="420" y2="246" fill="none" />
        <path d="M 408,253 A 12,12 0 0 1 432,253 Z" />
        <circle cx="420" cy="257" r="2" />
      </g>
      {/* Plant clusters */}
      <g
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g transform="translate(305, 300)">
          <path d="M 0,0 Q 15,-40 25,-60" fill="none" />
          <use href="#logo-leaf" transform="translate(25,-60) scale(0.45) rotate(25)" />
          <use href="#logo-leaf-tilted" transform="translate(14,-32) scale(0.4) rotate(-60)" />
          <use href="#logo-leaf-tilted" transform="translate(7,-15) scale(0.45) rotate(-10)" />
          <path d="M 28,-10 Q 15,-25 3,-42" fill="none" />
          <use href="#logo-leaf" transform="translate(3,-42) scale(0.4) rotate(-35)" />
          <use href="#logo-leaf-tilted" transform="translate(18,-20) scale(0.4) rotate(45)" />
        </g>
        <g transform="translate(355, 300)">
          <path d="M 0,0 Q 15,-15 25,-24" fill="none" />
          <use href="#logo-leaf" transform="translate(25,-24) scale(0.4) rotate(45)" />
          <use href="#logo-leaf" transform="translate(10,-9) scale(0.43) rotate(-35)" />
        </g>
        <g transform="translate(445, 300)">
          <path d="M 0,0 Q -15,-15 -25,-24" fill="none" />
          <use href="#logo-leaf" transform="translate(-25,-24) scale(0.4) rotate(-45)" />
          <use href="#logo-leaf" transform="translate(-10,-9) scale(0.43) rotate(35)" />
        </g>
        <g transform="translate(495, 300) scale(-1, 1)">
          <path d="M 0,0 Q 15,-40 25,-60" fill="none" />
          <use href="#logo-leaf" transform="translate(25,-60) scale(0.45) rotate(25)" />
          <use href="#logo-leaf-tilted" transform="translate(14,-32) scale(0.4) rotate(-60)" />
          <use href="#logo-leaf-tilted" transform="translate(7,-15) scale(0.45) rotate(-10)" />
          <path d="M 28,-10 Q 15,-25 3,-42" fill="none" />
          <use href="#logo-leaf" transform="translate(3,-42) scale(0.4) rotate(-35)" />
          <use href="#logo-leaf-tilted" transform="translate(18,-20) scale(0.4) rotate(45)" />
        </g>
      </g>
    </svg>
  );
}
