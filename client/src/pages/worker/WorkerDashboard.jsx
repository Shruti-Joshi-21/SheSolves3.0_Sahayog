import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  LogIn,
  LogOut,
  CheckCircle2,
  MapPin,
  Clock,
  Timer,
  Wrench,
  Radio,
  CheckSquare,
  ClipboardList,
  Calendar,
  Activity,
  FileText,
  History,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import CheckInModal from "../../components/worker/CheckInModal";
import CheckOutModal from "../../components/worker/CheckOutModal";
import SubmitReportModal from "../../components/worker/SubmitReportModal";

function formatLongDate(d) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

function greetingFromHour(h) {
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

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

function formatTimeAmPmFromDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatTimeAmPmFromString(timeStr) {
  if (!timeStr) return '—';
  const mins = parseHM(timeStr);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatRelativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) {
    const aheadMin = Math.ceil(Math.abs(diffMs) / 60000);
    if (aheadMin < 60) return `in ${aheadMin} min`;
    const aheadHr = Math.floor(aheadMin / 60);
    if (aheadHr < 48) return `in ${aheadHr} hour${aheadHr !== 1 ? 's' : ''}`;
    const aheadDays = Math.floor(aheadHr / 24);
    return `in ${aheadDays} day${aheadDays !== 1 ? 's' : ''}`;
  }
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min !== 1 ? 's' : ''} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function deriveAttendanceState(todayAttendance) {
  if (!todayAttendance || !todayAttendance.checkInTime) return 'NOT_CHECKED_IN';
  if (!todayAttendance.checkOutTime) return 'CHECKED_IN';
  return 'COMPLETED';
}

function activityVisuals(item) {
  const { type, status } = item;
  if (type === 'ATTENDANCE') {
    if (status === 'VERIFIED') return { circle: 'bg-green-100', Icon: CheckCircle, iconClass: 'text-green-600' };
    if (status === 'FLAGGED') return { circle: 'bg-amber-100', Icon: AlertTriangle, iconClass: 'text-amber-600' };
    if (status === 'PENDING') return { circle: 'bg-blue-100', Icon: Clock, iconClass: 'text-blue-600' };
    if (status === 'REJECTED') return { circle: 'bg-red-100', Icon: XCircle, iconClass: 'text-red-600' };
  }
  if (type === 'LEAVE') {
    if (status === 'PENDING') return { circle: 'bg-amber-100', Icon: Calendar, iconClass: 'text-amber-600' };
    if (status === 'APPROVED') return { circle: 'bg-green-100', Icon: Calendar, iconClass: 'text-green-600' };
    if (status === 'REJECTED') return { circle: 'bg-red-100', Icon: Calendar, iconClass: 'text-red-600' };
  }
  if (type === 'REPORT') {
    if (status === 'SUBMITTED') return { circle: 'bg-blue-100', Icon: FileText, iconClass: 'text-blue-600' };
    if (status === 'APPROVED') return { circle: 'bg-green-100', Icon: FileText, iconClass: 'text-green-600' };
    if (status === 'REJECTED') return { circle: 'bg-red-100', Icon: FileText, iconClass: 'text-red-600' };
  }
  if (type === 'TASK') {
    return { circle: 'bg-[#427A43]/15', Icon: ClipboardList, iconClass: 'text-[#005F02]' };
  }
  return { circle: 'bg-gray-100', Icon: Activity, iconClass: 'text-gray-600' };
}

function statusBadgeClass(type, status) {
  if (type === 'ATTENDANCE') {
    if (status === 'VERIFIED') return 'bg-[#E8F5E9] text-[#246427]';
    if (status === 'FLAGGED') return 'bg-[#FFF8E1] text-[#B07D00]';
    if (status === 'PENDING') return 'bg-[#E3F2FD] text-[#0277BD]';
    if (status === 'REJECTED') return 'bg-[#FFEBEE] text-[#C62828]';
  }
  if (type === 'LEAVE') {
    if (status === 'PENDING') return 'bg-[#FFF8E1] text-[#B07D00]';
    if (status === 'APPROVED') return 'bg-[#E8F5E9] text-[#246427]';
    if (status === 'REJECTED') return 'bg-[#FFEBEE] text-[#C62828]';
  }
  if (type === 'REPORT') {
    if (status === 'SUBMITTED') return 'bg-[#E3F2FD] text-[#0277BD]';
    if (status === 'APPROVED') return 'bg-[#E8F5E9] text-[#246427]';
    if (status === 'REJECTED') return 'bg-[#FFEBEE] text-[#C62828]';
  }
  if (type === 'TASK') return 'bg-[#E8F5E9] text-[#246427]';
  return 'bg-[#F9FBF7] text-[#616161]';
}

export default function WorkerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dashboardData, setDashboardData] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState('0h 0m 0s');
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [showSubmitReport, setShowSubmitReport] = useState(false);
  const [checkInTaskOverride, setCheckInTaskOverride] = useState(null);

  const fullName = user?.fullName || user?.name || 'there';

  const attendanceState = useMemo(() => deriveAttendanceState(todayAttendance), [todayAttendance]);

  const todayTask = dashboardData?.todayTask ?? null;
  const checkInModalTask = checkInTaskOverride || todayTask;

  useEffect(() => {
    if (loading) return;
    const st = location.state;
    if (!st || (!st.openCheckIn && !st.openCheckOut)) return;

    if (st.openCheckIn) {
      const tid = st.taskId;
      if (tid && todayTask && String(todayTask._id) !== String(tid)) {
        (async () => {
          try {
            const res = await api.get('/worker/tasks/all');
            const list = res.data?.data?.tasks || [];
            const t = list.find((x) => String(x._id) === String(tid));
            setCheckInTaskOverride(t || null);
          } catch {
            setCheckInTaskOverride(null);
          }
        })();
      } else {
        setCheckInTaskOverride(null);
      }
      setShowCheckIn(true);
    }
    if (st.openCheckOut) {
      setShowCheckOut(true);
    }
    navigate(location.pathname, { replace: true, state: {} });
  }, [loading, location.state, location.pathname, navigate, todayTask]);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await api.get('/worker/dashboard', { signal: controller.signal });
        const data = res.data?.data;
        setDashboardData(data);
        setTodayAttendance(data?.todayAttendance ?? null);
      } catch (error) {
        const aborted =
          controller.signal.aborted ||
          error.code === 'ERR_CANCELED' ||
          error.name === 'CanceledError' ||
          error.name === 'AbortError';
        if (aborted) return;
        toast.error(error.response?.data?.message || 'Failed to load dashboard', {
          toastId: 'worker-dashboard-load-error',
        });
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, []);

  const refreshDashboard = useCallback(async () => {
    try {
      const res = await api.get('/worker/dashboard');
      const data = res.data?.data;
      setDashboardData(data);
      setTodayAttendance(data?.todayAttendance ?? null);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to refresh dashboard', {
        toastId: 'worker-dashboard-refresh-error',
      });
    }
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await api.get('/worker/attendance/today');
        setTodayAttendance(res.data?.data ?? null);
      } catch {
        /* keep last known attendance on poll failure */
      }
    };
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  const checkInIso = todayAttendance?.checkInTime;

  useEffect(() => {
    if (attendanceState !== 'CHECKED_IN' || !checkInIso) {
      setElapsedTime('0h 0m 0s');
      return undefined;
    }
    const tick = () => {
      const diff = Date.now() - new Date(checkInIso).getTime();
      const s = Math.max(0, Math.floor(diff / 1000));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      setElapsedTime(`${h}h ${m}m ${sec}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [attendanceState, checkInIso]);

  const hour = new Date().getHours();
  const greeting = greetingFromHour(hour);
  const dateLabel = formatLongDate(new Date());

  const earliestIn = todayTask ? adjustTimeHM(todayTask.startTime, -(todayTask.checkInBuffer ?? 15)) : '—';
  const latestIn = todayTask ? adjustTimeHM(todayTask.startTime, todayTask.checkInBuffer ?? 15) : '—';
  const earliestOut = todayTask ? adjustTimeHM(todayTask.endTime, -(todayTask.checkOutBuffer ?? 15)) : '—';
  const latestOut = todayTask ? adjustTimeHM(todayTask.endTime, todayTask.checkOutBuffer ?? 15) : '—';

  const recentActivity = dashboardData?.recentActivity ?? [];

  const onCheckIn = () => setShowCheckIn(true);
  const onCheckOut = () => setShowCheckOut(true);

  if (loading) {
    return (
      <div className="min-h-[60vh] space-y-6 animate-pulse">
        <div className="h-16 bg-gray-200 rounded-2xl" />
        <div className="h-48 bg-gray-200 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-2xl" />
          ))}
        </div>
        <div className="h-40 bg-gray-200 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  const weeklyAttendanceCount = dashboardData?.weeklyAttendanceCount ?? 0;
  const totalTasksThisWeek = dashboardData?.totalTasksThisWeek ?? 0;
  const pendingLeaveCount = dashboardData?.pendingLeaveCount ?? 0;

  const statTodayStatus = () => {
    if (attendanceState === 'NOT_CHECKED_IN') {
      return { iconColor: '#616161', value: '—', label: 'Not Started' };
    }
    if (attendanceState === 'CHECKED_IN') {
      return { iconColor: '#246427', value: 'Active', label: 'In Progress' };
    }
    const st = todayAttendance?.status;
    if (st === 'VERIFIED') return { iconColor: '#246427', value: 'Verified', label: 'Completed' };
    if (st === 'FLAGGED') return { iconColor: '#B07D00', value: 'Flagged', label: 'Completed' };
    if (st === 'PENDING') return { iconColor: '#0277BD', value: 'Pending', label: 'Completed' };
    if (st === 'REJECTED') return { iconColor: '#C62828', value: 'Rejected', label: 'Completed' };
    return { iconColor: '#616161', value: st || '—', label: 'Completed' };
  };
  const todayStat = statTodayStatus();

  const section = (index) => ({
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay: 0.1 * index },
  });

  const completedStatusBadge = () => {
    const st = todayAttendance?.status;
    if (st === 'VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F5E9] px-4 py-1.5 text-sm text-[#246427] font-semibold">
          ✓ Verified
        </span>
      );
    }
    if (st === 'FLAGGED') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF8E1] px-4 py-1.5 text-sm text-[#B07D00] font-semibold">
          ⚠ Flagged
        </span>
      );
    }
    if (st === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#FFEBEE] px-4 py-1.5 text-sm text-[#C62828] font-semibold">
          ✕ Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#E3F2FD] px-4 py-1.5 text-sm text-[#0277BD] font-semibold">
        ⏳ Pending Review
      </span>
    );
  };

  return (
    <motion.div
      className="space-y-8 pb-10 bg-transparent -mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 pt-4 md:pt-8 min-h-full rounded-b-[20px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >

      {/* Row 1: Stats */}
      <motion.div {...section(1)} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            Icon: CheckSquare,
            iconColor: '#246427',
            value: `${weeklyAttendanceCount} days verified`,
            label: 'This Week',
          },
          {
            Icon: ClipboardList,
            iconColor: '#246427',
            value: String(totalTasksThisWeek),
            label: 'Tasks Assigned',
          },
          {
            Icon: Calendar,
            iconColor: '#B07D00',
            value: String(pendingLeaveCount),
            label: 'Awaiting Approval',
            valueClass: pendingLeaveCount > 0 ? 'text-[#B07D00]' : '',
          },
          {
            Icon: Activity,
            iconColor: todayStat.iconColor,
            value: todayStat.value,
            label: todayStat.label,
            valueClass: todayStat.iconColor,
          },
        ].map((card, cardIndex) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 * cardIndex }}
            className="rounded-[20px] bg-[#FFFFFF] p-5 shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-[#E0E7DC] flex flex-col gap-2"
          >
            <div className="flex items-center gap-3">
              <card.Icon className="w-[22px] h-[22px] text-[#246427]" strokeWidth={2.5} />
              <p className="text-[1.125rem] lg:text-[1.375rem] font-bold text-[#212121] leading-tight truncate">
                {card.value}
              </p>
            </div>
            <div className="flex flex-col">
              <p className="text-[0.75rem] text-[#616161] truncate line-clamp-1">{card.label}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Row 2: Hero (Check-in/Today Task) */}
      <motion.div {...section(2)}>
        <div
          className="relative overflow-hidden rounded-[16px] border-[1.5px] border-[#A5D6A7] shadow-[0_4px_20px_rgba(36,100,39,0.1)] px-4 py-5 sm:px-8 sm:py-7"
          style={{ background: 'linear-gradient(135deg, #F1F8E9 0%, #C8E6C9 100%)' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={attendanceState}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.35 }}
            >
              {/* ── NOT CHECKED IN ── */}
              {attendanceState === 'NOT_CHECKED_IN' && (
                <>
                  <div
                    className="absolute top-0 right-0 text-[0.6875rem] font-[700] tracking-[0.08em] text-[#246427] uppercase"
                    style={{ background: 'rgba(36,100,39,0.1)', borderBottomLeftRadius: '16px', padding: '6px 16px' }}
                  >
                    {todayTask?.isUpcoming ? 'UPCOMING TASK' : "TODAY'S TASK"}
                  </div>
                  <div className="flex flex-col lg:flex-row gap-6 justify-between items-center relative z-10 pt-4 md:pt-0">
                    <div className="flex-1 flex flex-col items-start w-full gap-3">
                      <h2 className="text-[1.5rem] font-[700] text-[#212121]">
                        {todayTask ? todayTask.title : <span className="italic text-[#212121]/70">No task assigned for today</span>}
                      </h2>
                      {todayTask && (
                        <div className="flex flex-col sm:flex-row items-start gap-[24px]">
                          <div className="flex items-start gap-[6px] text-[0.875rem] text-[#2d5a2e] max-w-[355px]">
                            <MapPin className="w-[16px] h-[16px] text-[#246427] opacity-80 shrink-0 mt-[2px]" />
                            <span className="leading-[1.4]">{todayTask.locationName}</span>
                          </div>
                          <div className="flex flex-col gap-[8px]">
                            <div className="flex items-center gap-[6px] text-[0.875rem] text-[#2d5a2e]">
                              <Clock className="w-[16px] h-[16px] text-[#246427] opacity-80 shrink-0" />
                              <span>
                                {todayTask.startTime} – {todayTask.endTime}
                              </span>
                            </div>
                            <div className="flex items-center gap-[6px] text-[0.875rem] text-[#2d5a2e]">
                              <Wrench className="w-[16px] h-[16px] text-[#246427] opacity-80 shrink-0" />
                              <span>{todayTask.workType}</span>
                            </div>
                            <div className="flex items-center gap-[6px] text-[0.875rem] text-[#2d5a2e]">
                              <Radio className="w-[16px] h-[16px] text-[#246427] opacity-80 shrink-0" />
                              <span>Within {todayTask.allowedRadius}m radius</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="w-full lg:w-auto flex flex-col sm:flex-row lg:flex-row gap-4 items-center sm:items-end lg:items-center shrink-0 mt-4 lg:mt-0">
                      <motion.button
                        type="button"
                        disabled={!todayTask}
                        onClick={onCheckIn}
                        whileHover={todayTask ? { scale: 1.02, backgroundColor: '#1a4d1c' } : {}}
                        whileTap={todayTask ? { scale: 0.97 } : {}}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className={`flex items-center justify-center gap-2 rounded-[12px] px-[32px] py-[14px] text-[0.9375rem] font-[700] tracking-[0.03em] text-[#FFFFFF] w-full lg:w-auto ${todayTask
                          ? 'bg-[#246427] shadow-[0_4px_14px_rgba(36,100,39,0.2)]'
                          : 'bg-[#246427]/40 cursor-not-allowed'
                          }`}
                      >
                        CHECK IN
                        <LogIn className="w-[18px] h-[18px]" />
                      </motion.button>
                    </div>
                  </div>
                  {todayTask && (
                    <div className="flex justify-end mt-4">
                      <p className="text-[13px] text-[#2d5a2e]/60 italic text-right">
                        You can mark attendance 15 minutes before and 15 minutes after the scheduled time, the minutes will be specified by the team lead as buffer
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* ── CHECKED IN ── */}
              {attendanceState === 'CHECKED_IN' && (
                <>
                  <div className="flex flex-col lg:flex-row gap-8">
                    <div className="lg:w-[60%] space-y-4">
                      <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-[#212121]">{todayTask?.title}</h1>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#246427]/15 px-3 py-1 text-xs text-[#246427] font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#246427]" aria-hidden />
                          CHECKED IN
                        </span>
                      </div>
                      <p className="text-sm text-[#616161]">Time Elapsed</p>
                      <p className="text-3xl sm:text-4xl font-mono font-bold text-[#212121] tabular-nums">{elapsedTime}</p>
                      <div className="flex flex-wrap items-center gap-x-8 gap-y-1 mt-1">
                        <p className="text-sm text-[#616161] font-semibold">
                          Checked in at {formatTimeAmPmFromDate(todayAttendance?.checkInTime)}
                        </p>
                        {todayTask && (
                          <p className="text-sm text-[#616161] font-semibold">
                            Check out after {formatTimeAmPmFromString(adjustTimeHM(todayTask.endTime, -(todayTask.checkOutBuffer || 15)))}
                          </p>
                        )}
                      </div>
                      {todayAttendance?.checkInFaceMatch === true ? (
                        <p className="text-sm text-[#246427]">Face verified ✓</p>
                      ) : (
                        <p className="text-sm text-[#B07D00]">⚠ Face not verified</p>
                      )}
                    </div>
                    <div className="lg:w-[40%] flex flex-col items-center justify-center gap-3">
                      <motion.button
                        type="button"
                        onClick={onCheckOut}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className="flex w-full lg:w-auto items-center justify-center gap-2 rounded-[12px] bg-[#246427] px-10 py-4 text-[1rem] font-bold text-white shadow-[0_4px_14px_rgba(36,100,39,0.2)] transition-colors hover:bg-[#1a4d1c]"
                      >
                        <LogOut className="w-5 h-5" />
                        CHECK OUT
                      </motion.button>
                    </div>
                  </div>
                </>
              )}

              {/* ── COMPLETED ── */}
              {attendanceState === 'COMPLETED' && (
                <div className="flex flex-col lg:flex-row gap-8">
                  <div className="lg:w-[60%] space-y-4">
                    {/* Row 1: Attendance Recorded with Icon */}
                    <div className="flex items-center gap-2">
                       <CheckCircle2 className="w-6 h-6 text-[#246427]" strokeWidth={2.5} />
                       <h2 className="text-xl font-bold text-[#212121]">Attendance Recorded</h2>
                    </div>

                    {/* Row 2: Task Name with badge on Right */}
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-bold text-[#212121]">{todayTask?.title}</h1>
                      {completedStatusBadge()}
                    </div>

                    {/* Row 3: Timestamps adjacent */}
                    <div className="flex flex-wrap items-center gap-x-8 gap-y-1 mt-1">
                      <p className="text-sm text-[#616161] font-semibold">
                        Checked in at {formatTimeAmPmFromDate(todayAttendance?.checkInTime)}
                      </p>
                      <p className="text-sm text-[#616161] font-semibold">
                        Checked out at {formatTimeAmPmFromDate(todayAttendance?.checkOutTime)}
                      </p>
                    </div>

                    {todayAttendance?.flagReasons?.length > 0 && (
                      <div className="mt-2 rounded-xl bg-amber-400/10 border border-amber-200/50 px-4 py-3 text-sm text-[#212121]">
                        <span className="font-bold text-amber-800">Flag reasons:</span> {todayAttendance.flagReasons.join(', ')}
                      </div>
                    )}
                  </div>

                  <div className="lg:w-[40%] flex items-center justify-center">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowSubmitReport(true)}
                      className="flex w-full lg:w-auto items-center justify-center gap-2 rounded-xl bg-[#246427] px-8 py-4 text-[1rem] font-bold text-white shadow-[0_4px_14px_rgba(36,100,39,0.2)] hover:bg-[#1a4d1c] transition-all"
                    >
                      <FileText size={20} />
                      SUBMIT REPORT
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Row 3: Quick actions */}
      <motion.div {...section(3)} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            title: 'Submit Report',
            subtitle: "Document today's fieldwork",
            Icon: FileText,
            circle: 'bg-[#E8F5E9]',
            iconColor: '#246427',
            onClick: () => navigate('/worker/reports', { state: { openModal: true } }),
          },
          {
            title: 'Request Leave',
            subtitle: 'Apply for time off',
            Icon: Calendar,
            circle: 'bg-[#E8F5E9]',
            iconColor: '#246427',
            onClick: () => navigate('/worker/leave', { state: { openModal: true } }),
          },
          {
            title: 'View History',
            subtitle: 'Past check-ins & records',
            Icon: History,
            circle: 'bg-[#E8F5E9]',
            iconColor: '#246427',
            onClick: () => navigate('/worker/attendance/history'),
          },
          {
            title: 'My Tasks',
            subtitle: 'View all assigned tasks',
            Icon: ClipboardList,
            circle: 'bg-[#E8F5E9]',
            iconColor: '#246427',
            onClick: () => navigate('/worker/tasks'),
          },
        ].map((action, i) => (
          <motion.button
            key={action.title}
            type="button"
            onClick={action.onClick}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 * i }}
            whileHover={{ scale: 1.02, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
            whileTap={{ scale: 0.98 }}
            className="rounded-[20px] bg-[#FFFFFF] p-4 sm:p-6 shadow-[0_4px_12px_rgba(0,0,0,0.05)] text-left border border-[#E0E7DC] hover:border-[#246427] transition-all"
          >
            <div
              className={`mx-auto mb-3 flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-full ${action.circle}`}
            >
              <action.Icon className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: action.iconColor }} />
            </div>
            <h3 className="font-semibold text-[#212121] text-center text-sm sm:text-base">{action.title}</h3>
            <p className="text-[0.7rem] sm:text-[0.75rem] text-[#616161] text-center mt-1 hidden sm:block">{action.subtitle}</p>
          </motion.button>
        ))}
      </motion.div>

      {/* Row 4: Task detail */}
      {todayTask && (
        <div {...section(4)} className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="font-semibold text-[#212121]">
              {todayTask?.isUpcoming ? 'Upcoming Task' : "Today's Task"}
            </span>
          </div>

          <motion.div className="rounded-[20px] bg-[#FFFFFF] shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-[#E0E7DC] p-6 relative">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
              <div className="flex flex-col gap-1">
                <h3 className="text-[1.125rem] font-bold text-[#212121]">{todayTask.title}</h3>
                <p className="text-[0.8125rem] text-[#616161] font-semibold">
                  Assigned by {todayTask.createdBy?.fullName || '—'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="rounded-[10px] bg-[#E8F5E9] text-[#246427] text-xs font-semibold px-3 py-1">ACTIVE</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-start gap-2 text-[0.9375rem] text-[#616161]">
                  <MapPin className="w-5 h-5 text-[#246427] shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{todayTask.locationName}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[0.9375rem] text-[#616161]">
                  <Clock className="w-5 h-5 text-[#246427] shrink-0" />
                  {todayTask.startTime} – {todayTask.endTime}
                </div>
                <div className="flex items-center gap-2 text-[0.9375rem] text-[#616161]">
                  <Wrench className="w-5 h-5 text-[#246427] shrink-0" />
                  {todayTask.workType}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-[#F1F8E9] flex justify-end">
              <p className="text-[0.75rem] text-[#616161] italic">
                You can mark attendance {todayTask.checkInBuffer || 15} minutes before and {todayTask.checkOutBuffer || 15} minutes after the scheduled time
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Row 5: Activity */}
      <motion.div {...section(5)}>
        <h2 className="font-semibold text-[#212121]">Recent Activity</h2>
        <p className="text-[0.75rem] text-[#616161] mb-4">Your last 5 actions</p>
        {recentActivity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-[20px] bg-[#FFFFFF] shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-[#E0E7DC]">
            <Activity className="w-16 h-16 text-[#E0E7DC] mb-3" />
            <p className="text-[0.875rem] text-[#616161]">No recent activity</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {recentActivity.map((item, itemIndex) => {
              const { circle, Icon, iconClass } = activityVisuals(item);
              return (
                <motion.li
                  key={`${item.type}-${item.time}-${itemIndex}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.04 * itemIndex }}
                  className="flex flex-row items-center gap-4 rounded-[14px] bg-[#FFFFFF] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E0E7DC]"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-[#212121] block truncate">{item.label}</span>
                    <p className="text-[0.75rem] text-[#616161] mt-1">{formatRelativeTime(item.time)}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-[10px] px-3 py-1 text-[0.75rem] font-medium ${statusBadgeClass(
                      item.type,
                      item.status
                    )}`}
                  >
                    {item.status}
                  </span>
                </motion.li>
              );
            })}
          </ul>
        )}
      </motion.div>

      <CheckInModal
        isOpen={showCheckIn}
        onClose={() => {
          setShowCheckIn(false);
          setCheckInTaskOverride(null);
        }}
        task={checkInModalTask}
        onSuccess={(result) => {
          setShowCheckIn(false);
          setCheckInTaskOverride(null);
          refreshDashboard();
          if (result?.message) toast.success(result.message);
        }}
      />
      <CheckOutModal
        isOpen={showCheckOut}
        onClose={() => setShowCheckOut(false)}
        task={dashboardData?.todayTask}
        attendanceRecord={todayAttendance}
        onSuccess={(result) => {
          setShowCheckOut(false);
          refreshDashboard();
          if (result?.message) toast.success(result.message);
        }}
      />
      <SubmitReportModal
        isOpen={showSubmitReport}
        onClose={() => setShowSubmitReport(false)}
        initialTaskId={todayTask?._id || ''}
        initialAttendanceId={todayAttendance?._id || ''}
        onSuccess={() => {
          setShowSubmitReport(false);
          refreshDashboard();
        }}
      />
    </motion.div>
  );
}