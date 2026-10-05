import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Calendar, Clock, Wrench, AlertTriangle } from 'lucide-react';

function uploadsBaseUrl() {
  const raw = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return raw.replace(/\/api\/?$/, '');
}

function resolveImageSrc(stored) {
  if (!stored) return null;
  if (String(stored).startsWith('http')) return stored;
  const base = uploadsBaseUrl();
  const s = String(stored).replace(/^\//, '');
  if (s.startsWith('uploads/')) return `${base}/${s}`;
  if (s.startsWith('attendance/')) return `${base}/uploads/${s}`;
  return `${base}/uploads/attendance/${s}`;
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtTaskDate(d) {
  if (!d) return '—';
  const x = new Date(d);
  return x.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function durationLabel(inIso, outIso) {
  if (!inIso || !outIso) return null;
  const ms = new Date(outIso) - new Date(inIso);
  if (ms < 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function statusBadgeClass(status) {
  switch (status) {
    case 'VERIFIED':
      return 'bg-[#E8F5E9] text-[#246427] border border-[#A5D6A7]';
    case 'FLAGGED':
      return 'bg-[#FFF8E1] text-[#B07D00] border border-[#FFE082]';
    case 'PENDING':
      return 'bg-[#E3F2FD] text-[#0277BD] border border-[#90CAF9]';
    case 'REJECTED':
      return 'bg-[#FFEBEE] text-[#C62828] border border-[#EF9A9A]';
    default:
      return 'bg-[#F9FBF7] text-[#616161] border border-[#E0E7DC]';
  }
}

export default function AttendanceDetailDrawer({ isOpen, onClose, record, loading }) {
  const task = record?.task;
  const beforeSrc = resolveImageSrc(record?.beforeImage);
  const afterSrc = resolveImageSrc(record?.afterImage);

  const overlay = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 z-50 h-full w-full sm:w-[420px] overflow-y-auto bg-[#FFFFFF] shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E0E7DC] bg-[#FFFFFF] p-4">
              <h2 className="font-semibold text-[1.125rem] text-[#212121]">Attendance Detail</h2>
              <button
                type="button"
                aria-label="Close"
                className="rounded-lg p-1.5 text-[#616161] hover:text-[#246427] hover:bg-[#F1F8E9] transition-colors"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {loading && (
              <div className="p-8 text-center text-sm text-[#616161]">Loading…</div>
            )}
            {!loading && record && (
              <>
                <div className="px-4 pt-3">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(
                      record.status
                    )}`}
                  >
                    {record.status}
                  </span>
                </div>

                <div className="mx-4 mt-4 rounded-[10px] bg-[#F1F8E9] p-4">
                  <p className="text-[0.75rem] font-medium uppercase tracking-wide text-[#616161]">Task</p>
                  <p className="mt-1 font-semibold text-[#212121]">{task?.title || '—'}</p>
                  <div className="mt-2 flex items-start gap-2 text-sm text-[#616161]">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{task?.locationName || '—'}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-[#616161]">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>{fmtTaskDate(task?.date)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-[#616161]">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>
                      {task?.startTime && task?.endTime
                        ? `${task.startTime} – ${task.endTime}`
                        : '—'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-[#616161]">
                    <Wrench className="h-4 w-4 shrink-0" />
                    <span>{task?.workType || '—'}</span>
                  </div>
                </div>

                <div className="mx-4 mt-4 border-l-4 border-[#246427] pl-3">
                  <h3 className="font-semibold text-[#212121]">Check-In</h3>
                </div>
                <div className="mx-4 mt-3 space-y-3 text-sm">
                  <div>
                    <span className="text-[#616161]">Time</span>
                    <p className="font-medium text-[#212121]">{fmtDateTime(record.checkInTime)}</p>
                  </div>
                  <div>
                    <span className="text-[#616161]">GPS</span>
                    <p className="font-mono text-xs text-[#212121]">
                      {record.checkInLocation?.latitude != null &&
                      record.checkInLocation?.longitude != null
                        ? `${record.checkInLocation.latitude}, ${record.checkInLocation.longitude}`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#616161]">Face</span>
                    <div className="mt-1">
                      {record.checkInFaceMatch === true ? (
                        <span className="inline-block rounded-full bg-[#E8F5E9] px-2 py-0.5 text-[0.75rem] font-medium text-[#246427]">
                          ✓ Matched
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-[#FFEBEE] px-2 py-0.5 text-[0.75rem] font-medium text-[#C62828]">
                          ✗ No Match
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-[#616161]">Before Photo</p>
                    {beforeSrc ? (
                      <a href={beforeSrc} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                        <img
                          src={beforeSrc}
                          alt="Before"
                          className="mt-2 max-h-48 w-full rounded-[14px] object-cover"
                        />
                      </a>
                    ) : (
                      <div className="mt-2 flex min-h-[100px] items-center justify-center rounded-[10px] border border-dashed border-[#E0E7DC] text-sm text-[#616161]">
                        No photo uploaded
                      </div>
                    )}
                  </div>
                </div>

                <div className="mx-4 mt-6 border-l-4 border-[#246427] pl-3">
                  <h3 className="font-semibold text-[#212121]">Check-Out</h3>
                </div>
                <div className="mx-4 mt-3 space-y-3 text-sm">
                  {!record.checkOutTime ? (
                    <div className="rounded-[10px] border border-[#FFE082] bg-[#FFF8E1] p-3 text-sm text-[#B07D00]">
                      Check-out not recorded yet
                    </div>
                  ) : (
                    <>
                      <div>
                        <span className="text-[#616161]">Time</span>
                        <p className="font-medium text-[#212121]">{fmtDateTime(record.checkOutTime)}</p>
                      </div>
                      <div>
                        <span className="text-[#616161]">GPS</span>
                        <p className="font-mono text-xs text-[#212121]">
                          {record.checkOutLocation?.latitude != null &&
                          record.checkOutLocation?.longitude != null
                            ? `${record.checkOutLocation.latitude}, ${record.checkOutLocation.longitude}`
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[#616161]">Face</span>
                        <div className="mt-1">
                          {record.checkOutFaceMatch === true ? (
                            <span className="inline-block rounded-full bg-[#E8F5E9] px-2 py-0.5 text-[0.75rem] font-medium text-[#246427]">
                              ✓ Matched
                            </span>
                          ) : (
                            <span className="inline-block rounded-full bg-[#FFEBEE] px-2 py-0.5 text-[0.75rem] font-medium text-[#C62828]">
                              ✗ No Match
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-[#616161]">After Photo</p>
                        {afterSrc ? (
                          <a href={afterSrc} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                            <img
                              src={afterSrc}
                              alt="After"
                              className="mt-2 max-h-48 w-full rounded-[14px] object-cover"
                            />
                          </a>
                        ) : (
                          <div className="mt-2 flex min-h-[100px] items-center justify-center rounded-[10px] border border-dashed border-[#E0E7DC] text-sm text-[#616161]">
                            No photo uploaded
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {record.flagReasons?.length > 0 && (
                  <div className="mx-4 mt-6">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-[#B07D00]">
                      <AlertTriangle className="h-5 w-5 text-[#B07D00]" />
                      Flags Raised
                    </div>
                    <ul className="space-y-2">
                      {record.flagReasons.map((reason, i) => (
                        <li
                          key={`${i}-${reason}`}
                          className="flex items-start gap-2 rounded-[10px] bg-[#FFF8E1] p-3 text-sm text-[#B07D00]"
                        >
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#B07D00]" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs italic text-[#616161]">
                      Team lead has been notified of these flags
                    </p>
                  </div>
                )}

                {record.checkInTime && record.checkOutTime && (
                  <div className="mx-4 mb-8 mt-6 border-l-4 border-[#246427] bg-[#F9FBF7] rounded-r-[10px] p-4 shadow-sm">
                    <p className="text-[0.875rem] text-[#616161]">Total Duration</p>
                    <p className="text-[1.5rem] font-bold text-[#246427]">
                      {durationLabel(record.checkInTime, record.checkOutTime) || '—'}
                    </p>
                  </div>
                )}
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
}
