import { Hero } from './components/Hero'
import { GithubStats } from './components/GithubStats'
import { Projects } from './components/Projects'
import { Experience } from './components/Experience'
import { FooterNav } from './components/FooterNav'
import { motion, useScroll, useTransform } from 'framer-motion'

function App() {
  const { scrollYProgress } = useScroll()
  const opacity = useTransform(scrollYProgress, [0, 0.05], [0.15, 0.02])

  return (
    <div className="relative min-h-screen selection:bg-accent/30 selection:text-accent overflow-x-hidden">
      {/* Background Grid */}
      <motion.div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{ 
          opacity,
          backgroundImage: `linear-gradient(var(--color-zinc-800) 1px, transparent 1px), linear-gradient(90deg, var(--color-zinc-800) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(circle at 50% 0%, black 40%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 0%, black 40%, transparent 80%)'
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 pb-24 md:pb-32 overflow-hidden md:overflow-visible">
        <div className="h-16 md:h-24"></div>
        <main className="flex flex-col gap-16 md:gap-24">
          <Hero />
          <GithubStats />
          <Projects />
          <Experience />
        </main>
      </div>

      <FooterNav />
    </div>
  )
}

export default App
