import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../utils/api';

const MAX_DESC = 500;
const MAX_IMAGES = 5;

export default function SubmitReportModal({ isOpen, onClose, onSuccess, initialTaskId = '', initialAttendanceId = '' }) {
  const [formData, setFormData] = useState({
    taskId: '',
    attendanceId: '',
    description: '',
    summary: '',
    images: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [dynamicFieldValues, setDynamicFieldValues] = useState({});

  const revokePreviews = useCallback((urls) => {
    urls.forEach((u) => {
      if (u && u.startsWith('blob:')) URL.revokeObjectURL(u);
    });
  }, []);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await api.get('/worker/tasks');
      const list = res.data?.data?.tasks ?? [];
      setTasks(list);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load tasks');
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadTasks();
    setFormData({
      taskId: initialTaskId || '',
      attendanceId: initialAttendanceId || '',
      description: '',
      summary: '',
      images: [],
    });
    setImagePreviews([]);
    setDynamicFieldValues({});
  }, [isOpen, loadTasks]);

  useEffect(() => {
    return () => {
      revokePreviews(imagePreviews);
    };
  }, [imagePreviews, revokePreviews]);

  const handleClose = () => {
    revokePreviews(imagePreviews);
    setImagePreviews([]);
    onClose();
  };

  const onPickFiles = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const room = MAX_IMAGES - formData.images.length;
    const next = files.slice(0, Math.max(0, room));
    const newUrls = next.map((f) => URL.createObjectURL(f));
    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, ...next].slice(0, MAX_IMAGES),
    }));
    setImagePreviews((prev) => [...prev, ...newUrls].slice(0, MAX_IMAGES));
  };

  const removeImage = (index) => {
    setImagePreviews((prev) => {
      const u = prev[index];
      if (u && u.startsWith('blob:')) URL.revokeObjectURL(u);
      return prev.filter((_, i) => i !== index);
    });
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.taskId || formData.description.trim().length < 20 || submitting) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('taskId', formData.taskId);
      fd.append('description', formData.description.trim());
      fd.append('summary', formData.summary.trim());
      const reportFieldResponses = selectedTaskFields.map((field) => ({
        fieldName: field.fieldName,
        fieldType: field.fieldType,
        value: dynamicFieldValues[field.fieldName] ?? '',
      }));
      fd.append('reportFieldResponses', JSON.stringify(reportFieldResponses));
      if (formData.attendanceId) fd.append('attendanceId', formData.attendanceId);
      formData.images.forEach((img) => fd.append('images', img));
      await api.post('/worker/reports', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Report submitted!');
      revokePreviews(imagePreviews);
      setImagePreviews([]);
      setFormData({
        taskId: '',
        attendanceId: '',
        description: '',
        summary: '',
        images: [],
      });
      setDynamicFieldValues({});
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const descLen = formData.description.length;
  const selectedTask = tasks.find((t) => t._id === formData.taskId) || null;
  const selectedTaskFields = Array.isArray(selectedTask?.reportFields) ? selectedTask.reportFields : [];
  const canSubmit =
    Boolean(formData.taskId) && formData.description.trim().length >= 20 && !submitting;

  const overlay = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-[min(100%,28rem)] max-h-[90vh] overflow-y-auto rounded-[20px] bg-[#FFFFFF] p-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.14)]"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            <div className="bg-[#F1F8E9] border-b border-[#E0E7DC] px-[24px] py-[16px] rounded-t-[20px] flex items-center justify-between -mx-[24px] -mt-[24px] mb-[24px]">
              <h2 className="text-[1rem] font-semibold text-[#212121]">Submit Report</h2>
              <button
                type="button"
                aria-label="Close"
                className="rounded-lg p-1.5 text-[#616161] hover:text-[#246427] transition-colors"
                onClick={handleClose}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!initialTaskId ? (
                <div>
                  <label htmlFor="report-task" className="mb-1 block text-[0.875rem] font-medium text-[#212121]">
                    Task
                  </label>
                  <select
                    id="report-task"
                    value={formData.taskId}
                    onChange={(ev) => {
                      setFormData((p) => ({ ...p, taskId: ev.target.value }));
                      setDynamicFieldValues({});
                    }}
                    disabled={tasksLoading}
                    className="w-full rounded-[10px] border border-[#E0E7DC] bg-[#FFFFFF] px-3 py-2 text-[0.875rem] text-[#212121] focus:outline-none focus:ring-1 focus:ring-[#246427] transition-shadow"
                  >
                    <option value="">{tasksLoading ? 'Loading tasks…' : 'Select a task'}</option>
                    {tasks.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="rounded-[12px] bg-[#F9FBF7] p-3 border border-[#E0E7DC]">
                  <p className="text-[0.75rem] text-[#616161] font-medium uppercase tracking-wider">Related Task</p>
                  <p className="text-[1rem] font-bold text-[#246427]">{selectedTask?.title || 'Loading task...'}</p>
                </div>
              )}

              {selectedTaskFields.map((field, idx) => {
                const fieldName = String(field?.fieldName || '').trim();
                const fieldType = String(field?.fieldType || '').trim();
                if (!fieldName) return null;

                if (fieldType === 'Number') {
                  return (
                    <div key={`${fieldName}-${idx}`}>
                      <label className="mb-1 block text-[0.875rem] font-medium text-[#212121]">{fieldName}</label>
                      <input
                        type="number"
                        value={dynamicFieldValues[fieldName] ?? ''}
                        onChange={(ev) =>
                          setDynamicFieldValues((prev) => ({ ...prev, [fieldName]: ev.target.value }))
                        }
                        className="w-full rounded-[10px] border border-[#E0E7DC] bg-[#FFFFFF] px-3 py-2 text-[0.875rem] text-[#212121] focus:outline-none focus:ring-1 focus:ring-[#246427] transition-shadow"
                        placeholder={`Enter ${fieldName.toLowerCase()}`}
                      />
                    </div>
                  );
                }

                if (fieldType === 'Yes/No') {
                  return (
                    <div key={`${fieldName}-${idx}`}>
                      <label className="mb-1 block text-[0.875rem] font-medium text-[#212121]">{fieldName}</label>
                      <select
                        value={dynamicFieldValues[fieldName] ?? ''}
                        onChange={(ev) =>
                          setDynamicFieldValues((prev) => ({ ...prev, [fieldName]: ev.target.value }))
                        }
                        className="w-full rounded-[10px] border border-[#E0E7DC] bg-[#FFFFFF] px-3 py-2 text-[0.875rem] text-[#212121] focus:outline-none focus:ring-1 focus:ring-[#246427] transition-shadow"
                      >
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                  );
                }

                if (fieldType === 'Date') {
                  return (
                    <div key={`${fieldName}-${idx}`}>
                      <label className="mb-1 block text-[0.875rem] font-medium text-[#212121]">{fieldName}</label>
                      <input
                        type="date"
                        value={dynamicFieldValues[fieldName] ?? ''}
                        onChange={(ev) =>
                          setDynamicFieldValues((prev) => ({ ...prev, [fieldName]: ev.target.value }))
                        }
                        className="w-full rounded-[10px] border border-[#E0E7DC] bg-[#FFFFFF] px-3 py-2 text-[0.875rem] text-[#212121] focus:outline-none focus:ring-1 focus:ring-[#246427] transition-shadow"
                      />
                    </div>
                  );
                }

                if (fieldType === 'Image') {
                  return (
                    <div key={`${fieldName}-${idx}`}>
                      <label className="mb-1 block text-[0.875rem] font-medium text-[#212121]">{fieldName}</label>
                      <input
                        type="text"
                        value={dynamicFieldValues[fieldName] ?? ''}
                        onChange={(ev) =>
                          setDynamicFieldValues((prev) => ({ ...prev, [fieldName]: ev.target.value }))
                        }
                        className="w-full rounded-[10px] border border-[#E0E7DC] bg-[#FFFFFF] px-3 py-2 text-[0.875rem] text-[#212121] focus:outline-none focus:ring-1 focus:ring-[#246427] transition-shadow"
                        placeholder="Optional note for uploaded field photo"
                      />
                    </div>
                  );
                }

                return (
                  <div key={`${fieldName}-${idx}`}>
                    <label className="mb-1 block text-[0.875rem] font-medium text-[#212121]">{fieldName}</label>
                    <textarea
                      rows={2}
                      value={dynamicFieldValues[fieldName] ?? ''}
                      onChange={(ev) =>
                        setDynamicFieldValues((prev) => ({ ...prev, [fieldName]: ev.target.value }))
                      }
                      className="w-full rounded-[10px] border border-[#E0E7DC] bg-[#FFFFFF] px-3 py-2 text-[0.875rem] text-[#212121] focus:outline-none focus:ring-1 focus:ring-[#246427] transition-shadow"
                      placeholder={`Enter ${fieldName.toLowerCase()}`}
                    />
                  </div>
                );
              })}

              <div>
                <label htmlFor="report-desc" className="mb-1 block text-[0.875rem] font-medium text-[#212121]">
                  Description
                </label>
                <textarea
                  id="report-desc"
                  rows={4}
                  maxLength={MAX_DESC}
                  value={formData.description}
                  onChange={(ev) => setFormData((p) => ({ ...p, description: ev.target.value }))}
                  className="w-full rounded-[10px] border border-[#E0E7DC] bg-[#FFFFFF] px-3 py-2 text-[0.875rem] text-[#212121] focus:outline-none focus:ring-1 focus:ring-[#246427] transition-shadow"
                  placeholder="Describe your field work (min 20 characters)"
                />
                <p className="mt-1 text-right text-[0.75rem] text-[#616161]">
                  {descLen}/{MAX_DESC}
                </p>
              </div>

              <div>
                <label htmlFor="report-summary" className="mb-1 block text-[0.875rem] font-medium text-[#212121]">
                  Summary (optional)
                </label>
                <textarea
                  id="report-summary"
                  rows={2}
                  value={formData.summary}
                  onChange={(ev) => setFormData((p) => ({ ...p, summary: ev.target.value }))}
                  className="w-full rounded-[10px] border border-[#E0E7DC] bg-[#FFFFFF] px-3 py-2 text-[0.875rem] text-[#212121] focus:outline-none focus:ring-1 focus:ring-[#246427] transition-shadow"
                  placeholder="Brief summary…"
                />
              </div>

              <div>
                <p className="text-[0.875rem] font-medium text-[#212121]">Field Photos (optional)</p>
                <p className="text-[0.75rem] text-[#616161]">Up to 5 images</p>
                <label
                  className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-[14px] border border-dashed border-[#246427] bg-[#F9FBF7] px-4 py-8 text-center text-[0.875rem] text-[#616161] transition hover:bg-[#F1F8E9] ${
                    formData.images.length >= MAX_IMAGES ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  <span>Click to upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={formData.images.length >= MAX_IMAGES}
                    onChange={onPickFiles}
                  />
                </label>
                {imagePreviews.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {imagePreviews.map((url, i) => (
                      <div key={url} className="relative">
                        <img src={url} alt="" className="h-28 w-full rounded-[14px] object-cover border border-[#E0E7DC]" />
                        <button
                          type="button"
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                          aria-label="Remove image"
                          onClick={() => removeImage(i)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#246427] py-[10px] text-[0.875rem] font-semibold text-[#FFFFFF] transition-colors enabled:hover:bg-[#1a4d1c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  'Submit Report'
                )}
              </button>
            </form>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
}
