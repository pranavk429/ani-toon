import Link from 'next/link';
import { asset } from '../../lib/asset';
import { AnitoonMark } from './Brand';

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer-top">
          <div className="footer-blurb">
            <strong>Anitoon</strong>
            A small library of 60fps, code-rendered motion clips. Built for the Wispr No Hands Challenge, October 2026.
          </div>

          <div className="footer-col">
            <h4>Product</h4>
            <ul>
              <li>
                <Link href="/#library">Library</Link>
              </li>
              <li>
                <Link href="/#how">How it works</Link>
              </li>
              <li>
                <Link href="/#honest">Under the hood</Link>
              </li>
              <li>
                <Link href="/#voice">Wispr</Link>
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
                <a href={asset('/specs/chef-demo.json')} target="_blank" rel="noreferrer">
                  Chef spec
                </a>
              </li>
              <li>
                <a href={asset('/specs/garden-demo.json')} target="_blank" rel="noreferrer">
                  Garden spec
                </a>
              </li>
              <li>
                <a href={asset('/specs/reveal-demo.json')} target="_blank" rel="noreferrer">
                  Reveal spec
                </a>
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

        <div className="footer-wordmark">
          <span className="footer-mark">
            anitoon<span className="dot" aria-hidden="true" />
          </span>
          <span className="footer-ball" aria-hidden="true">
            <AnitoonMark size={54} tone="paper" />
          </span>
        </div>

        <div className="footer-bottom">
          <span>© 2026 Anitoon · a hackathon project, not a SaaS product</span>
          <span>Built with voice, in public.</span>
          <a href="#top">Back to top ↑</a>
        </div>
      </div>
    </footer>
  );
}
