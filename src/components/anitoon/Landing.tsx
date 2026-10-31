import { SiteNav } from './SiteNav';
import { Hero } from './Hero';
import { Statement } from './Statement';
import { Bento } from './Bento';
import { BriefLibrary } from './BriefLibrary';
import { HowItWorks } from './HowItWorks';
import { VoiceSection } from './VoiceSection';
import { HonestBand } from './HonestBand';
import { FinalCta } from './FinalCta';
import { SiteFooter } from './SiteFooter';
import { PageMotion } from './PageMotion';

export function AnitoonLanding() {
  return (
    <>
      <SiteNav />
      <main id="top">
        <Hero />
        <Statement />
        <Bento />
        <BriefLibrary />
        <HowItWorks />
        <VoiceSection />
        <HonestBand />
        <FinalCta />
      </main>
      <SiteFooter />
      <PageMotion />
    </>
  );
}
