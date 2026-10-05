import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import {
  MapPin,
  Clock,
  Timer,
  Wrench,
  FileText,
  CheckCircle2,
  Calendar,
  History,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from 'lucide-react';
import api from '../../utils/api';

function parseHM(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [hs, ms] = timeStr.split(':');
  const h = parseInt(hs, 10) || 0;
  const m = parseInt(ms, 10) || 0;
  return h * 60 + m;
}

function formatHMFromMinutes(totalMins) {
  let t = ((totalMins % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function adjustTimeHM(timeStr, deltaMinutes) {
  if (!timeStr) return '—';
  return formatHMFromMinutes(parseHM(timeStr) + deltaMinutes);
}

function taskAttendanceState(todayAttendance, taskId) {
  if (!todayAttendance || !taskId) return 'NOT_CHECKED_IN';
  const tid = String(taskId);
  const attTask = todayAttendance.task?._id ?? todayAttendance.task;
  if (String(attTask) !== tid) return 'NOT_CHECKED_IN';
  if (todayAttendance.checkInTime && !todayAttendance.checkOutTime) return 'CHECKED_IN';
  if (todayAttendance.checkInTime && todayAttendance.checkOutTime) return 'COMPLETED';
  return 'NOT_CHECKED_IN';
}

function statusBadgeClass(status) {
  if (status === 'ACTIVE') return 'bg-[#E8F5E9] text-[#246427]';
  if (status === 'COMPLETED') return 'bg-[#F9FBF7] text-[#616161]';
  if (status === 'CANCELLED') return 'bg-[#FFEBEE] text-[#C62828]';
  return 'bg-[#F9FBF7] text-[#616161]';
}

const TAB_TODAY = 'TODAY';
const TAB_UPCOMING = 'UPCOMING';
const TAB_PAST = 'PAST';

export default function TasksPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(TAB_TODAY);
  const [expandedDesc, setExpandedDesc] = useState({});
  const tabInitRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksOutcome, attOutcome] = await Promise.allSettled([
        api.get('/worker/tasks/all'),
        api.get('/worker/attendance/today'),
      ]);
      if (tasksOutcome.status === 'fulfilled') {
        const tasksRes = tasksOutcome.value;
        const list = tasksRes.data?.data?.tasks ?? tasksRes.data?.data;
        const normalized = Array.isArray(list) ? list : [];
        setTasks(normalized);
      } else {
        const e = tasksOutcome.reason;
        toast.error(e.response?.data?.message || 'Failed to load tasks');
        setTasks([]);
      }
      if (attOutcome.status === 'fulfilled') {
        setTodayAttendance(attOutcome.value.data?.data ?? null);
      } else {
        setTodayAttendance(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const g = { TODAY: [], UPCOMING: [], PAST: [] };
    for (const t of tasks) {
      const c = t.category;
      if (g[c]) g[c].push(t);
    }
    return g;
  }, [tasks]);

  useEffect(() => {
    if (loading || tabInitRef.current) return;
    tabInitRef.current = true;
    if (grouped.TODAY.length > 0) setActiveTab(TAB_TODAY);
    else if (grouped.UPCOMING.length > 0) setActiveTab(TAB_UPCOMING);
    else setActiveTab(TAB_PAST);
  }, [loading, grouped.TODAY.length, grouped.UPCOMING.length]);

  const counts = useMemo(
    () => ({
      [TAB_TODAY]: grouped.TODAY.length,
      [TAB_UPCOMING]: grouped.UPCOMING.length,
      [TAB_PAST]: grouped.PAST.length,
    }),
    [grouped]
  );

  const visibleTasks = grouped[activeTab] || [];

  const toggleDesc = (id) => {
    setExpandedDesc((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const tabBtn = (key, label) => (
    <button
      type="button"
      onClick={() => setActiveTab(key)}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
        activeTab === key
          ? 'bg-[#246427] text-white shadow-md'
          : 'bg-[#FFFFFF] text-[#616161] border border-[#E0E7DC] hover:border-[#246427]/40'
      }`}
    >
      {label}
      <span
        className={`rounded-full px-2 py-0.5 text-xs ${
          activeTab === key ? 'bg-white/20 text-white' : 'bg-[#E8F5E9] text-[#246427]'
        }`}
      >
        {counts[key]}
      </span>
    </button>
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  };

  return (
    <motion.div
      className="space-y-8 bg-transparent -mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 pt-4 md:pt-8 pb-10 min-h-full rounded-b-[20px]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >



        <div className="flex flex-wrap gap-2">
          {tabBtn(TAB_TODAY, 'Today')}
          {tabBtn(TAB_UPCOMING, 'Upcoming')}
          {tabBtn(TAB_PAST, 'Past')}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-[20px] bg-[#FFFFFF] border border-[#E0E7DC] animate-pulse" />
            ))}
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-[20px] bg-[#FFFFFF] border border-[#E0E7DC] text-center px-6">
            {activeTab === TAB_TODAY && (
              <>
                <Calendar className="w-12 h-12 text-[#E0E7DC] mb-3" />
                <p className="text-[#616161] font-medium">No tasks assigned for today</p>
              </>
            )}
            {activeTab === TAB_UPCOMING && (
              <>
                <Clock className="w-12 h-12 text-[#E0E7DC] mb-3" />
                <p className="text-[#616161] font-medium">No upcoming tasks</p>
              </>
            )}
            {activeTab === TAB_PAST && (
              <>
                <History className="w-12 h-12 text-[#E0E7DC] mb-3" />
                <p className="text-[#616161] font-medium">No past tasks yet</p>
              </>
            )}
          </div>
        ) : (
          <motion.ul
            className="space-y-4"
            variants={containerVariants}
            initial="hidden"
            animate="show"
            key={activeTab}
          >
            <AnimatePresence mode="popLayout">
              {visibleTasks.map((task) => {
                const id = String(task._id);
                const attState = taskAttendanceState(todayAttendance, task._id);
                const inBuf = task.checkInBuffer ?? 15;
                const outBuf = task.checkOutBuffer ?? 15;
                const desc = task.description?.trim();
                const expanded = !!expandedDesc[id];
                const showActions =
                  (activeTab === TAB_TODAY || activeTab === TAB_UPCOMING) &&
                  task.status !== 'CANCELLED' &&
                  task.status !== 'COMPLETED';

                return (
                  <motion.li
                    key={id}
                    variants={cardVariants}
                    layout
                    className="rounded-[20px] bg-[#FFFFFF] border border-[#E0E7DC] shadow-[0_4px_12px_rgba(0,0,0,0.05)] p-6 relative"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-[1.125rem] font-bold text-[#212121]">{task.title}</h2>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-[10px] bg-[#E8F5E9] text-[#246427] whitespace-nowrap shrink-0">
                            {task.workType}
                          </span>
                        </div>
                        <p className="text-[0.8125rem] text-[#616161] font-semibold">
                          Assigned by {task.createdBy?.fullName || '—'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 px-3 py-1 rounded-[10px] text-xs font-semibold ${statusBadgeClass(
                          task.status
                        )}`}
                      >
                        {task.status}
                      </span>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 mb-4">
                      <div className="space-y-4">
                        <div className="flex items-start gap-2 text-[0.9375rem] text-[#616161]">
                          <MapPin className="w-5 h-5 text-[#246427] shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{task.locationName}</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[0.9375rem] text-[#616161]">
                          <Calendar className="w-5 h-5 text-[#246427] shrink-0" />
                          <span>{task.date ? format(new Date(task.date), 'EEE, d MMM yyyy') : '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[0.9375rem] text-[#616161]">
                          <Clock className="w-5 h-5 text-[#246427] shrink-0" />
                          <span>
                            {task.startTime} – {task.endTime}
                          </span>
                        </div>
                      </div>
                    </div>



                    <div className="space-y-4">
                        {desc ? (
                            <div className="mb-2">
                                <p className={`text-[0.875rem] text-[#616161] leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
                                    {desc}
                                </p>
                                {desc.length > 100 && (
                                    <button
                                        type="button"
                                        onClick={() => toggleDesc(id)}
                                        className="mt-2 flex items-center gap-1 text-[0.75rem] font-bold text-[#246427] uppercase tracking-wider"
                                    >
                                        {expanded ? <>Read less <ChevronUp className="w-4 h-4" /></> : <>Read more <ChevronDown className="w-4 h-4" /></>}
                                    </button>
                                )}
                            </div>
                        ) : null}

                        <div className="flex flex-col sm:flex-row items-end justify-between gap-4 pt-5 border-t border-[#F1F8E9]">
                            <div className="flex flex-wrap items-center gap-3">
                                {showActions && (
                                    <div className="flex flex-wrap gap-2">
                                        {attState === 'NOT_CHECKED_IN' && (
                                            <button
                                                type="button"
                                                onClick={() => navigate('/worker', { state: { openCheckIn: true, taskId: task._id } })}
                                                className="rounded-[12px] bg-[#246427] text-white text-[0.8125rem] font-bold px-5 py-2.5 hover:bg-[#1a4d1c] shadow-[0_4px_14px_rgba(36,100,39,0.2)] transition-all active:scale-95 uppercase"
                                            >
                                                Check In
                                            </button>
                                        )}
                                        {attState === 'CHECKED_IN' && (
                                            <button
                                                type="button"
                                                onClick={() => navigate('/worker', { state: { openCheckOut: true } })}
                                                className="rounded-[12px] bg-[#C62828] text-white text-[0.8125rem] font-bold px-5 py-2.5 hover:bg-[#b71c1c] shadow-[0_4px_14px_rgba(198,40,40,0.2)] transition-all active:scale-95 uppercase"
                                            >
                                                Check Out
                                            </button>
                                        )}
                                        {attState === 'COMPLETED' && (
                                            <span className="inline-flex items-center gap-2 rounded-full bg-[#E8F5E9] px-4 py-2 text-[0.8125rem] font-bold text-[#246427]">
                                                <CheckCircle2 className="w-4 h-4" />
                                                ATTENDANCE DONE
                                            </span>
                                        )}
                                    </div>
                                )}

                                {(task.reportStatus == null || task.reportStatus === 'DRAFT' || task.reportStatus === 'REJECTED') && (
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/worker/report/${task._id}`)}
                                        className="inline-flex items-center gap-2 rounded-[12px] border-2 border-[#246427] text-[#246427] text-[0.8125rem] font-bold px-4 py-2.5 hover:bg-[#F1F8E9] transition-all active:scale-95 uppercase"
                                    >
                                        <FileText className="w-4 h-4" />
                                        {task.reportStatus === 'REJECTED' ? 'Resubmit Report' : 'Submit Report'}
                                    </button>
                                )}

                                {task.reportStatus === 'SUBMITTED' && (
                                    <span className="inline-flex items-center gap-2 rounded-full bg-[#E3F2FD] px-4 py-2 text-[0.8125rem] font-bold text-[#0277BD]">
                                        <CheckCircle2 className="w-4 h-4" />
                                        REPORT SUBMITTED
                                    </span>
                                )}
                                {task.reportStatus === 'APPROVED' && (
                                    <span className="inline-flex items-center gap-2 rounded-full bg-[#E8F5E9] px-4 py-2 text-[0.8125rem] font-bold text-[#246427]">
                                        <CheckCircle2 className="w-4 h-4" />
                                        REPORT APPROVED
                                    </span>
                                )}
                            </div>

                            <div className="text-left sm:text-right shrink-0">
                                <p className="text-[0.7rem] text-[#212121]/50 italic font-medium">
                                    Attendance allowed {inBuf}m before & {outBuf}m after schedule
                                </p>
                            </div>
                        </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}
    </motion.div>
  );
}
