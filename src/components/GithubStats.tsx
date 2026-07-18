import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const GITHUB_USER = 'bandaysajid';
const API_BASE = 'https://github-contributions-api.jogruber.de/v4';

type HeatmapDay = { date: string; count: number; level: number };

export function GithubStats() {
  const [stats, setStats] = useState({ repos: 0, stars: 0, contributions: 0 });
  const [years, setYears] = useState<string[]>([]);
  const [currentYear, setCurrentYear] = useState<string>(String(new Date().getFullYear()));
  const [heatmap, setHeatmap] = useState<(HeatmapDay | null)[][]>([]);
  const [loading, setLoading] = useState(true);
  const [totalYearContribs, setTotalYearContribs] = useState(0);

  useEffect(() => {
    async function fetchInitial() {
      try {
        const [allRes, reposRes] = await Promise.all([
          fetch(`${API_BASE}/${GITHUB_USER}`),
          fetch(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100`)
        ]);

        if (reposRes.ok) {
          const repos = await reposRes.json();
          const totalStars = repos.reduce((sum: number, r: any) => sum + (r.stargazers_count || 0), 0);
          setStats(s => ({ ...s, repos: repos.length, stars: totalStars }));
        }

        if (allRes.ok) {
          const allData = await allRes.json();
          const totalData = allData.total || {};
          const availableYears = Object.keys(totalData).sort();
          if (!availableYears.includes(currentYear)) {
            availableYears.push(currentYear);
            availableYears.sort();
          }
          setYears(availableYears);
          
          const totalLifetime = Object.values(totalData).reduce((sum: any, v: any) => sum + (v || 0), 0) as number;
          setStats(s => ({ ...s, contributions: totalLifetime }));
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchInitial();
  }, []);

  useEffect(() => {
    async function loadYear() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/${GITHUB_USER}?y=${currentYear}`);
        if (!res.ok) return;
        const data = await res.json();
        const contributions: HeatmapDay[] = data.contributions || [];
        
        const yearTotal = contributions.reduce((sum, d) => sum + (d.count || 0), 0);
        setTotalYearContribs(yearTotal);

        const weeks: (HeatmapDay | null)[][] = [];
        let currentWeek: (HeatmapDay | null)[] = [];

        contributions.forEach((day, i) => {
          const dow = new Date(day.date).getDay();
          currentWeek.push(day);
          if (dow === 6 || i === contributions.length - 1) {
            weeks.push(currentWeek);
            currentWeek = [];
          }
        });

        if (weeks.length > 0) {
          const firstWeek = weeks[0];
          if (firstWeek[0]) {
            const firstDow = new Date(firstWeek[0].date).getDay();
            for (let i = 0; i < firstDow; i++) firstWeek.unshift(null);
          }
          weeks.forEach(week => {
            while (week.length < 7) week.push(null);
          });
        }
        setHeatmap(weeks);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadYear();
  }, [currentYear]);

  const levelColors = ['bg-zinc-900', 'bg-emerald-950', 'bg-emerald-800', 'bg-emerald-600', 'bg-accent'];

  return (
    <motion.section 
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
      className="flex flex-col gap-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-zinc-800 border border-zinc-800 overflow-hidden">
        {[
          { label: 'Repos', value: stats.repos },
          { label: 'Contributions', value: stats.contributions },
          { label: 'Stars', value: stats.stars }
        ].map(stat => (
          <div key={stat.label} className="bg-zinc-950 p-4 md:p-6 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="text-2xl md:text-3xl font-bold text-accent mb-1 relative z-10 font-mono">
              {stat.value || <span className="text-zinc-700 animate-pulse">--</span>}
            </div>
            <div className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-zinc-500 relative z-10">{stat.label}</div>
            <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </div>
        ))}
      </div>

      <div className="border border-zinc-800 bg-zinc-950/50 p-4 md:p-6 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden w-fit">
            {years.map(y => (
              <button 
                key={y}
                onClick={() => setCurrentYear(y)}
                className={`px-3 py-1 text-[11px] font-mono tracking-wider transition-colors ${
                  y === currentYear ? 'bg-zinc-800 text-accent' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
          <div className="text-[11px] font-mono text-zinc-500 tracking-wider">
            {totalYearContribs.toLocaleString()} contributions
          </div>
        </div>

        <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {loading ? (
            <div className="flex gap-1 animate-pulse">
              {Array.from({length: 52}).map((_, i) => (
                <div key={i} className="flex flex-col gap-1">
                  {Array.from({length: 7}).map((_, j) => (
                    <div key={j} className="w-3 h-3 bg-zinc-900 rounded-sm opacity-50"></div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-1 min-w-max">
              {heatmap.map((week, i) => (
                <div key={i} className="flex flex-col gap-1">
                  {week.map((day, j) => (
                    <div 
                      key={j} 
                      title={day ? `${day.date}: ${day.count} contributions` : undefined}
                      className={`w-3 h-3 rounded-[2px] transition-all hover:scale-125 hover:z-10 relative cursor-crosshair ${
                        day ? levelColors[day.level || 0] : 'bg-transparent'
                      }`}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
