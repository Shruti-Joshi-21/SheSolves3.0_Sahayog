import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

function uploadsBaseUrl() {
  const raw = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return raw.replace(/\/api\/?$/, '');
}

function resolveReportImageSrc(stored) {
  if (!stored) return null;
  if (String(stored).startsWith('http')) return stored;
  const base = uploadsBaseUrl();
  const s = String(stored).replace(/^\//, '');
  if (s.startsWith('uploads/')) return `${base}/${s}`;
  if (s.startsWith('reports/')) return `${base}/uploads/${s}`;
  return `${base}/uploads/reports/${s}`;
}

function fmtTaskDate(d) {
  if (!d) return '—';
  const x = new Date(d);
  return x.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function statusBadgeClass(status) {
  switch (status) {
    case 'SUBMITTED':
      return 'bg-[#E3F2FD] text-[#0277BD] border border-[#90CAF9]';
    case 'APPROVED':
      return 'bg-[#E8F5E9] text-[#246427] border border-[#A5D6A7]';
    case 'REJECTED':
      return 'bg-[#FFEBEE] text-[#C62828] border border-[#EF9A9A]';
    default:
      return 'bg-[#F9FBF7] text-[#616161] border border-[#E0E7DC]';
  }
}

export default function ReportDetailDrawer({ isOpen, onClose, report, loading }) {
  const task = report?.task;
  const images = Array.isArray(report?.images) ? report.images : [];

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
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-[#E0E7DC] bg-[#FFFFFF] p-4">
              <h2 className="font-semibold text-[1.125rem] text-[#212121]">Report Detail</h2>
              <div className="flex items-center gap-2">
                {report?.status && (
                  <span
                    className={`rounded-full px-3 py-1 text-[0.75rem] font-medium ${statusBadgeClass(report.status)}`}
                  >
                    {report.status}
                  </span>
                )}
                <button
                  type="button"
                  aria-label="Close"
                  className="rounded-lg p-1.5 text-[#616161] hover:text-[#246427] hover:bg-[#F1F8E9] transition-colors"
                  onClick={onClose}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {loading && (
              <div className="p-8 text-center text-sm text-[#616161]">Loading…</div>
            )}

            {!loading && report && (
              <div className="space-y-6 p-4 pb-10">
                <div className="rounded-[10px] bg-[#F1F8E9] p-4">
                  <p className="text-[0.75rem] font-medium uppercase tracking-wide text-[#616161]">Task</p>
                  <p className="mt-1 font-semibold text-[#212121]">{task?.title || '—'}</p>
                  <p className="mt-2 text-sm text-[#616161]">{task?.locationName || '—'}</p>
                  <p className="mt-1 text-sm text-[#616161]">{fmtTaskDate(task?.date)}</p>
                  <p className="mt-1 text-sm text-[#616161]">{task?.workType || '—'}</p>
                </div>

                <div>
                  <h3 className="border-l-4 border-[#246427] pl-3 font-semibold text-[#212121]">Description</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#616161]">{report.description || '—'}</p>
                </div>

                {report.summary ? (
                  <div>
                    <h3 className="border-l-4 border-[#246427] pl-3 font-semibold text-[#212121]">Summary</h3>
                    <p className="mt-2 text-sm italic text-[#616161]">{report.summary}</p>
                  </div>
                ) : null}

                <div>
                  <h3 className="mb-3 font-semibold text-[#212121]">Field Photos</h3>
                  {images.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {images.map((path) => {
                        const src = resolveReportImageSrc(path);
                        return (
                          <button
                            key={path}
                            type="button"
                            className="block w-full overflow-hidden rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#246427] border border-[#E0E7DC]"
                            onClick={() => src && window.open(src, '_blank', 'noopener,noreferrer')}
                          >
                            {src ? (
                              <img
                                src={src}
                                alt=""
                                className="h-32 w-full object-cover"
                              />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-[#616161]">No photos attached</p>
                  )}
                </div>

                {report.status && report.status !== 'SUBMITTED' && (
                  <div>
                    <h3 className="mb-2 font-semibold text-[#212121]">Review</h3>
                    <p className="text-sm text-[#616161]">
                      Reviewed by:{' '}
                      <span className="font-medium text-[#212121]">
                        {report.reviewedBy?.fullName || '—'}
                      </span>
                    </p>
                    <div className="mt-2">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-[0.75rem] font-medium ${statusBadgeClass(
                          report.status
                        )}`}
                      >
                        {report.status}
                      </span>
                    </div>
                    {report.reviewNote ? (
                      <p className="mt-3 text-sm italic text-[#616161]">{report.reviewNote}</p>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
}
