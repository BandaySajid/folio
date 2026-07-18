import { motion } from 'framer-motion';

export function Hero() {
  return (
    <section className="relative w-full">
      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col-reverse md:flex-row md:items-end justify-between gap-8 md:gap-12"
      >
        <div className="flex flex-col gap-5 md:gap-6 max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 border border-zinc-800 px-2 py-1 rounded-sm">
              whoami
            </div>
          </div>
          
          <h1 className="text-[13vw] md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.9] flex items-end flex-wrap mt-2 mb-4">
            {"sajid_banday".split('').map((char, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.8, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className="bg-clip-text text-transparent bg-gradient-to-b from-zinc-100 via-zinc-200 to-zinc-600 inline-block"
              >
                {char}
              </motion.span>
            ))}
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0, 0] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "linear", times: [0, 0.1, 0.5, 0.6, 1] }}
              className="text-accent font-light ml-1 md:ml-2 -translate-y-[10%]"
            >
              _
            </motion.span>
          </h1>
          
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-zinc-400 tracking-wide">BUILDER</span>
            <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(51,255,153,0.5)]"></div>
          </div>
          
          <p className="text-lg text-zinc-400 leading-relaxed max-w-[45ch]">
            <span className="text-zinc-300 font-medium">[Building systems]</span> backend infrastructure, edge services, and developer tools.
          </p>
        </div>

        {/* Profile Image with liquid glass border */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-24 h-24 md:w-32 md:h-32 shrink-0 group"
        >
          <div className="absolute inset-[-4px] border border-accent/30 rounded-full scale-100 group-hover:scale-110 transition-transform duration-700 ease-out" />
          <div className="absolute inset-0 rounded-full overflow-hidden border border-zinc-800 bg-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <img 
              src="/static/img/profile.jpg" 
              alt="Sajid Banday"
              className="w-full h-full object-cover filter grayscale contrast-125 group-hover:grayscale-0 transition-all duration-700"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'https://placehold.co/128x128/111111/e5e7eb?text=SB';
              }}
            />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
