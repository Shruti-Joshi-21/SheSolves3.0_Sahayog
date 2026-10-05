import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  Plus,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Clock,
  CalendarDays,
  FileText,
  User,
  Loader2,
} from 'lucide-react';
import api from '../../utils/api';
import LeaveRequestModal from '../../components/worker/LeaveRequestModal';
import DeleteConfirmationModal from '../../components/shared/DeleteConfirmationModal';

function formatRelativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
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

function formatDateRange(fromIso, toIso) {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const d1 = from.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const d2 = to.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${d1} → ${d2}`;
}

function leaveSpanDays(fromIso, toIso) {
  return Math.ceil((new Date(toIso) - new Date(fromIso)) / (1000 * 60 * 60 * 24)) + 1;
}

function truncate(s, n) {
  if (!s) return '';
  const t = String(s);
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}


function statusPillClass(status) {
  switch (status) {
    case 'APPROVED':
      return 'border border-[#A5D6A7] bg-[#E8F5E9] text-[#246427]';
    case 'REJECTED':
      return 'border border-[#EF9A9A] bg-[#FFEBEE] text-[#C62828]';
    case 'PENDING':
    default:
      return 'border border-[#FFE082]/60 bg-[#FFF8E1]/60 text-[#B07D00] backdrop-blur-sm';
  }
}

export default function LeavePage() {
  const location = useLocation();
  const [leaveData, setLeaveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [selectedLeaveForCancel, setSelectedLeaveForCancel] = useState(null);

  const fetchLeaveData = useCallback(async () => {
    try {
      const res = await api.get('/worker/leave');
      const data = res.data?.data;
      if (data) setLeaveData(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load leave data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaveData();
  }, [fetchLeaveData]);

  useEffect(() => {
    if (location.state?.openModal) {
      setShowModal(true);
    }
  }, [location.state]);

  const handleCancel = async (leaveId) => {
    setCancellingId(leaveId);
    try {
      await api.delete(`/worker/leave/${leaveId}`);
      toast.success('Leave request cancelled');
      await fetchLeaveData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not cancel request');
    } finally {
      setCancellingId(null);
    }
  };

  const leaves = leaveData?.leaves ?? [];
  const balance = leaveData?.balance ?? {
    total: 12,
    used: 0,
    remaining: 12,
    pending: 0,
  };
  const { total, used, remaining, pending } = balance;
  const usedPct = total > 0 ? Math.min(100, (used / total) * 100) : 0;

  const remainingValueClass =
    remaining >= 6 ? 'text-[#246427]' : remaining >= 3 ? 'text-[#B07D00]' : 'text-[#C62828]';
  const usedValueClass = used > 0 ? 'text-[#B07D00]' : 'text-[#616161]';
  const pendingValueClass = pending > 0 ? 'text-[#0277BD]' : 'text-[#616161]';

  const balanceCards = [
    {
      key: 'total',
      icon: Calendar,
      iconColor: '#246427',
      value: total,
      label: 'Days Per Year',
      sub: 'Annual entitlement',
      valueClass: 'text-[#212121]',
      cardClass: '',
    },
    {
      key: 'used',
      icon: CheckCircle2,
      iconColor: '#d97706',
      value: used,
      label: 'Days Used',
      sub: null,
      valueClass: usedValueClass,
      cardClass: '',
    },
    {
      key: 'rem',
      icon: TrendingUp,
      iconColor: remaining >= 3 ? '#246427' : '#C62828',
      value: remaining,
      label: 'Days Remaining',
      sub: null,
      valueClass: remainingValueClass,
      cardClass: remaining === 0 ? 'bg-[#FFEBEE] border-none' : '',
    },
    {
      key: 'pend',
      icon: Clock,
      iconColor: '#2563eb',
      value: pending,
      label: 'Awaiting Approval',
      sub: null,
      valueClass: pendingValueClass,
      cardClass: '',
    },
  ];

  return (
    <motion.div
      className="space-y-8 bg-transparent -mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 pt-4 md:pt-8 pb-10 min-h-full rounded-b-[20px]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >



        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {loading
            ? [0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-[20px] bg-[#FFFFFF] border border-[#E0E7DC]"
                />
              ))
            : balanceCards.map((c, index) => (
                <motion.div
                  key={c.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 * index }}
                  className={`rounded-[20px] bg-[#FFFFFF] border border-[#E0E7DC] p-5 shadow-[0_4px_12px_rgba(0,0,0,0.05)] flex flex-col gap-2 ${c.cardClass}`}
                >
                  <div className="flex items-center gap-3">
                    <c.icon className="h-[22px] w-[22px] text-[#246427]" strokeWidth={2.5} />
                    <p className="text-[1.25rem] lg:text-[1.5rem] font-bold text-[#212121] leading-tight truncate">
                      {c.value}
                    </p>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-[0.75rem] text-[#616161] truncate line-clamp-1">{c.label}</p>
                    {c.sub && <p className="mt-0.5 text-[0.7rem] text-[#9E9E9E] truncate line-clamp-1">{c.sub}</p>}
                  </div>
                </motion.div>
              ))}
        </div>

        {!loading && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#E0E7DC]">
              <motion.div
                className="h-full rounded-full bg-[#246427]"
                initial={{ width: 0 }}
                animate={{ width: `${usedPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <p className="mt-1 text-right text-[0.75rem] text-[#616161]">
              {used} of {total} days used
            </p>
          </div>
        )}

        <div>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-[#212121]">Leave History</h2>
              <span className="rounded-full bg-[#E8F5E9] px-2 py-0.5 text-[0.75rem] text-[#246427]">
                {leaves.length} requests
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center justify-center gap-2 rounded-[12px] bg-[#246427] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#1a4d1c] transition-all w-full sm:w-auto"
            >
              Create Request
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-[14px] bg-[#FFFFFF] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E0E7DC]" />
              ))}
            </div>
          ) : leaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[20px] bg-[#FFFFFF] py-16 shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-[#E0E7DC]">
              <Calendar className="mb-4 h-48 w-48 text-[#E0E7DC]" strokeWidth={1} />
              <p className="font-medium text-[#616161]">No leave requests yet</p>
              <p className="mt-1 text-[0.875rem] text-[#9E9E9E]">Click &apos;Request Leave&apos; to apply</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {leaves.map((leave, index) => {
                const lt = leave.leaveType || 'CASUAL';
                const days = leaveSpanDays(leave.fromDate, leave.toDate);
                return (
                  <motion.li
                    key={leave._id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.04 * index }}
                    className="relative rounded-[20px] bg-[#FFFFFF] p-6 shadow-[var(--shadow-card)] border border-[#E0E7DC]"
                  >
                    <div className="sm:absolute sm:top-4 sm:right-6 flex flex-row sm:flex-col items-center gap-2 min-w-[100px] mb-4 sm:mb-0 justify-between sm:justify-start">
                      <span
                        className={`rounded-full px-4 py-1.5 text-[0.7rem] font-bold text-center sm:w-full shadow-sm ${statusPillClass(leave.status)}`}
                      >
                        {leave.status}
                      </span>
                      {leave.status === 'PENDING' && (
                        <button
                          type="button"
                          disabled={cancellingId === leave._id}
                          onClick={() => setSelectedLeaveForCancel(leave._id)}
                          className="text-[0.7rem] font-bold text-[#C62828] transition-colors hover:text-[#b71c1c] text-center px-2 py-1 rounded-lg hover:bg-red-50"
                        >
                          {cancellingId === leave._id ? (
                            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                          ) : (
                            'Cancel'
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:pr-[120px]">
                      <div className="flex w-full shrink-0 flex-col items-center sm:w-20 pt-1">
                        <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-[#616161] text-center">
                          {lt}
                        </p>
                        <p className="mt-2 text-[0.75rem] font-medium text-[#616161]">
                          {days} day{days !== 1 ? 's' : ''}
                        </p>
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex items-center gap-2.5 text-[1rem] font-bold text-[#212121]">
                          <CalendarDays className="h-5 w-5 shrink-0 text-[#246427]" />
                          {formatDateRange(leave.fromDate, leave.toDate)}
                        </div>
                        
                        <div className="flex items-start gap-2.5 text-[0.9375rem] text-[#616161] leading-relaxed">
                          <FileText className="mt-1 h-4 w-4 shrink-0 text-[#9E9E9E]" />
                          <span className="min-w-0">{truncate(leave.reason, 120)}</span>
                        </div>

                        {leave.exceedsEntitlement && (leave.excessUnpaidDays ?? 0) > 0 && (
                          <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-100 mt-2">
                            <p className="text-[0.75rem] font-semibold text-[#B07D00]">
                              Includes {leave.excessUnpaidDays} unpaid/extra day
                              {leave.excessUnpaidDays !== 1 ? 's' : ''} — management notified.
                            </p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-4 pt-1">
                          <span className="text-[0.75rem] text-[#9E9E9E]">
                            Applied {formatRelativeTime(leave.createdAt)}
                          </span>
                          
                          {(leave.status === 'APPROVED' || leave.status === 'REJECTED') && (
                            <div className="flex items-center gap-2">
                                {leave.reviewedBy?.fullName && (
                                  <div className="flex items-center gap-1.5 text-[0.75rem] text-[#616161] font-medium">
                                    <User className="h-3.5 w-3.5 shrink-0 text-[#246427]" />
                                    {leave.reviewedBy.fullName}
                                  </div>
                                )}
                                {leave.reviewNote && (
                                  <span className="text-[0.75rem] italic text-[#9E9E9E] border-l border-[#E0E7DC] pl-2">
                                    "{truncate(leave.reviewNote, 60)}"
                                  </span>
                                )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>


      <LeaveRequestModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        remainingDays={leaveData?.balance?.remaining ?? 0}
        onSuccess={() => {
          setShowModal(false);
          fetchLeaveData();
          toast.success('Leave request submitted!');
        }}
      />

      <DeleteConfirmationModal
        isOpen={!!selectedLeaveForCancel}
        onClose={() => setSelectedLeaveForCancel(null)}
        onConfirm={() => {
          handleCancel(selectedLeaveForCancel);
          setSelectedLeaveForCancel(null);
        }}
        loading={!!cancellingId}
        title="Cancel Leave Request"
        message="Are you sure you want to cancel this leave request? You will have to reapply again to approve your leave."
      />
    </motion.div>
  );
}
