import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { ClipboardList, CheckCircle2, AlertTriangle, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../utils/api';
import AttendanceDetailDrawer from "../../components/worker/AttendanceDetailDrawer";

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfLocalDay(y, m, d) {
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function isCalendarToday(y, m, d) {
  const t = new Date();
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d;
}

function isFutureLocalDay(y, m, d) {
  const t = new Date();
  const todayStart = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0, 0);
  return startOfLocalDay(y, m, d) > todayStart;
}

function isPastLocalDay(y, m, d) {
  const t = new Date();
  const todayStart = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0, 0);
  return startOfLocalDay(y, m, d) < todayStart;
}

const gridVariants = {
  enter: (dir) => ({
    x: dir >= 0 ? 30 : -30,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir) => ({
    x: dir >= 0 ? -30 : 30,
    opacity: 0,
  }),
};

export default function AttendancePage() {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    verified: 0,
    flagged: 0,
    pending: 0,
    attendanceRate: 0,
  });
  const nowRef = useRef(new Date());
  const [currentMonth, setCurrentMonth] = useState(() => nowRef.current.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(() => nowRef.current.getFullYear());
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [navDirection, setNavDirection] = useState(1);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/worker/attendance/history', {
          params: { month: currentMonth, year: currentYear },
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const data = res.data?.data;
        setRecords(data?.records ?? []);
        setStats(
          data?.stats ?? {
            total: 0,
            verified: 0,
            flagged: 0,
            pending: 0,
            attendanceRate: 0,
          }
        );
      } catch (e) {
        const aborted =
          controller.signal.aborted ||
          e.code === 'ERR_CANCELED' ||
          e.name === 'CanceledError' ||
          e.name === 'AbortError';
        if (aborted) return;
        toast.error(e.response?.data?.message || 'Failed to load attendance', {
          toastId: 'worker-attendance-history-error',
        });
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [currentMonth, currentYear]);

  const recordMap = useMemo(() => {
    const map = {};
    records.forEach((r) => {
      if (!r.checkInTime) return;
      const day = new Date(r.checkInTime).getDate();
      map[day] = r;
    });
    return map;
  }, [records]);

  const today = new Date();
  const ty = today.getFullYear();
  const tm = today.getMonth() + 1;
  const isNextDisabled = currentYear > ty || (currentYear === ty && currentMonth >= tm);

  const goPrevMonth = () => {
    setNavDirection(-1);
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (isNextDisabled) return;
    setNavDirection(1);
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

  const verifiedThisMonth = records.filter((r) => r.status === 'VERIFIED').length;
  const flaggedThisMonth = records.filter((r) => r.status === 'FLAGGED').length;

  const rateIconColor =
    stats.attendanceRate >= 80
      ? '#246427'
      : stats.attendanceRate >= 50
        ? '#B07D00'
        : '#C62828';
  const rateValueColor = rateIconColor;

  const paddingCells = Array.from({ length: firstDayOfMonth }, (_, i) => (
    <div key={`pad-${i}`} className="min-h-[64px] rounded-xl bg-transparent p-1" />
  ));

  const dayCells = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const rec = recordMap[day];
    const isToday = isCalendarToday(currentYear, currentMonth, day);
    const isFuture = isFutureLocalDay(currentYear, currentMonth, day);
    const isPast = isPastLocalDay(currentYear, currentMonth, day);
    const hasRecord = Boolean(rec);
    const hasFlags = rec?.flagReasons?.length > 0;

    const status = rec?.status;
    let dotClass = 'bg-[#E0E7DC]';
    let labelClass = 'text-[#616161]';
    let labelText = '';
    let cellBg = '';
    let hoverBg = '';

    if (hasRecord) {
      switch (status) {
        case 'VERIFIED':
          dotClass = 'bg-[#246427]';
          labelClass = 'text-[#246427]';
          labelText = 'VERIFIED';
          hoverBg = 'hover:bg-[#E8F5E9]';
          break;
        case 'FLAGGED':
          dotClass = 'bg-[#B07D00]';
          labelClass = 'text-[#B07D00]';
          labelText = 'FLAGGED';
          cellBg = 'bg-[#FFF8E1]';
          hoverBg = 'hover:bg-[#FFF8E1]';
          break;
        case 'PENDING':
          dotClass = 'bg-[#0277BD]';
          labelClass = 'text-[#0277BD]';
          labelText = 'PENDING';
          hoverBg = 'hover:bg-[#E3F2FD]';
          break;
        case 'REJECTED':
          dotClass = 'bg-[#C62828]';
          labelClass = 'text-[#C62828]';
          labelText = 'REJECTED';
          cellBg = 'bg-[#FFEBEE]';
          hoverBg = 'hover:bg-[#FFEBEE]';
          break;
        default:
          labelText = status || '';
      }
    }

    const clickable = hasRecord && !isFuture;
    const showPastEmpty = !hasRecord && isPast && !isToday;

    return (
      <div key={day} className="relative min-h-[64px] rounded-xl p-1">
        <motion.div
          role={clickable ? 'button' : undefined}
          tabIndex={clickable ? 0 : undefined}
          onClick={() => {
            if (clickable && rec) {
              setSelectedRecord(rec);
              setShowDrawer(true);
            }
          }}
          onKeyDown={(e) => {
            if (clickable && rec && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setSelectedRecord(rec);
              setShowDrawer(true);
            }
          }}
          whileHover={
            clickable
              ? { scale: 1.04, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }
              : undefined
          }
          whileTap={clickable ? { scale: 0.97 } : undefined}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className={[
            'flex h-full min-h-[64px] flex-col rounded-[14px] p-1',
            isToday ? 'border-2 border-[#246427]' : 'border border-transparent',
            cellBg,
            clickable ? `cursor-pointer ${hoverBg}` : '',
            !clickable && isFuture ? 'cursor-default' : '',
            showPastEmpty ? '' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {hasFlags && (
            <span
              className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white"
              aria-hidden
            />
          )}
          <div className="flex justify-center">
            {isToday ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#246427] text-[0.875rem] font-bold text-white">
                {day}
              </span>
            ) : (
              <span
                className={`text-[0.875rem] font-semibold ${isFuture
                    ? 'text-[#BDBDBD]'
                    : showPastEmpty
                      ? 'text-[#9E9E9E]'
                      : 'text-[#212121]'
                  }`}
              >
                {day}
              </span>
            )}
          </div>
          {hasRecord && (
            <div className="mt-auto flex flex-col items-center gap-0.5 pt-0.5">
              <div className="flex items-center gap-0.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
                {status === 'FLAGGED' && (
                  <AlertTriangle className="h-2.5 w-2.5 text-[#B07D00]" strokeWidth={2.5} />
                )}
              </div>
              <span className={`text-[10px] font-medium leading-none ${labelClass} hidden sm:block truncate`}>{labelText}</span>
            </div>
          )}
        </motion.div>
      </div>
    );
  });

  return (
    <motion.div
      className="space-y-6 bg-transparent -mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 pt-4 md:pt-8 pb-10 min-h-full rounded-b-[20px]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >


      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[20px] bg-gray-200" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              Icon: ClipboardList,
              iconStyle: { color: '#246427' },
              value: stats.total,
              label: 'All Time',
              cardClass: '',
            },
            {
              Icon: CheckCircle2,
              iconStyle: { color: '#246427' },
              value: stats.verified,
              label: 'Verified',
              cardClass: '',
            },
            {
              Icon: AlertTriangle,
              iconStyle: { color: '#B07D00' },
              value: stats.flagged,
              label: 'Flagged',
              cardClass: stats.flagged > 0 ? 'bg-[#FFF8E1] border-none' : '',
            },
            {
              Icon: TrendingUp,
              iconStyle: { color: rateIconColor },
              value: `${stats.attendanceRate}%`,
              label: 'Verified Rate',
              cardClass: '',
            },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.25 }}
              className={`rounded-[20px] bg-[#FFFFFF] border border-[#E0E7DC] p-5 shadow-[0_4px_12px_rgba(0,0,0,0.05)] flex flex-col gap-2 ${card.cardClass}`}
            >
              <div className="flex items-center gap-3">
                <card.Icon className="h-[22px] w-[22px]" style={card.iconStyle} strokeWidth={2.5} />
                <p 
                  className="text-[1.25rem] lg:text-[1.5rem] font-bold leading-tight truncate text-[#212121]"
                >
                  {card.value}
                </p>
              </div>
              <div className="flex flex-col">
                <p className="text-[0.75rem] text-[#616161] truncate line-clamp-1">{card.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <motion.div
        className="rounded-[20px] bg-[#FFFFFF] p-6 shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-[#E0E7DC]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        <div className="mb-4 grid grid-cols-3 items-center gap-2">
          <button
            type="button"
            onClick={goPrevMonth}
            className="flex w-fit items-center justify-center rounded-xl border border-[#E0E7DC] p-2 text-[#616161] hover:bg-[#F1F8E9]"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center text-[1.125rem] font-bold text-[#212121]">
            {MONTH_NAMES[currentMonth - 1]} {currentYear}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={goNextMonth}
              disabled={isNextDisabled}
              className="flex items-center justify-center rounded-xl border border-[#E0E7DC] p-2 text-[#616161] hover:bg-[#F1F8E9] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-1 border-b border-[#E0E7DC] pb-2">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-center text-[0.75rem] font-medium uppercase text-[#616161]">
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }, (_, i) => (
              <div key={i} className="min-h-[64px] animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait" custom={navDirection}>
            <motion.div
              key={`${currentYear}-${currentMonth}`}
              custom={navDirection}
              variants={gridVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22 }}
              className="grid grid-cols-7 gap-1"
            >
              {paddingCells}
              {dayCells}
            </motion.div>
          </AnimatePresence>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 border-t border-[#E0E7DC] pt-4">
          {[
            { c: '#246427', t: 'Verified' },
            { c: '#B07D00', t: 'Flagged' },
            { c: '#0277BD', t: 'Pending' },
            { c: '#C62828', t: 'Rejected' },
            { c: '#E0E7DC', t: 'No Record' },
          ].map((item) => (
            <div key={item.t} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.c }} />
              <span className="text-[0.75rem] text-[#616161]">{item.t}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {!loading && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="rounded-full bg-[#E8F5E9] px-4 py-2 text-[0.875rem] font-medium text-[#246427]">
            {verifiedThisMonth} days verified this month
          </span>
          {flaggedThisMonth > 0 && (
            <span className="rounded-full bg-[#FFF8E1] px-4 py-2 text-[0.875rem] font-medium text-[#B07D00]">
              {flaggedThisMonth} days flagged
            </span>
          )}
          <span className="rounded-full bg-[#F1F8E9] px-4 py-2 text-[0.875rem] font-medium text-[#616161]">
            {records.length} total records this month
          </span>
        </div>
      )}

      <AnimatePresence>
        {showDrawer && selectedRecord && (
          <AttendanceDetailDrawer
            isOpen={showDrawer}
            onClose={() => {
              setShowDrawer(false);
              setSelectedRecord(null);
            }}
            record={selectedRecord}
            loading={false}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
