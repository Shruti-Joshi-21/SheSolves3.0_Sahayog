import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Calendar, Clock, Radio, User, Users } from 'lucide-react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext';

function badgeForStatus(s) {
  return s === 'CANCELLED'
    ? 'bg-gray-100 text-gray-500'
    : s === 'FLAGGED'
      ? 'bg-[#fcebeb] text-[#791F1F]'
      : s === 'PENDING'
        ? 'bg-[#faeeda] text-[#633806]'
        : s === 'COMPLETED' || s === 'VERIFIED' || s === 'ACTIVE'
          ? 'bg-[#eaf3de] text-[#27500A]'
          : 'bg-[#eaf3de] text-[#27500A]';
}

function initials(name) {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function TaskDetail() {
  useAuth();
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/teamlead/tasks/${taskId}`);
        const data = response.data?.data;
        if (!cancelled) setTask(data ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load task');
          setTask(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (taskId) run();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/teamlead/tasks');
  };

  const workers = Array.isArray(task?.assignedWorkers) ? task.assignedWorkers : [];

  return (
    <div className="bg-transparent  p-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>


        {loading ? (
          <div className="space-y-4 max-w-3xl">
            <div className="h-8 w-2/3 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-40 w-full bg-white border border-[#e8e0d0] rounded-xl animate-pulse" />
            <div className="h-32 w-full bg-white border border-[#e8e0d0] rounded-xl animate-pulse" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-[#e8e0d0] p-8 max-w-lg text-center">
            <p className="text-sm text-red-600 font-normal mb-4">{error}</p>
            <button
              type="button"
              onClick={goBack}
              className="bg-[#1a4a1a] hover:bg-[#2d6b2d] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Go back
            </button>
          </div>
        ) : task ? (
          <div className="max-w-3xl space-y-4">
            <div className="bg-white rounded-xl border border-[#e8e0d0] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">

                <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${badgeForStatus(task.status)}`}>
                  {task.status}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#e8e0d0] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-[#1a4a1a] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#1a4a1a]/70" />
                Location
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-400 font-normal">Location name</dt>
                  <dd className="text-gray-800 font-medium mt-0.5">{task.locationName ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400 font-normal">Coordinates</dt>
                  <dd className="text-gray-800 font-mono text-xs mt-0.5">
                    {task.latitude != null && task.longitude != null
                      ? `${task.latitude}, ${task.longitude}`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400 font-normal flex items-center gap-1">
                    <Radio className="w-3 h-3" />
                    Allowed radius (m)
                  </dt>
                  <dd className="text-gray-800 font-medium mt-0.5">{task.allowedRadius ?? '—'}</dd>
                </div>
              </dl>
            </div>

            <div className="bg-white rounded-xl border border-[#e8e0d0] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-[#1a4a1a] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#1a4a1a]/70" />
                Schedule
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-400 font-normal">Date</dt>
                  <dd className="text-gray-800 font-medium mt-0.5">
                    {task.date ? new Date(task.date).toLocaleDateString(undefined, { dateStyle: 'long' }) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400 font-normal flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Window
                  </dt>
                  <dd className="text-gray-800 font-medium mt-0.5">
                    {task.startTime && task.endTime ? `${task.startTime} – ${task.endTime}` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400 font-normal">Check-in buffer (min)</dt>
                  <dd className="text-gray-800 font-medium mt-0.5">{task.checkInBuffer ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400 font-normal">Check-out buffer (min)</dt>
                  <dd className="text-gray-800 font-medium mt-0.5">{task.checkOutBuffer ?? '—'}</dd>
                </div>
              </dl>
            </div>

            <div className="bg-white rounded-xl border border-[#e8e0d0] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-[#1a4a1a] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#1a4a1a]/70" />
                Assigned workers
              </h2>
              {workers.length === 0 ? (
                <p className="text-sm text-gray-400">No workers assigned</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {workers.map((w) => (
                    <div
                      key={w._id}
                      className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-[#e8e0d0] bg-transparent/80"
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a4a1a] text-[10px] font-semibold text-white"
                        title={w.fullName || w.username}
                      >
                        {initials(w.fullName || w.username || '')}
                      </span>
                      <span className="text-sm font-medium text-gray-800 truncate max-w-[160px]">
                        {w.fullName || w.username || 'Worker'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-[#e8e0d0] p-5 space-y-2">
              <h2 className="text-sm font-semibold text-[#1a4a1a] flex items-center gap-2">
                <User className="w-4 h-4 text-[#1a4a1a]/70" />
                Created by
              </h2>
              <p className="text-sm text-gray-800 font-medium">
                {task.createdBy?.fullName ?? '—'}
              </p>
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}

