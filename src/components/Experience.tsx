import { motion } from 'framer-motion';

const experiences = [
  {
    title: "Software Engineer",
    company: "Handicraft Youth Foundation",
    location: "Srinagar",
    year: "2025-2026",
    desc: [
      "Designed and deployed large-scale document processing system handling 17M+ PDF pages",
      "Built production backend services for OCR pipelines and structured data extraction",
      "Implemented queue-based orchestration, retry logic, and monitoring for reliable execution",
      "Collaborated with operations teams to convert business workflows into automated systems",
      "Optimized compute utilization across multi-GPU infrastructure for parallel inference workloads"
    ]
  },
  {
    title: "Backend Developer",
    company: "FastBeetle",
    location: "Srinagar",
    year: "2023",
    desc: [
      "API integration, code migration, database query optimization, and frontend development for a major logistics platform."
    ]
  }
];

export function Experience() {
  return (
    <section className="flex flex-col gap-6">
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">
        Experience
      </div>
      
      <div className="flex flex-col gap-4">
        {experiences.map((exp, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            className="group relative flex flex-col p-6 md:p-8 bg-zinc-950/80 border border-zinc-800 overflow-hidden"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-accent to-accent/20 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 bg-white/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 md:mb-6">
              <h3 className="text-lg md:text-xl font-bold text-zinc-100">{exp.title} <span className="text-zinc-600 font-normal">&mdash; {exp.company}</span></h3>
              <div className="flex gap-4 font-mono text-[11px] text-zinc-500 uppercase tracking-widest shrink-0">
                <span>{exp.location}</span>
                <span>{exp.year}</span>
              </div>
            </div>
            
            <div className="relative z-10 flex flex-col gap-3">
              {exp.desc.map((bullet, j) => (
                <p key={j} className="text-zinc-400 text-sm leading-relaxed max-w-3xl flex items-start gap-3">
                  <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-accent/40"></span>
                  <span>{bullet}</span>
                </p>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
