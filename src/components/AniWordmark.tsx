/**
 * The hero lettering is drawn, not a font screenshot: each letter is a latex
 * balloon with a warm extrusion, a soft floor shadow, clipped highlights and a
 * slight independent sway. Everything is inline SVG so it stays crisp and can
 * be animated without a raster asset.
 */
export function AniWordmark({ className = '' }: { className?: string }) {
  return (
    <div className={`hero-wordmark ${className}`} aria-hidden>
      <svg viewBox="0 0 760 420" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="aniLatex" cx="0.37" cy="0.14" r="1.06">
            <stop offset="0" stopColor="#fffdf8" />
            <stop offset="0.34" stopColor="#f7f2e8" />
            <stop offset="0.66" stopColor="#e7ddcb" />
            <stop offset="0.86" stopColor="#d7cbb7" />
            <stop offset="1" stopColor="#c6baa5" />
          </radialGradient>
          <radialGradient id="aniRim" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.78" stopColor="#fffdf8" stopOpacity="0" />
            <stop offset="1" stopColor="#fffdf8" stopOpacity="0.55" />
          </radialGradient>
          <filter id="aniShadow" x="-35%" y="-35%" width="170%" height="180%" colorInterpolationFilters="sRGB">
            <feDropShadow dx="3" dy="12" stdDeviation="8" floodColor="#2d2820" floodOpacity="0.18" />
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#2d2820" floodOpacity="0.1" />
          </filter>
          <filter id="aniBlur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <filter id="aniBlurTight" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
          <clipPath id="aniClipA">
            <text x="80" y="370" className="wordmark-text" fill="#fff" stroke="#fff" strokeWidth="15" strokeLinejoin="round">A</text>
          </clipPath>
          <clipPath id="aniClipN">
            <text x="325" y="370" className="wordmark-text" fill="#fff" stroke="#fff" strokeWidth="15" strokeLinejoin="round">N</text>
          </clipPath>
          <clipPath id="aniClipI">
            <text x="585" y="370" className="wordmark-text" fill="#fff" stroke="#fff" strokeWidth="15" strokeLinejoin="round">I</text>
          </clipPath>
        </defs>

        {/* warm extrusion */}
        <g opacity="0.9">
          <text x="80" y="382" className="wordmark-text" fill="#d9cfbd" stroke="#d9cfbd" strokeWidth="15" strokeLinejoin="round">A</text>
          <text x="325" y="382" className="wordmark-text" fill="#d9cfbd" stroke="#d9cfbd" strokeWidth="15" strokeLinejoin="round">N</text>
          <text x="585" y="382" className="wordmark-text" fill="#d9cfbd" stroke="#d9cfbd" strokeWidth="15" strokeLinejoin="round">I</text>
        </g>

        {/* the letters */}
        <g filter="url(#aniShadow)">
          <g transform="rotate(-2.4 190 340)">
            <g className="wordmark-letter" style={{ animationDelay: '0ms' }}>
              <text x="80" y="370" className="wordmark-text" fill="url(#aniLatex)" stroke="url(#aniLatex)" strokeWidth="15" strokeLinejoin="round" paintOrder="stroke">A</text>
              <g clipPath="url(#aniClipA)">
                <ellipse cx="162" cy="104" rx="66" ry="24" fill="#fff" opacity="0.72" filter="url(#aniBlur)" transform="rotate(-12 162 104)" />
                <ellipse cx="126" cy="225" rx="19" ry="74" fill="#fff" opacity="0.5" filter="url(#aniBlur)" transform="rotate(7 126 225)" />
                <ellipse cx="234" cy="330" rx="45" ry="28" fill="#9b9180" opacity="0.2" filter="url(#aniBlur)" transform="rotate(-14 234 330)" />
                <ellipse cx="166" cy="94" rx="40" ry="12" fill="#fff" opacity="0.9" filter="url(#aniBlurTight)" transform="rotate(-12 166 94)" />
              </g>
            </g>
          </g>

          <g transform="rotate(0.8 430 340)">
            <g className="wordmark-letter" style={{ animationDelay: '220ms' }}>
              <text x="325" y="370" className="wordmark-text" fill="url(#aniLatex)" stroke="url(#aniLatex)" strokeWidth="15" strokeLinejoin="round" paintOrder="stroke">N</text>
              <g clipPath="url(#aniClipN)">
                <ellipse cx="433" cy="98" rx="72" ry="25" fill="#fff" opacity="0.72" filter="url(#aniBlur)" transform="rotate(5 433 98)" />
                <ellipse cx="365" cy="228" rx="20" ry="80" fill="#fff" opacity="0.5" filter="url(#aniBlur)" transform="rotate(2 365 228)" />
                <ellipse cx="500" cy="330" rx="45" ry="28" fill="#9b9180" opacity="0.2" filter="url(#aniBlur)" transform="rotate(12 500 330)" />
                <ellipse cx="438" cy="90" rx="44" ry="12" fill="#fff" opacity="0.9" filter="url(#aniBlurTight)" transform="rotate(5 438 90)" />
              </g>
            </g>
          </g>

          <g transform="rotate(2.2 625 340)">
            <g className="wordmark-letter" style={{ animationDelay: '430ms' }}>
              <text x="585" y="370" className="wordmark-text" fill="url(#aniLatex)" stroke="url(#aniLatex)" strokeWidth="15" strokeLinejoin="round" paintOrder="stroke">I</text>
              <g clipPath="url(#aniClipI)">
                <ellipse cx="642" cy="104" rx="26" ry="18" fill="#fff" opacity="0.7" filter="url(#aniBlur)" />
                <ellipse cx="625" cy="235" rx="11" ry="58" fill="#fff" opacity="0.48" filter="url(#aniBlur)" />
                <ellipse cx="680" cy="330" rx="18" ry="24" fill="#9b9180" opacity="0.2" filter="url(#aniBlur)" />
                <ellipse cx="644" cy="98" rx="18" ry="8" fill="#fff" opacity="0.9" filter="url(#aniBlurTight)" />
              </g>
            </g>
          </g>
        </g>

        {/* top squiggles */}
        <g stroke="#111111" strokeWidth="2.7" strokeLinecap="round" fill="none">
          <path d="M119 54 Q150 31 181 48" />
          <path d="M134 70 Q158 53 183 65" opacity="0.85" />
          <path d="M655 62 Q626 38 596 54" />
          <path d="M646 78 Q622 60 598 72" opacity="0.85" />
        </g>

        {/* crown on the N */}
        <g className="wordmark-crown">
          <path
            d="M369 74 L381 40 L399 58 L413 32 L427 58 L445 40 L457 74 Q413 60 369 74"
            stroke="#4b63ff"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="381" cy="40" r="3.7" fill="#4b63ff" />
          <circle cx="413" cy="32" r="3.9" fill="#4b63ff" />
          <circle cx="445" cy="40" r="3.7" fill="#4b63ff" />
        </g>

        {/* sparkle */}
        <g className="wordmark-spark" style={{ animationDelay: '900ms' }}>
          <path
            d="M700 60 C702 82 708 88 730 92 C708 96 702 102 700 124 C698 102 692 96 670 92 C692 88 698 82 700 60 Z"
            stroke="#4b63ff"
            strokeWidth="3"
            strokeLinejoin="round"
            fill="none"
          />
        </g>

        {/* little seed / bomb on the left */}
        <g transform="translate(14 300)">
          <circle cx="30" cy="58" r="21" fill="#111111" />
          <circle cx="23" cy="51" r="4.2" fill="#f6f4ee" opacity="0.9" />
          <path d="M44 39 L53 29 L60 36 L51 46 Z" fill="#111111" />
          <path d="M59 29 C66 18 76 21 81 8" stroke="#111111" strokeWidth="4" strokeLinecap="round" />
          <g stroke="#4b63ff" strokeWidth="2.5" strokeLinecap="round">
            <path d="M81 8 l7 -8 M85 12 l10 -3 M78 1 l0 -9" />
          </g>
          <circle cx="94" cy="-5" r="1.8" fill="#111111" />
        </g>

        {/* blue underline ticks */}
        <g stroke="#4b63ff" strokeWidth="3.4" strokeLinecap="round" fill="none">
          <path d="M118 398 Q160 410 202 400" />
          <path d="M548 400 Q590 411 633 398" />
        </g>
        <circle cx="218" cy="402" r="2.7" fill="#4b63ff" />
        <circle cx="537" cy="402" r="2.7" fill="#4b63ff" />
      </svg>
    </div>
  );
}
