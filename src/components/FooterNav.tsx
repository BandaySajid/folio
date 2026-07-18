import { EnvelopeSimple, GithubLogo, XLogo } from '@phosphor-icons/react';

export function FooterNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-8 pointer-events-none">
      <div className="pointer-events-auto flex gap-1 bg-zinc-950/80 backdrop-blur-md border border-zinc-800 p-1 rounded-xl shadow-[0_0_32px_rgba(0,0,0,0.8)]">
        <a 
          href="mailto:ibandaysajid@gmail.com" 
          aria-label="Email"
          className="flex items-center justify-center w-12 h-12 text-zinc-500 hover:text-accent hover:bg-zinc-900 rounded-lg transition-colors"
        >
          <EnvelopeSimple size={24} weight="regular" />
        </a>
        <a 
          href="https://github.com/bandaysajid" 
          target="_blank" 
          rel="noopener noreferrer" 
          aria-label="GitHub"
          className="flex items-center justify-center w-12 h-12 text-zinc-500 hover:text-accent hover:bg-zinc-900 rounded-lg transition-colors"
        >
          <GithubLogo size={24} weight="regular" />
        </a>
        <a 
          href="https://x.com/sajidbandayy" 
          target="_blank" 
          rel="noopener noreferrer" 
          aria-label="X (Twitter)"
          className="flex items-center justify-center w-12 h-12 text-zinc-500 hover:text-accent hover:bg-zinc-900 rounded-lg transition-colors"
        >
          <XLogo size={24} weight="regular" />
        </a>
      </div>
    </nav>
  );
}
