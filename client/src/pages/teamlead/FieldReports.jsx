import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, CheckCircle2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext';

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

const FieldReports = () => {
  useAuth();
  const [reports, setReports] = useState([]);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [selectedReport, setSelectedReport] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [isForwarding, setIsForwarding] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const fetchReports = async () => {
    const response = await api.get('/teamlead/field-reports');
    const { data } = response.data;
    setReports(data || []);
  };
  useEffect(() => {
    fetchReports();
  }, []);
  useEffect(() => {
    const t = setInterval(fetchReports, 60000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    if (activeFilter === 'ALL') return reports;
    if (activeFilter === 'Pending review') return reports.filter((r) => r.status !== 'FORWARDED');
    return reports.filter((r) => r.status === 'FORWARDED' || r.forwardedToAdmin);
  }, [reports, activeFilter]);

  const forward = async () => {
    if (!selectedReport) return;
    setIsForwarding(true);
    setErrorText('');
    try {
      await api.post(`/teamlead/field-reports/${selectedReport._id}/forward`, { summary });
      setReports((prev) =>
        prev.map((r) => (r._id === selectedReport._id ? { ...r, status: 'FORWARDED', forwardedToAdmin: true } : r))
      );
      toast.success('Report forwarded to admin');
      setDialogOpen(false);
      setSelectedReport(null);
      setSummary('');
    } catch (err) {
      setErrorText(err.response?.data?.message || 'Failed to forward report');
    } finally {
      setIsForwarding(false);
    }
  };

  const openReportDetail = async (reportId) => {
    setDialogOpen(true);
    setErrorText('');
    setIsDetailLoading(true);
    try {
      const response = await api.get(`/teamlead/field-reports/${reportId}`);
      const report = response.data?.data || null;
      setSelectedReport(report);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load report details');
      setDialogOpen(false);
      setSelectedReport(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const reportStatusBadge = (s) =>
    s === 'FORWARDED' || s === 'APPROVED' || s === 'COMPLETED'
      ? 'bg-[#eaf3de] text-[#27500A]'
      : s === 'REJECTED'
        ? 'bg-[#fcebeb] text-[#791F1F]'
        : s === 'PENDING'
          ? 'bg-[#faeeda] text-[#633806]'
          : 'bg-[#faeeda] text-[#633806]';

  const wordCount = summary.trim() ? summary.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <>
      <div className="bg-transparent p-6">
        <div className="flex gap-2 mb-5 flex-wrap">
          {['ALL', 'Pending review', 'Forwarded'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActiveFilter(f)}
              className={
                activeFilter === f
                  ? 'bg-[#1a4a1a] text-white text-sm font-medium px-4 py-1.5 rounded-lg'
                  : 'bg-white border border-[#e8e0d0] text-gray-500 text-sm font-normal px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors'
              }
            >
              {f}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((report, index) => (
            <motion.div
              key={report._id}
              className="bg-white rounded-xl border border-[#e8e0d0] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.04 }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <h2 className="text-sm font-semibold text-gray-800 truncate">{report.task?.title || 'Task'}</h2>
                  <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-normal shrink-0">
                    {report.task?.workType || 'General'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 font-normal mt-0.5">
                  {report.worker?.fullName || 'Worker'} · {new Date(report.createdAt).toLocaleDateString()}
                </p>
                <p className="text-[13px] text-gray-500 font-normal mt-2 line-clamp-2 leading-snug">
                  {report.description || report.summary || ''}
                </p>
              </div>

              <div className="shrink-0 flex items-center md:flex-col md:items-end gap-3 pt-3 md:pt-0 border-t md:border-t-0">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${reportStatusBadge(report.status)}`}>
                  {report.status}
                </span>
                <button
                  type="button"
                  className="rounded-[10px] border-[1.5px] border-[#246427] bg-white px-4 py-2 text-xs font-semibold text-[#246427] hover:bg-[#E8F5E9] transition-colors whitespace-nowrap"
                  onClick={() => openReportDetail(report._id)}
                >
                  View More
                </button>
              </div>
            </motion.div>
          ))}
        </div>
        {!filtered.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-400">No reports submitted yet</p>
            <p className="text-xs text-gray-300 mt-1 font-normal">Check back after workers file reports</p>
          </div>
        ) : null}
      </div>
      <AnimatePresence>
        {dialogOpen && selectedReport ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDialogOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              className="relative mt-8 w-full max-w-lg rounded-[20px] bg-[#FFFFFF] shadow-[0_8px_32px_rgba(0,0,0,0.14)] overflow-hidden"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#1a4a1a] px-5 py-4 flex justify-between items-center">
                <p className="text-[#C0B87A] text-sm font-medium">
                  {isDetailLoading ? 'Loading...' : selectedReport.task?.title || 'Field report'}
                </p>
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-[24px] space-y-5 max-h-[75vh] overflow-y-auto">
                {isDetailLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-gray-500 animate-pulse">Loading report details...</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <p className="text-[0.75rem] font-bold text-[#616161] uppercase tracking-wider">Worker&apos;s Description</p>
                      <div className="rounded-[12px] bg-[#F9FBF7] border border-[#E0E7DC] p-4 text-sm text-[#424242] leading-relaxed">
                        {selectedReport.description || selectedReport.summary || 'No description provided'}
                      </div>
                    </div>

                    {Array.isArray(selectedReport.reportFieldResponses) && selectedReport.reportFieldResponses.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <p className="text-[0.75rem] font-bold text-[#616161] uppercase tracking-wider">Submitted Data</p>
                        <div className="grid grid-cols-1 gap-2">
                          {selectedReport.reportFieldResponses.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center rounded-[10px] border border-[#E0E7DC] bg-[#FFFFFF] px-4 py-3">
                              <span className="text-xs text-[#757575] font-medium">{item.fieldName}</span>
                              <span className="text-sm text-[#212121] font-semibold">{item.value != null && item.value !== '' ? String(item.value) : '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {Array.isArray(selectedReport.images) && selectedReport.images.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <p className="text-[0.75rem] font-bold text-[#616161] uppercase tracking-wider">Field Evidence</p>
                        <div className="grid grid-cols-2 gap-3">
                          {selectedReport.images.map((path, idx) => {
                            const src = resolveReportImageSrc(path);
                            return (
                              <button
                                key={idx}
                                type="button"
                                className="group relative aspect-video overflow-hidden rounded-[12px] border border-[#E0E7DC] hover:border-[#246427] transition-all"
                                onClick={() => src && window.open(src, '_blank')}
                              >
                                {src ? (
                                  <img src={src} alt="Field data" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                                ) : (
                                  <div className="h-full w-full bg-gray-100 animate-pulse" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-[#E0E7DC] my-6" />

                    {selectedReport.forwardedToAdmin ? (
                      <div className="rounded-[12px] bg-[#E8F5E9] border border-[#C8E6C9] p-4 flex items-center justify-center gap-3 text-[#2E7D32] font-semibold">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Successfully forwarded to admin</span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-[0.75rem] font-bold text-[#616161] uppercase tracking-wider">Admin Forwarding Note</p>
                          <textarea
                            rows={3}
                            className="w-full border border-[#E0E7DC] rounded-[12px] px-4 py-3 text-sm text-[#212121] bg-white focus:outline-none focus:border-[#246427] transition-colors placeholder:text-[#9E9E9E]"
                            placeholder="Add your summary findings for the admin..."
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                          />
                          <div className="flex justify-between items-center px-1">
                             <p className="text-[0.7rem] text-[#9E9E9E]">{wordCount} words recorded</p>
                             {wordCount >= 10 && <span className="text-[0.7rem] text-[#2E7D32] font-bold italic">Ready ✓</span>}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            className="flex-1 rounded-[10px] border-[1.5px] border-[#E0E7DC] py-[10px] text-[0.875rem] font-semibold text-[#616161] hover:bg-gray-50 transition-colors"
                            onClick={() => setDialogOpen(false)}
                          >
                            Close
                          </button>
                          <button
                            type="button"
                            disabled={!summary.trim() || isForwarding}
                            className="flex-[2] rounded-[10px] bg-[#246427] py-[10px] text-[0.875rem] font-semibold text-white hover:bg-[#1a4d1c] transition-all disabled:opacity-50"
                            onClick={forward}
                          >
                            {isForwarding ? 'Forwarding...' : 'Forward to Admin'}
                          </button>
                        </div>
                        {errorText && <p className="text-xs text-red-600 text-center font-medium mt-2">{errorText}</p>}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
};

export default FieldReports;
