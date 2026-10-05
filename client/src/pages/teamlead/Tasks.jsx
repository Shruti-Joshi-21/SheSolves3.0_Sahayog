import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext';

const Tasks = () => {
  useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    const run = async () => {
      try {
        const response = await api.get('/teamlead/tasks');
        const { data } = response.data;
        setTasks(data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch tasks');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const filtered = useMemo(() => (filter === 'ALL' ? tasks : tasks.filter((t) => t.status === filter)), [tasks, filter]);

  const onStatus = async (taskId, status) => {
    try {
      const response = await api.patch(`/teamlead/tasks/${taskId}/status`, { status });
      const { data } = response.data;
      setTasks((prev) => prev.map((t) => (t._id === taskId ? data : t)));
      toast.success('Task status updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update task');
    }
  };

  const badgeForStatus = (s) =>
    s === 'CANCELLED'
      ? 'bg-gray-100 text-gray-500'
      : s === 'FLAGGED'
        ? 'bg-[#fcebeb] text-[#791F1F]'
        : s === 'PENDING'
          ? 'bg-[#faeeda] text-[#633806]'
          : s === 'COMPLETED' || s === 'VERIFIED' || s === 'ACTIVE'
            ? 'bg-[#eaf3de] text-[#27500A]'
            : 'bg-[#eaf3de] text-[#27500A]';

  return (
    <div className="bg-transparent  p-6">
      <div className="flex gap-2 mb-4 flex-wrap">
        {['ALL', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              filter === f
                ? 'bg-[#1a4a1a] text-white text-sm font-medium px-4 py-1.5 rounded-lg'
                : 'bg-white border border-[#e8e0d0] text-gray-500 text-sm font-normal px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors'
            }
          >
            {f === 'ALL' ? 'All' : f[0] + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm font-normal text-red-600 mb-3">{error}</p> : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading
          ? [1, 2, 3].map((i) => <div key={i} className="h-20 w-full bg-gray-200 rounded-xl animate-pulse" />)
          : filtered.map((task, index) => (
              <motion.div
                key={task._id}
                className="bg-white rounded-xl border border-[#e8e0d0] p-5"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.04 }}
              >
                <div className="flex justify-between items-start gap-2">
                  <h2 className="text-base font-medium text-gray-800">{task.title}</h2>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${badgeForStatus(task.status)}`}>
                    {task.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 font-normal mt-0.5">{task.workType}</p>
                <p className="text-sm text-gray-500 font-normal flex items-center gap-1.5 mt-1">{task.locationName}</p>
                <p className="text-sm text-gray-500 font-normal flex items-center gap-1.5 mt-1">
                  {new Date(task.date).toLocaleDateString()} · {task.startTime}–{task.endTime}
                </p>
                <p className="text-sm text-gray-500 font-normal flex items-center gap-1.5 mt-1">
                  {task.allowedRadius}m radius · {task.assignedWorkers?.length || 0} workers assigned
                </p>
                <div className="flex justify-between items-center mt-4">
                  <Link to={`/teamlead/tasks/${task._id}`} className="text-xs text-[#1a4a1a] hover:underline font-normal">
                    View details
                  </Link>
                  <select
                    className="border border-[#e8e0d0] text-xs rounded-lg px-2 py-1 text-gray-600 bg-white focus:outline-none"
                    value={task.status}
                    onChange={(e) => onStatus(task._id, e.target.value)}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </motion.div>
            ))}
      </div>
      {!loading && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardList className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-400">No tasks created yet</p>
          <p className="text-xs text-gray-300 mt-1 font-normal">Try adjusting filters or create a task</p>
        </div>
      ) : null}
    </div>
  );
};

export default Tasks;
