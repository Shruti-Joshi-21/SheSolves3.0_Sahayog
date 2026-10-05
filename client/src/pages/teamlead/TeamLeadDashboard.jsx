import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { CheckCircle2, X, CheckSquare, Users, AlertTriangle, Calendar, ClipboardList, UserCheck } from 'lucide-react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext';

const TeamLeadDashboard = () => {
  const navigate = useNavigate();
  useAuth();
  const [stats, setStats] = useState({});
  const [todaysTasks, setTodaysTasks] = useState([]);
  const [workerAttendance, setWorkerAttendance] = useState([]);
  const [flaggedRecords, setFlaggedRecords] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFlag, setSelectedFlag] = useState(null);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [remark, setRemark] = useState('');

  const fetchDashboard = async () => {
    try {
      const response = await api.get('/teamlead/dashboard-summary');
      const { data } = response.data;
      setStats(data.stats || {});
      setTodaysTasks(data.todaysTasks || []);
      setWorkerAttendance(data.workerAttendance || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const refresh = setInterval(fetchDashboard, 30000);
    return () => {
      clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    const fetchFallback = async () => {
      try {
        const [flagsRes, leavesRes] = await Promise.all([
          api.get('/teamlead/attendance/flagged'),
          api.get('/teamlead/leave-requests?status=PENDING'),
        ]);
        setFlaggedRecords(flagsRes.data.data || []);
        setLeaveRequests(leavesRes.data.data || []);
      } catch {
        setFlaggedRecords([]);
        setLeaveRequests([]);
      }
    };
    fetchFallback();
  }, []);

  const handleResolveFlag = async (action) => {
    if (!selectedFlag || remark.trim().length < 10) return;
    try {
      await api.patch(`/teamlead/attendance/flagged/${selectedFlag._id}/resolve`, { action, remark });
      setFlaggedRecords((prev) => prev.filter((r) => r._id !== selectedFlag._id));
      setSelectedFlag(null);
      setRemark('');
      toast.success('Record updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    }
  };

  const handleLeave = async (status) => {
    if (!selectedLeave) return;
    try {
      await api.patch(`/teamlead/leave-requests/${selectedLeave._id}`, { status, remark });
      setLeaveRequests((prev) => prev.filter((l) => l._id !== selectedLeave._id));
      setSelectedLeave(null);
      setRemark('');
      toast.success('Leave request updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    }
  };

  const taskStatusBadge = (status) =>
    status === 'FLAGGED'
      ? 'bg-[#fcebeb] text-[#791F1F]'
      : status === 'PENDING'
        ? 'bg-[#faeeda] text-[#633806]'
        : status === 'CANCELLED'
          ? 'bg-gray-100 text-gray-500'
          : 'bg-[#eaf3de] text-[#27500A]';

  return (
    <>
      <div className="bg-transparent  p-6 space-y-6">
        {error ? <p className="text-sm font-normal text-red-600">{error}</p> : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active tasks', value: stats.activeTasks || 0, Icon: ClipboardList },
            { label: 'Workers present', value: `${stats.presentToday || 0}/${stats.totalWorkers || 0}`, Icon: UserCheck },
            { label: 'Flagged today', value: stats.flaggedToday || 0, sub: 'Needs review', Icon: AlertTriangle },
            { label: 'Pending leaves', value: stats.pendingLeaves || 0, sub: 'Awaiting action', Icon: Calendar },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              className="bg-white rounded-[20px] border border-[#E0E7DC] p-5 shadow-[0_4px_12px_rgba(0,0,0,0.05)] flex flex-col gap-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.04 }}
            >
              <div className="flex items-center gap-3">
                <item.Icon className="w-[22px] h-[22px] text-[#246427]" strokeWidth={2.5} />
                <p className="text-[1.125rem] lg:text-[1.375rem] font-bold text-[#212121] leading-tight truncate">
                  {item.value}
                </p>
              </div>
              <div className="flex flex-col">
                <p className="text-[0.75rem] text-[#616161] truncate line-clamp-1">{item.label}</p>
                {item.sub ? (
                  <p className="text-[0.65rem] text-[#9E9E9E] mt-0.5 truncate font-normal line-clamp-1">{item.sub}</p>
                ) : null}
              </div>
            </motion.div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-3 bg-white rounded-xl border border-[#e8e0d0] p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-medium text-gray-800">Today&apos;s tasks</h2>
              <Link className="text-xs text-[#1a4a1a] hover:underline font-normal" to="/teamlead/tasks">
                View all
              </Link>
            </div>
            {(loading ? [] : todaysTasks.slice(0, 5)).map((task) => (
              <div key={task._id} className="py-3 border-b border-[#e8e0d0] last:border-0">
                <div className="flex justify-between items-center gap-2">
                  <p className="text-sm font-normal text-gray-800">{task.title}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${taskStatusBadge(task.status)}`}>
                    {task.status}
                  </span>
                </div>
                <p className="text-xs font-normal text-gray-400 mt-1">
                  {task.startTime}–{task.endTime} · {task.totalWorkers} workers · {task.allowedRadius} m
                </p>
              </div>
            ))}
            {!loading && !todaysTasks.length ? (
              <p className="text-sm font-normal text-gray-400">No tasks scheduled today</p>
            ) : null}
          </div>
          <div className="md:col-span-2 bg-white rounded-xl border border-[#e8e0d0] p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-medium text-gray-800">Worker attendance</h2>
              <Link className="text-xs text-[#1a4a1a] hover:underline font-normal" to="/teamlead/attendance">
                Live view
              </Link>
            </div>
            {workerAttendance.slice(0, 6).map((worker) => (
              <div key={worker._id} className="flex items-center gap-3 py-2.5 border-b border-[#e8e0d0] last:border-0">
                <div className="w-7 h-7 rounded-full bg-[#eaf3de] text-[#27500A] text-xs font-medium flex items-center justify-center shrink-0">
                  {worker.initials || 'NA'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-normal text-gray-800 truncate">{worker.name}</p>
                  {worker.topWorkType ? (
                    <span className="inline-block mt-0.5 bg-gray-100 text-gray-600 text-xs font-normal px-2 py-0.5 rounded-full">
                      {worker.topWorkType}
                    </span>
                  ) : null}
                </div>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${worker.checkedIn ? 'bg-[#27500A]' : 'bg-gray-300'}`}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-[#e8e0d0] p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-medium text-gray-800">Flagged records</h2>
              <Link className="text-xs text-[#1a4a1a] hover:underline font-normal" to="/teamlead/flags">
                Review all
              </Link>
            </div>
            {flaggedRecords.slice(0, 3).map((f) => (
              <div
                key={f._id}
                className="flex justify-between items-center gap-2 py-3 border-l-4 border-l-red-400 border border-[#e8e0d0] border-l pl-3 pr-3 rounded-r-lg mb-2 bg-white"
              >
                <p className="text-sm font-normal text-gray-600">
                  {f.worker?.fullName || 'Worker'} · {f.task?.title || 'Task'}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedFlag(f)}
                  className="rounded-[10px] border-[1.5px] border-[#246427] bg-white px-4 py-2 text-xs font-semibold text-[#246427] hover:bg-[#E8F5E9] transition-colors shrink-0"
                >
                  Review
                </button>
              </div>
            ))}
            {!flaggedRecords.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 className="w-10 h-10 text-[#2d6b2d] mb-3" />
                <p className="text-sm font-medium text-gray-400">No flags today</p>
                <p className="text-xs text-gray-300 mt-1 font-normal">You&apos;re all caught up</p>
              </div>
            ) : null}
          </div>
          <div className="bg-white rounded-xl border border-[#e8e0d0] p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-medium text-gray-800">Leave requests</h2>
              <Link className="text-xs text-[#1a4a1a] hover:underline font-normal" to="/teamlead/leave">
                View all
              </Link>
            </div>
            {leaveRequests.slice(0, 2).map((leave) => (
              <div key={leave._id} className="flex justify-between items-center py-3 border-b border-[#e8e0d0] last:border-0">
                <p className="text-sm font-normal text-gray-600">
                  {leave.worker?.fullName} · {new Date(leave.fromDate).toLocaleDateString()} —{' '}
                  {new Date(leave.toDate).toLocaleDateString()}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLeave(leave);
                    setRemark('');
                  }}
                  className="rounded-[10px] border-[1.5px] border-[#246427] bg-white px-4 py-2 text-xs font-semibold text-[#246427] hover:bg-[#E8F5E9] transition-colors"
                >
                  Review
                </button>
              </div>
            ))}
            {!leaveRequests.length ? (
              <p className="text-sm font-normal text-gray-400">No pending leave requests</p>
            ) : null}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {selectedFlag ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedFlag(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              className="relative mt-8 w-full max-w-lg rounded-[20px] bg-[#FFFFFF] p-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.14)]"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="absolute right-[16px] top-[16px] rounded-lg p-1 text-[#616161] hover:text-[#246427] transition-colors z-10"
                onClick={() => setSelectedFlag(null)}
              >
                <X className="h-5 w-5" />
              </button>

              <h2 className="bg-[#F1F8E9] border-b border-[#E0E7DC] px-[24px] py-[16px] rounded-t-[20px] text-[1rem] font-semibold text-[#212121] -mx-[24px] -mt-[24px] mb-[24px] pr-12">
                Flagged Record
              </h2>

              <div className="space-y-4">
                <div className="rounded-[10px] bg-[#FFEBEE] border border-[#FFCDD2] p-4">
                  <p className="text-sm font-semibold text-[#C62828] mb-1">Reason(s) for Flag:</p>
                  <p className="text-sm text-[#D32F2F]">
                    {(selectedFlag.flagReasons || []).join(', ') || 'Flagged activity detected'}
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
                    onClick={() => setSelectedFlag(null)}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    className="flex-[2] rounded-[10px] bg-[#246427] py-[10px] text-[0.875rem] font-semibold text-white hover:bg-[#1a4d1c] transition-colors"
                    onClick={() => handleResolveFlag('APPROVE')}
                  >
                    Mark Present
                  </button>
                  <button
                    type="button"
                    className="flex-[1.5] rounded-[10px] border-[1.5px] border-[#246427] bg-white py-[10px] text-[0.875rem] font-semibold text-[#246427] hover:bg-[#E8F5E9] transition-colors"
                    onClick={() => handleResolveFlag('REJECT')}
                  >
                    Reject Record
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {selectedLeave ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedLeave(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              className="relative mt-8 w-full max-w-lg rounded-[20px] bg-[#FFFFFF] p-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.14)]"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="absolute right-[16px] top-[16px] rounded-lg p-1 text-[#616161] hover:text-[#246427] transition-colors z-10"
                onClick={() => setSelectedLeave(null)}
              >
                <X className="h-5 w-5" />
              </button>

              <h2 className="bg-[#F1F8E9] border-b border-[#E0E7DC] px-[24px] py-[16px] rounded-t-[20px] text-[1rem] font-semibold text-[#212121] -mx-[24px] -mt-[24px] mb-[24px] pr-12">
                Leave Request Decision
              </h2>

              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-[12px] bg-[#F9FBF7] border border-[#E0E7DC]">
                  <div className="h-12 w-12 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#246427] font-bold text-lg">
                    {selectedLeave.worker?.fullName?.charAt(0) || 'W'}
                  </div>
                  <div>
                    <p className="text-[1rem] font-bold text-[#212121]">{selectedLeave.worker?.fullName || 'Worker'}</p>
                    <p className="text-sm text-[#616161]">
                      {new Date(selectedLeave.startDate).toLocaleDateString()} — {new Date(selectedLeave.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[0.875rem] font-medium text-[#616161]">Remarks (optional)</label>
                  <textarea
                    rows={2}
                    className="w-full border border-[#E0E7DC] rounded-[10px] px-3 py-2 text-sm text-[#212121] bg-white focus:outline-none focus:border-[#246427] transition-colors placeholder:text-[#9E9E9E]"
                    placeholder="Add more context to your decision..."
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    type="button"
                    className="flex-1 rounded-[10px] border-[1.5px] border-[#E0E7DC] py-[10px] text-[0.875rem] font-semibold text-[#616161] hover:bg-gray-50 transition-colors"
                    onClick={() => setSelectedLeave(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="flex-[2] rounded-[10px] bg-[#246427] py-[10px] text-[0.875rem] font-semibold text-white hover:bg-[#1a4d1c] transition-colors"
                    onClick={() => handleLeave('APPROVED')}
                  >
                    Approve Leave
                  </button>
                  <button
                    type="button"
                    className="flex-[1.5] rounded-[10px] border-[1.5px] border-[#246427] bg-white py-[10px] text-[0.875rem] font-semibold text-[#246427] hover:bg-[#E8F5E9] transition-colors"
                    onClick={() => handleLeave('REJECTED')}
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

export default TeamLeadDashboard;
