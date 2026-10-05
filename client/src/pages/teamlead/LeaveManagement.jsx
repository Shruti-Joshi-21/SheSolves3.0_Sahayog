import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, X } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext';

const LeaveManagement = () => {
  useAuth();
  const [leaves, setLeaves] = useState([]);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [remark, setRemark] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchLeaves = async () => {
    const query = activeFilter === 'ALL' ? '' : `?status=${activeFilter}`;
    const response = await api.get(`/teamlead/leave-requests${query}`);
    const { data } = response.data;
    setLeaves(data || []);
  };

  useEffect(() => {
    fetchLeaves();
  }, [activeFilter]);
  useEffect(() => {
    const t = setInterval(fetchLeaves, 60000);
    return () => clearInterval(t);
  }, [activeFilter]);

  const list = useMemo(() => leaves, [leaves]);

  const updateLeave = async (status) => {
    if (!selectedLeave) return;
    setIsUpdating(true);
    try {
      const response = await api.patch(`/teamlead/leave-requests/${selectedLeave._id}`, { status, remark });
      const { data } = response.data;
      setLeaves((prev) => prev.map((l) => (l._id === data._id ? data : l)));
      toast.success('Leave request updated');
      setDialogOpen(false);
      setSelectedLeave(null);
      setRemark('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update leave');
    } finally {
      setIsUpdating(false);
    }
  };

  const statusBadge = (s) =>
    s === 'PENDING'
      ? 'bg-[#faeeda] text-[#633806]'
      : s === 'APPROVED'
        ? 'bg-[#eaf3de] text-[#27500A]'
        : s === 'REJECTED'
          ? 'bg-[#fcebeb] text-[#791F1F]'
          : 'bg-gray-100 text-gray-500';

  const initials = (name) => {
    const parts = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length) return parts[0].slice(0, 2).toUpperCase();
    return '—';
  };

  return (
    <>
      <div className="bg-transparent p-6">
        <div className="flex gap-2 mb-5 flex-wrap">
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((f) => (
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
              {f === 'ALL' ? 'All' : f[0] + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {list.map((leave, index) => (
            <motion.div
              key={leave._id}
              className="bg-white rounded-xl border border-[#e8e0d0] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.04 }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-[#faeeda] text-[#633806] text-[10px] font-bold flex items-center justify-center shrink-0">
                    {initials(leave.workerName || leave.worker?.fullName)}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-800 truncate">
                    {leave.workerName || leave.worker?.fullName}
                  </h3>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusBadge(leave.status)}`}>
                    {leave.status}
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                    {new Date(leave.fromDate).toLocaleDateString()} — {new Date(leave.toDate).toLocaleDateString()}
                  </span>
                  {leave.totalDays != null && (
                    <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full font-normal">
                      {leave.totalDays}d
                    </span>
                  )}
                </div>
                
                <p className="text-[13px] text-gray-600 font-normal leading-snug line-clamp-2">
                  <span className="text-gray-400 font-medium mr-1.5">Reason:</span>
                  {leave.reason || 'Not specified'}
                </p>
                
                {leave.remarks && (
                  <p className="text-[11px] text-gray-400 font-normal mt-1 border-l-2 border-gray-100 pl-2 italic truncate">
                    &ldquo;{leave.remarks}&rdquo;
                  </p>
                )}
              </div>

              {leave.status === 'PENDING' && (
                <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
                  <button
                    type="button"
                    className="flex-1 md:flex-none rounded-[10px] bg-[#246427] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1a4d1c] transition-colors"
                    onClick={() => {
                      setSelectedLeave(leave);
                      setDialogOpen(true);
                      setRemark('');
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="flex-1 md:flex-none rounded-[10px] border-[1.5px] border-[#246427] bg-white px-5 py-2 text-xs font-semibold text-[#246427] hover:bg-[#E8F5E9] transition-colors"
                    onClick={() => {
                      setSelectedLeave(leave);
                      setDialogOpen(true);
                      setRemark('');
                    }}
                  >
                    Reject
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
        {!list.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-400">No leave requests found</p>
            <p className="text-xs text-gray-300 mt-1 font-normal">Try another filter</p>
          </div>
        ) : null}
      </div>
      
      <AnimatePresence>
        {dialogOpen && selectedLeave ? (
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
                  Leave decision — {selectedLeave.workerName || selectedLeave.worker?.fullName}
                </p>
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-[24px] space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[0.875rem] font-medium text-[#616161]">Decision Result Remark (optional)</label>
                  <textarea
                    rows={3}
                    className="w-full border border-[#E0E7DC] rounded-[10px] px-3 py-2 text-sm text-[#212121] bg-white focus:outline-none focus:border-[#246427] transition-colors placeholder:text-[#9E9E9E]"
                    placeholder="Add a remark for the worker regarding your decision..."
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    type="button"
                    className="flex-1 rounded-[10px] border-[1.5px] border-[#E0E7DC] py-[10px] text-[0.875rem] font-semibold text-[#616161] hover:bg-gray-50 transition-colors"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isUpdating}
                    className="flex-[2] rounded-[10px] bg-[#246427] py-[10px] text-[0.875rem] font-semibold text-white hover:bg-[#1a4d1c] transition-colors disabled:opacity-50"
                    onClick={() => updateLeave('APPROVED')}
                  >
                    Confirm Approval
                  </button>
                  <button
                    type="button"
                    disabled={isUpdating}
                    className="flex-[1.5] rounded-[10px] border-[1.5px] border-[#246427] bg-white py-[10px] text-[0.875rem] font-semibold text-[#246427] hover:bg-[#E8F5E9] transition-colors disabled:opacity-50"
                    onClick={() => updateLeave('REJECTED')}
                  >
                    Reject Leave
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
};

export default LeaveManagement;
