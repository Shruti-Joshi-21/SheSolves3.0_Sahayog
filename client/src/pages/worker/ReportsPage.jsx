import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  Plus,
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import api from '../../utils/api';
import ReportDetailDrawer from '../../components/worker/ReportDetailDrawer';
import SubmitReportModal from '../../components/worker/SubmitReportModal';

function snippet(text, n) {
  if (!text) return '';
  const s = String(text);
  return s.length <= n ? s : `${s.slice(0, n)}...`;
}

function statusPillClass(status) {
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

function dateParts(iso) {
  if (!iso) return { day: '—', month: '', year: '' };
  const d = new Date(iso);
  return {
    day: String(d.getDate()),
    month: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
    year: String(d.getFullYear()),
  };
}

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

export default function ReportsPage() {
  const location = useLocation();
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/worker/reports', { params });
      const data = res.data?.data;
      if (data) {
        setReports(data.reports ?? []);
        setStats(
          data.stats ?? { total: 0, submitted: 0, approved: 0, rejected: 0 }
        );
        setPagination(
          data.pagination ?? { total: 0, page: 1, limit: 10, totalPages: 0 }
        );
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    if (location.state?.openModal) {
      setShowModal(true);
    }
  }, [location.state]);

  const openDetail = async (report) => {
    if (!report?._id) return;
    setDetailOpen(true);
    setDetailLoading(true);
    setSelectedReport(null);
    try {
      const res = await api.get(`/worker/reports/${report._id}`);
      const data = res.data?.data?.report;
      setSelectedReport(data || null);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not load report');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedReport(null);
    setDetailLoading(false);
  };

  const onFilterClick = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const rejectedCount = stats.rejected ?? 0;

  return (
    <motion.div
      className="space-y-6 pb-10 bg-transparent -mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 pt-4 md:pt-8 min-h-full rounded-b-[20px]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >


      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Total',
            value: stats.total,
            Icon: ClipboardList,
            iconClass: 'text-[#246427]',
            valueClass: 'text-[#212121]',
            cardClass: 'bg-[#FFFFFF]',
          },
          {
            label: 'Submitted',
            value: stats.submitted,
            Icon: Clock,
            iconClass: 'text-[#246427]',
            cardClass: 'bg-[#FFFFFF]',
          },
          {
            label: 'Approved',
            value: stats.approved,
            Icon: CheckCircle2,
            iconClass: 'text-[#246427]',
            cardClass: 'bg-[#FFFFFF]',
          },
          {
            label: 'Rejected',
            value: stats.rejected,
            Icon: XCircle,
            iconClass: 'text-[#C62828]',
            cardClass: rejectedCount > 0 ? 'bg-[#FFEBEE] border-none' : 'bg-[#FFFFFF]',
          },
        ].map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 * index }}
            className={`rounded-[20px] p-5 shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-[#E0E7DC] flex flex-col gap-2 ${card.cardClass}`}
          >
            <div className="flex items-center gap-3">
              <card.Icon className={`h-[22px] w-[22px] ${card.iconClass}`} strokeWidth={2.5} />
              <p className="text-[1.25rem] lg:text-[1.5rem] font-bold leading-tight text-[#212121]">
                {card.value}
              </p>
            </div>
            <div className="flex flex-col">
              <p className="text-[0.75rem] text-[#616161] truncate line-clamp-1">{card.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f, index) => (
            <motion.button
              key={f.label}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.03 * index }}
              onClick={() => onFilterClick(f.value)}
              className={`rounded-[10px] px-4 py-2 text-[0.875rem] font-medium transition ${
                statusFilter === f.value
                  ? 'bg-[#246427] text-white shadow-sm'
                  : 'border border-[#E0E7DC] bg-[#FFFFFF] text-[#616161] hover:border-[#246427]/40 hover:bg-[#F1F8E9]'
              }`}
            >
              {f.label}
            </motion.button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#246427] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a4d1c] sm:ml-auto"
        >
          <Plus className="h-4 w-4" />
          Submit Report
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-[14px] bg-[#FFFFFF] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E0E7DC]" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] bg-[#FFFFFF] py-16 shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-[#E0E7DC]">
          <FileText className="mb-3 h-16 w-16 text-[#E0E7DC]" strokeWidth={1.25} />
          <p className="text-[#616161]">No reports found</p>
          {statusFilter ? (
            <p className="mt-1 text-[0.875rem] text-[#9E9E9E]">Try selecting All</p>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((report, index) => {
            const { day, month, year } = dateParts(report.createdAt);
            const task = report.task;
            const imgCount = Array.isArray(report.images) ? report.images.length : 0;
            return (
              <motion.li
                key={report._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.04 * index }}
                whileHover={{ scale: 1.01 }}
                className="cursor-pointer rounded-[14px] bg-[#FFFFFF] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E0E7DC] transition-all hover:border-[#246427]/30 hover:shadow-md"
              >
                <button
                  type="button"
                  className="flex w-full gap-4 text-left"
                  onClick={() => openDetail(report)}
                >
                  <div className="flex w-14 flex-none flex-col items-center border-r border-[#E0E7DC] pr-3">
                    <span className="text-[1.5rem] font-bold text-[#212121]">{day}</span>
                    <span className="text-[0.65rem] uppercase text-[#616161]">{month}</span>
                    <span className="text-[0.65rem] text-[#9E9E9E]">{year}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#212121]">{task?.title || 'Report'}</p>
                    {task?.workType ? (
                      <span className="mt-1 inline-block rounded-[10px] bg-[#E8F5E9] border border-[#A5D6A7] px-2 py-0.5 text-[0.65rem] text-[#246427]">
                        {task.workType}
                      </span>
                    ) : null}
                    <p className="mt-1 text-[0.875rem] text-[#616161]">{snippet(report.description, 80)}</p>
                    {report.reviewNote ? (
                      <p className="mt-1 text-[0.75rem] italic text-[#616161]">
                        Review note: {snippet(report.reviewNote, 120)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-none flex-col items-end gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${statusPillClass(
                        report.status
                      )}`}
                    >
                      {report.status}
                    </span>
                    {imgCount > 0 ? (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <ImageIcon className="h-3 w-3" />
                        <span>
                          {imgCount} photo{imgCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}

      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-[10px] border border-[#E0E7DC] bg-[#FFFFFF] px-4 py-2 text-[0.875rem] text-[#616161] hover:bg-[#F1F8E9] disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-[0.875rem] text-[#616161]">
            Page {page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-[10px] border border-[#E0E7DC] bg-[#FFFFFF] px-4 py-2 text-[0.875rem] text-[#616161] hover:bg-[#F1F8E9] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      <ReportDetailDrawer
        isOpen={detailOpen}
        onClose={closeDetail}
        report={selectedReport}
        loading={detailLoading}
      />

      <SubmitReportModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchReports}
      />
    </motion.div>
  );
}
