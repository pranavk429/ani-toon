import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer-top">
          <div className="footer-blurb">
            <strong>Anitoon</strong>
            A motion compiler for brand characters. One sentence becomes a scene spec, and a
            deterministic engine performs every frame. Built for the Wispr No Hands Challenge, October
            2026.
          </div>

          <div className="footer-col">
            <h4>Product</h4>
            <ul>
              <li>
                <Link href="/creature">Human studio</Link>
              </li>
              <li>
                <Link href="/#briefs">Starter briefs</Link>
              </li>
              <li>
                <Link href="/#how">How it works</Link>
              </li>
              <li>
                <Link href="/#honest">Under the hood</Link>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Build</h4>
            <ul>
              <li>
                <a href="https://github.com/pranavk429/ani-toon" target="_blank" rel="noreferrer">
                  Source on GitHub
                </a>
              </li>
              <li>
                <Link href="/#honest">Scene spec format</Link>
              </li>
              <li>
                <Link href="/#voice">Wispr Flow</Link>
              </li>
              <li>
                <Link href="/creature">Live SVG stage</Link>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Challenge</h4>
            <ul>
              <li>
                <a href="https://wisprflow.ai/" target="_blank" rel="noreferrer">
                  Wispr Flow
                </a>
              </li>
              <li>
                <a href="https://www.wemakedevs.org/wispr" target="_blank" rel="noreferrer">
                  No Hands Challenge
                </a>
              </li>
              <li>
                <a href="https://www.wemakedevs.org/" target="_blank" rel="noreferrer">
                  WeMakeDevs
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-copy">© Anitoon 2026.</div>

          <div className="footer-meta-links">
            <a href="https://github.com/pranavk429/ani-toon" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <Link href="/#honest">Specs</Link>
            <a href="https://wisprflow.ai/" target="_blank" rel="noreferrer">
              Wispr Flow
            </a>
            <span className="footer-divider" aria-hidden="true" />
            <a href="#top" className="footer-back-top">
              Back to top ↑
            </a>
          </div>
        </div>
      </div>

      <div className="footer-wordmark-bottom" aria-hidden="true">
        <span className="footer-watermark-text">Anitoon</span>
      </div>
    </footer>
  );
}
