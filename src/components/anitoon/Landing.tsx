import { SiteNav } from './SiteNav';
import { Hero } from './Hero';
import { HeroShowcase } from './HeroShowcase';
import { Statement } from './Statement';
import { Bento } from './Bento';
import { ClipLibrary } from './ClipLibrary';
import { HowItWorks } from './HowItWorks';
import { VoiceSection } from './VoiceSection';
import { HonestBand } from './HonestBand';
import { FinalCta } from './FinalCta';
import { SiteFooter } from './SiteFooter';
import { ClipModal } from './ClipModal';
import { PageMotion } from './PageMotion';

export function AnitoonLanding() {
  return (
    <>
      <SiteNav />
      <main id="top">
        <Hero />
        <HeroShowcase />
        <Statement />
        <Bento />
        <ClipLibrary />
        <HowItWorks />
        <VoiceSection />
        <HonestBand />
        <FinalCta />
      </main>
      <SiteFooter />
      <ClipModal />
      <PageMotion />
    </>
  );
}
