import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext';

const FlaggedRecords = () => {
  useAuth();
  const [records, setRecords] = useState([]);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [remark, setRemark] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  const fetchRecords = async () => {
    const response = await api.get('/teamlead/attendance/flagged');
    const { data } = response.data;
    setRecords(data || []);
  };
  useEffect(() => {
    fetchRecords();
  }, []);
  useEffect(() => {
    const t = setInterval(fetchRecords, 30000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    if (activeFilter === 'ALL') return records;
    return records.filter((r) => (r.flagReasons || []).join(' ').toLowerCase().includes(activeFilter.toLowerCase()));
  }, [records, activeFilter]);

  const resolve = async (action) => {
    if (!selectedRecord || remark.trim().length < 10) return;
    setIsResolving(true);
    try {
      await api.patch(`/teamlead/attendance/flagged/${selectedRecord._id}/resolve`, { action, remark });
      setRecords((prev) => prev.filter((r) => r._id !== selectedRecord._id));
      setDialogOpen(false);
      setSelectedRecord(null);
      setRemark('');
      toast.success('Flagged record resolved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resolve');
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <>
      <div className="bg-transparent p-6">
        <div className="flex gap-2 mb-5 flex-wrap">
          {['ALL', 'Location mismatch', 'Face mismatch', 'Incomplete checkout'].map((f) => (
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
        <AnimatePresence>
          {filtered.map((record, index) => (
            <motion.div
              key={record._id}
              layout
              exit={{ opacity: 0, height: 0 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.04 }}
              className="bg-white rounded-xl border border-[#e8e0d0] border-l-4 border-l-red-400 p-5 mb-3 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 text-sm text-gray-800 font-semibold">
                  <span>{record.worker?.fullName}</span>
                  <span className="text-gray-300 font-normal">·</span>
                  <span className="text-gray-600 font-medium">{record.task?.title}</span>
                </div>
                
                <p className="text-xs text-gray-400 font-normal mt-1 flex items-center gap-2">
                  <span className="font-medium">Distance:</span>
                  <span>{record.distanceAtCheckIn != null ? `${record.distanceAtCheckIn}m` : '—'}</span>
                  <span className="text-gray-300">(threshold: {record.task?.allowedRadius || 0}m)</span>
                </p>

                <p className="text-xs font-medium text-[#791F1F] mt-2 max-w-[75%] leading-relaxed">
                  {(record.flagReasons || []).join(', ') || 'Flagged activity detected'}
                </p>
              </div>

              <div className="shrink-0 pt-3 md:pt-0 border-t md:border-t-0 flex justify-end">
                <button
                  type="button"
                  className="rounded-[10px] border-[1.5px] border-[#246427] bg-white px-4 py-2 text-xs font-semibold text-[#246427] hover:bg-[#E8F5E9] transition-colors whitespace-nowrap"
                  onClick={() => {
                    setSelectedRecord(record);
                    setDialogOpen(true);
                  }}
                >
                  Review
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {!filtered.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="w-10 h-10 text-[#2d6b2d] mb-3" />
            <p className="text-sm font-medium text-gray-400">No flagged records — all clear</p>
            <p className="text-xs text-gray-300 mt-1 font-normal">Nothing needs your review</p>
          </div>
        ) : null}
      </div>
      <AnimatePresence>
        {dialogOpen && selectedRecord ? (
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
                <p className="text-[#C0B87A] text-sm font-medium">Flagged record — {selectedRecord.worker?.fullName}</p>
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-[24px] space-y-4">
                <div className="rounded-[10px] bg-[#FFEBEE] border border-[#FFCDD2] p-4 text-sm">
                  <p className="font-semibold text-[#C62828] mb-1">Reason(s) for Flag:</p>
                  <p className="text-[#D32F2F]">
                    {(selectedRecord.flagReasons || []).join(', ') || 'Flagged activity detected'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[0.875rem] font-medium text-[#616161]">Action Remark</label>
                  <textarea
                    rows={3}
                    className="w-full border border-[#E0E7DC] rounded-[10px] px-3 py-2 text-sm text-[#212121] bg-white focus:outline-none focus:border-[#246427] transition-colors placeholder:text-[#9E9E9E]"
                    placeholder="Provide details about your decision..."
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
                    disabled={isResolving}
                    className="flex-[2] rounded-[10px] bg-[#246427] py-[10px] text-[0.875rem] font-semibold text-white hover:bg-[#1a4d1c] transition-colors disabled:opacity-50"
                    onClick={() => resolve('APPROVE')}
                  >
                    Mark Present
                  </button>
                  <button
                    type="button"
                    disabled={isResolving}
                    className="flex-[1.5] rounded-[10px] border-[1.5px] border-[#246427] bg-white py-[10px] text-[0.875rem] font-semibold text-[#246427] hover:bg-[#E8F5E9] transition-colors disabled:opacity-50"
                    onClick={() => resolve('REJECT')}
                  >
                    Reject Attendance
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

export default FlaggedRecords;
