import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowUpRight } from '@phosphor-icons/react';

const projects = [
  {
    title: 'amplizard/gateway',
    desc: 'Rate-limiting gateway on Cloudflare edge. Intercepts and caches rate-limited requests to reduce origin server load and infrastructure costs.',
    tech: ['TypeScript', 'Node.js', 'Redis', 'Cloudflare'],
    link: 'https://github.com/BandaySajid/gateway',
    size: 'lg'
  },
  {
    title: 'amplizard/interface',
    desc: 'Consumer backend and web dashboard for managing the Amplizard gateway. Built on Cloudflare Workers with D1 and KV storage.',
    tech: ['TypeScript', 'Workers', 'D1', 'KV'],
    link: 'https://github.com/BandaySajid/gateway-app',
    size: 'md'
  },
  {
    title: 'epick',
    desc: 'Full stack ride-hailing infrastructure for Kashmir. Real-time tracking, WhatsApp integration, driver tools.',
    tech: ['TypeScript', 'Workers/DO', 'Supabase', 'React Native'],
    link: 'https://vimeo.com/1101758107/',
    private: true,
    size: 'md'
  },
  {
    title: 'tweet-agent',
    desc: 'Node.js Twitter client interacting with the Twitter browser API for autonomous agents.',
    tech: ['TypeScript', 'Node.js'],
    link: 'https://github.com/BandaySajid/tweet-agent',
    size: 'sm'
  },
  {
    title: 'chatgpt-node',
    desc: 'Node.js library for ChatGPT API with Curl Impersonate.',
    link: 'https://github.com/BandaySajid/chatgpt-node',
    size: 'sm'
  }
];

function MagneticCard({ project, className }: { project: any, className: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 20 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["5deg", "-5deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-5deg", "5deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.a
      href={project.link}
      target="_blank"
      rel="noopener noreferrer"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className={`group relative flex flex-col justify-between p-6 md:p-8 bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 transition-colors overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative z-10" style={{ transform: "translateZ(30px)" }}>
        <div className="flex justify-between items-start mb-4 md:mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-lg md:text-xl font-bold text-zinc-100 tracking-tight">{project.title}</h3>
            {project.private && (
              <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 border border-zinc-800 text-zinc-500">Private</span>
            )}
          </div>
          <ArrowUpRight className="text-zinc-600 group-hover:text-accent group-hover:translate-x-1 group-hover:-translate-y-1 transition-all shrink-0" size={20} />
        </div>
        <p className="text-sm text-zinc-400 leading-relaxed md:max-w-[90%]">
          {project.desc}
        </p>
      </div>

      {project.tech && (
        <div className="relative z-10 flex flex-wrap gap-2 mt-6 md:mt-8" style={{ transform: "translateZ(20px)" }}>
          {project.tech.map((t: string) => (
            <span key={t} className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 border ${t === 'Cloudflare' || t === 'Workers' ? 'border-accent/40 text-accent' : 'border-zinc-800 text-zinc-500'}`}>
              {t}
            </span>
          ))}
        </div>
      )}
    </motion.a>
  );
}

export function Projects() {
  return (
    <section className="flex flex-col gap-6" style={{ perspective: "1000px" }}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:auto-rows-[minmax(280px,auto)]">
        <MagneticCard project={projects[0]} className="md:col-span-2 md:row-span-1 min-h-[240px]" />
        <MagneticCard project={projects[1]} className="md:col-span-1 md:row-span-1 min-h-[240px]" />
        <MagneticCard project={projects[2]} className="md:col-span-1 md:row-span-1 min-h-[240px]" />
        <MagneticCard project={projects[3]} className="md:col-span-1 md:row-span-1 min-h-[240px]" />
        <MagneticCard project={projects[4]} className="md:col-span-1 md:row-span-1 min-h-[240px]" />
      </div>
    </section>
  );
}
