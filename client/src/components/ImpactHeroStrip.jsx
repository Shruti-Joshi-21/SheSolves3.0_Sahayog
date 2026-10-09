import { Recycle, Clock, MapPin, CheckSquare } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ImpactHeroStrip({ impactMetrics, loading }) {
  const stats = [
    {
      key: 'waste',
      icon: Recycle,
      value: impactMetrics ? `${impactMetrics.wasteCollectedKg?.toLocaleString() ?? 0} kg` : '—',
      label: 'Waste Collected',
    },
    {
      key: 'hours',
      icon: Clock,
      value: impactMetrics ? `${impactMetrics.volunteerHours?.toLocaleString() ?? 0}` : '—',
      label: 'Volunteer Hours',
    },
    {
      key: 'locations',
      icon: MapPin,
      value: impactMetrics ? `${impactMetrics.locationsCovered ?? 0}` : '—',
      label: 'Locations Reached',
    },
    {
      key: 'tasks',
      icon: CheckSquare,
      value: impactMetrics ? `${impactMetrics.tasksCompleted ?? 0}` : '—',
      label: 'Activities Completed',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-[20px] px-[28px] py-[24px] mb-[16px] text-white relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #246427 0%, #2F7A33 100%)',
      }}
    >
      <div className="relative z-10">
        <p className="text-[0.9375rem] sm:text-[1rem] font-bold uppercase tracking-wider text-white mb-1">
          This Month&apos;s Impact
        </p>
        <p className="text-[0.75rem] sm:text-[0.8125rem] text-white/70 mb-4 whitespace-nowrap">
          Real outcomes created by your field teams this month
        </p>

        <div className="flex flex-wrap gap-x-10 gap-y-4">
          {stats.map((s) => (
            <div key={s.key} className="flex items-center gap-3 min-w-[140px]">
              <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                <s.icon className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <div>
                {loading ? (
                  <div className="h-6 w-16 bg-white/20 rounded animate-pulse" />
                ) : (
                  <p className="text-[1.5rem] font-bold leading-tight">{s.value}</p>
                )}
                <p className="text-[0.6875rem] text-white/70 uppercase tracking-wide mt-0.5">
                  {s.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute -right-4 -bottom-16 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
    </motion.div>
  );
}