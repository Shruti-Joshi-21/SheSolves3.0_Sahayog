import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext';

const AttendanceReview = () => {
  useAuth();
  const [attendanceData, setAttendanceData] = useState({
    grouped: [],
    summary: { present: 0, absent: 0, flagged: 0, pending: 0 },
  });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [expandedTask, setExpandedTask] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = async (date) => {
    setLoading(true);
    try {
      const response = await api.get(`/teamlead/attendance?date=${date}`);
      const { data } = response.data;
      setAttendanceData(data || { grouped: [], summary: {} });
    } finally {
      setLoading(false);
    }
  };

  const handleResolveEarly = async (id, action) => {
    try {
      await api.post(`/teamlead/attendance/${id}/resolve`, { action, remark: 'Early checkout approval' });
      fetchData(selectedDate);
    } catch (err) {
      alert('Failed to resolve early checkout');
    }
  };

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate]);
  useEffect(() => {
    const t = setInterval(() => fetchData(selectedDate), 30000);
    return () => clearInterval(t);
  }, [selectedDate]);

  const statusBadge = (s) =>
    s === 'FLAGGED'
      ? 'bg-[#fcebeb] text-[#791F1F]'
      : s === 'PENDING'
        ? 'bg-[#faeeda] text-[#633806]'
        : s === 'REJECTED'
          ? 'bg-[#fcebeb] text-[#791F1F]'
          : s === 'VERIFIED'
            ? 'bg-[#eaf3de] text-[#27500A]'
            : 'bg-gray-100 text-gray-500';

  return (
    <div className="bg-transparent  p-6">
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <div className="flex gap-2 items-center">
          <input
            type="date"
            className="border border-[#e8e0d0] rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-[#1a4a1a] transition-colors"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <button
            type="button"
            className="bg-white border border-[#e8e0d0] text-gray-600 text-xs font-normal px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
          >
            Today
          </button>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap mb-5">
        <span className="bg-[#eaf3de] text-[#27500A] text-sm font-normal px-4 py-1.5 rounded-full">
          {attendanceData.summary.present || 0} Present
        </span>
        <span className="bg-gray-100 text-gray-600 text-sm font-normal px-4 py-1.5 rounded-full">
          {attendanceData.summary.absent || 0} Absent
        </span>
        <span className="bg-[#fcebeb] text-[#791F1F] text-sm font-normal px-4 py-1.5 rounded-full">
          {attendanceData.summary.flagged || 0} Flagged
        </span>
        <span className="bg-[#faeeda] text-[#633806] text-sm font-normal px-4 py-1.5 rounded-full">
          {attendanceData.summary.pending || 0} Pending
        </span>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 w-full bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        attendanceData.grouped.map((g) => (
          <div key={g.task?._id} className="bg-white rounded-xl border border-[#e8e0d0] overflow-hidden mb-3">
            <button
              type="button"
              className="w-full px-5 py-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors text-left"
              onClick={() => setExpandedTask(expandedTask === g.task?._id ? '' : g.task?._id)}
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{g.task?.title}</p>
                <p className="text-xs text-gray-400 font-normal mt-0.5">{g.task?.locationName}</p>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${
                  expandedTask === g.task?._id ? 'rotate-180' : ''
                }`}
              />
            </button>
            {expandedTask === g.task?._id ? (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-[#e8e0d0]"
              >
                <div className="px-5 py-4 overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest text-gray-400 font-normal">
                        <th className="text-left pb-2 border-b border-[#e8e0d0] font-normal">Worker</th>
                        <th className="text-left pb-2 border-b border-[#e8e0d0] font-normal">Check-in</th>
                        <th className="text-left pb-2 border-b border-[#e8e0d0] font-normal">Check-out</th>
                        <th className="text-left pb-2 border-b border-[#e8e0d0] font-normal">Location</th>
                        <th className="text-left pb-2 border-b border-[#e8e0d0] font-normal">Face</th>
                        <th className="text-left pb-2 border-b border-[#e8e0d0] font-normal">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(g.records || []).map((r) => (
                        <tr key={r._id} className="text-sm text-gray-600 py-3 border-b border-[#e8e0d0] last:border-0">
                          <td className="py-3 font-normal">{r.worker?.fullName || '—'}</td>
                          <td className="py-3 font-normal">
                            {r.checkInTime
                              ? new Date(r.checkInTime).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td className="py-3 font-normal">
                            {r.checkOutTime
                              ? new Date(r.checkOutTime).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td className="py-3 font-normal">
                            {r.distanceAtCheckIn == null ? (
                              '—'
                            ) : r.distanceAtCheckIn <= (g.task?.allowedRadius || 0) ? (
                              <span className="bg-[#eaf3de] text-[#27500A] text-xs px-2 py-0.5 rounded-full font-medium inline-block">
                                Within radius
                              </span>
                            ) : (
                              <span className="bg-[#fcebeb] text-[#791F1F] text-xs px-2 py-0.5 rounded-full font-medium inline-block">
                                Out of range ({r.distanceAtCheckIn}m)
                              </span>
                            )}
                          </td>
                          <td className="py-3 font-normal">
                            {r.checkInFaceMatch == null ? (
                              '—'
                            ) : r.checkInFaceMatch ? (
                              <span className="bg-[#eaf3de] text-[#27500A] text-xs px-2 py-0.5 rounded-full font-medium">
                                Matched
                              </span>
                            ) : (
                              <span className="bg-[#fcebeb] text-[#791F1F] text-xs px-2 py-0.5 rounded-full font-medium">
                                Mismatch
                              </span>
                            )}
                          </td>
                          <td className="py-3 font-normal">
                            <div className="flex flex-col gap-1">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block w-fit ${statusBadge(r.status)}`}>
                                {r.status}
                              </span>
                              {r.isEarlyCheckout && (
                                <div className="mt-1 p-2 bg-amber-50/50 rounded-lg text-[10px] text-amber-800 border border-amber-100 flex flex-col gap-0.5 max-w-[180px]">
                                   <p className="font-semibold">Early: {r.earlyCheckoutMinutes >= 60 ? `${Math.floor(r.earlyCheckoutMinutes/60)}h ${r.earlyCheckoutMinutes%60}m` : `${r.earlyCheckoutMinutes}m`}</p>
                                   <p className="italic opacity-80 line-clamp-2">"{(r.earlyCheckoutReason || 'No reason').slice(0, 50)}..."</p>
                                   {r.tlApprovalStatus === 'PENDING' ? (
                                      <div className="flex gap-1.5 mt-1.5">
                                        <button 
                                          onClick={() => handleResolveEarly(r._id, 'APPROVE')}
                                          className="flex-1 border border-[#246427] text-[#246427] py-1 rounded font-bold hover:bg-[#F1F8E9] transition-colors"
                                        >
                                          Approve
                                        </button>
                                        <button 
                                          onClick={() => handleResolveEarly(r._id, 'REJECT')}
                                          className="flex-1 bg-[#F8AC3B] text-white py-1 rounded font-bold hover:opacity-90 transition-opacity"
                                        >
                                          Reject
                                        </button>
                                      </div>
                                   ) : (
                                     <p className="mt-1 font-bold uppercase tracking-tighter opacity-60">
                                       {r.tlApprovalStatus}
                                     </p>
                                   )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            ) : null}
          </div>
        ))
      )}
      {!loading && attendanceData.grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-medium text-gray-400">No attendance records for this date</p>
          <p className="text-xs text-gray-300 mt-1 font-normal">Pick another date or check back later</p>
        </div>
      ) : null}
    </div>
  );
};

export default AttendanceReview;
