import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Coffee, Thermometer, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import api from "../../utils/api";

function localISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Calendar-only math (avoids DST / local midnight mismatches with <input type="date">). */
function parseYMDParts(str) {
  if (!str || typeof str !== 'string') return null;
  const head = str.split('T')[0];
  const [y, m, d] = head.split('-').map((n) => parseInt(n, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function calendarDaysInclusive(fromStr, toStr) {
  const a = parseYMDParts(fromStr);
  const b = parseYMDParts(toStr);
  if (!a || !b) return 0;
  const fromUtc = Date.UTC(a.y, a.m - 1, a.d);
  const toUtc = Date.UTC(b.y, b.m - 1, b.d);
  if (toUtc < fromUtc) return 0;
  return Math.round((toUtc - fromUtc) / 86400000) + 1;
}

/** Compare YYYY-MM-DD to today's local calendar date (same convention as input min). */
function isFromDateInPast(fromDateStr) {
  if (!fromDateStr) return false;
  const parts = parseYMDParts(fromDateStr);
  if (!parts) return false;
  return fromDateStr.split('T')[0] < localISODate();
}

const TYPES = [
  { value: 'CASUAL', label: 'Casual', Icon: Coffee },
  { value: 'SICK', label: 'Sick', Icon: Thermometer },
  { value: 'EMERGENCY', label: 'Emergency', Icon: AlertTriangle },
];

export default function LeaveRequestModal({ isOpen, onClose, remainingDays = 0, onSuccess }) {
  const [formData, setFormData] = useState({
    leaveType: 'CASUAL',
    fromDate: '',
    toDate: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setFormData({ leaveType: 'CASUAL', fromDate: '', toDate: '', reason: '' });
      setSubmitting(false);
    }
  }, [isOpen]);

  const durationDays = useMemo(
    () => calendarDaysInclusive(formData.fromDate, formData.toDate),
    [formData.fromDate, formData.toDate]
  );

  const todayMin = localISODate();
  const fromPast = isFromDateInPast(formData.fromDate);
  const trimmedReason = formData.reason.trim();
  const fieldsEmpty =
    !formData.fromDate || !formData.toDate || !formData.leaveType || trimmedReason.length === 0;
  const reasonTooShort = trimmedReason.length < 10;
  const remainingNum = Number(remainingDays);
  const remainingSafe = Number.isFinite(remainingNum) ? Math.max(0, remainingNum) : 0;
  const overBalance = durationDays > remainingSafe;
  const submitDisabled =
    fieldsEmpty || reasonTooShort || submitting || fromPast || durationDays === 0;

  const disabledHint = submitting
    ? ''
    : fromPast
      ? 'Start date cannot be in the past.'
      : durationDays === 0 && formData.fromDate && formData.toDate
        ? 'End date must be on or after the start date.'
        : durationDays === 0
          ? 'Choose start and end dates.'
          : fieldsEmpty
            ? 'Fill in all fields.'
            : reasonTooShort
              ? `Reason needs at least 10 characters (${trimmedReason.length}/10).`
              : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitDisabled) return;
    setSubmitting(true);
    try {
      const res = await api.post('/worker/leave', {
        fromDate: formData.fromDate,
        toDate: formData.toDate,
        reason: trimmedReason,
        leaveType: formData.leaveType,
      });
      if (res.data?.success) {
        onSuccess();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const remainingColorClass =
    remainingSafe > 3 ? 'text-[#246427]' : remainingSafe >= 1 ? 'text-[#B07D00]' : 'text-[#C62828]';

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-center bg-black/35 backdrop-blur-sm px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-modal-title"
            className="relative mt-20 h-max w-full max-w-md rounded-[20px] bg-[#FFFFFF] p-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.14)]"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#F1F8E9] border-b border-[#E0E7DC] px-[24px] py-[16px] rounded-t-[20px] flex items-start justify-between gap-2 -mx-[24px] -mt-[24px] mb-[24px]">
              <div>
                <h2 id="leave-modal-title" className="text-[1rem] font-semibold text-[#212121]">
                  Request Leave
                </h2>
                <p className={`mt-1 text-[0.875rem] font-medium ${remainingColorClass}`}>
                  {remainingSafe} days remaining
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-[#616161] hover:text-[#246427] transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-[0.875rem] font-medium text-[#212121]">Leave Type</label>
                <div className="flex gap-2">
                  {TYPES.map(({ value, label, Icon }) => {
                    const selected = formData.leaveType === value;
                    const isEmergency = value === 'EMERGENCY';
                    const btnClass = selected
                      ? isEmergency
                        ? 'bg-[#C62828] text-white'
                        : 'bg-[#246427] text-white'
                      : 'bg-[#F9FBF7] text-[#616161] border border-[#E0E7DC] hover:bg-[#F1F8E9]';
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, leaveType: value }))}
                        className={`flex flex-1 flex-col items-center gap-1 rounded-[10px] px-2 py-2 text-[0.8rem] font-medium transition-colors ${btnClass}`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 ${selected ? 'text-white' : isEmergency ? 'text-[#C62828]' : 'text-[#616161]'}`}
                        />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="leave-from" className="mb-1 block text-[0.875rem] font-medium text-[#212121]">
                  From Date
                </label>
                <input
                  id="leave-from"
                  type="date"
                  min={todayMin}
                  value={formData.fromDate}
                  onChange={(e) => setFormData((p) => ({ ...p, fromDate: e.target.value, toDate: p.toDate && p.toDate < e.target.value ? e.target.value : p.toDate }))}
                  className="w-full rounded-[10px] border border-[#E0E7DC] bg-[#FFFFFF] px-3 py-2 text-[0.875rem] focus:outline-none focus:ring-1 focus:ring-[#246427] transition-shadow"
                />
              </div>

              <div>
                <label htmlFor="leave-to" className="mb-1 block text-[0.875rem] font-medium text-[#212121]">
                  To Date
                </label>
                <input
                  id="leave-to"
                  type="date"
                  min={formData.fromDate || todayMin}
                  value={formData.toDate}
                  onChange={(e) => setFormData((p) => ({ ...p, toDate: e.target.value }))}
                  className="w-full rounded-[10px] border border-[#E0E7DC] bg-[#FFFFFF] px-3 py-2 text-[0.875rem] focus:outline-none focus:ring-1 focus:ring-[#246427] transition-shadow"
                />
              </div>

              <AnimatePresence mode="wait">
                {formData.fromDate && formData.toDate && durationDays > 0 && (
                  <motion.div
                    key={`${durationDays}-${overBalance}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className={`mx-auto mt-1 max-w-full rounded-[10px] px-4 py-2 text-center text-sm font-medium ${
                      overBalance ? 'bg-[#FFF8E1] text-[#B07D00] border border-[#FFE082]' : 'bg-[#E8F5E9] text-[#246427] border border-[#A5D6A7]'
                    }`}
                  >
                    {overBalance ? (
                      <>
                        <span className="block font-semibold">Includes time beyond paid balance</span>
                        <span className="mt-1 block text-xs font-normal opacity-90">
                          {durationDays === 1
                            ? '1 day requested'
                            : `${durationDays} days requested`}{' '}
                          ({remainingSafe === 0
                            ? 'none left in your paid allowance'
                            : `${remainingSafe} paid day${remainingSafe === 1 ? '' : 's'} left`}). You can still
                          submit — your team lead is notified and may treat the extra as unpaid leave.
                        </span>
                      </>
                    ) : (
                      `${durationDays === 1 ? '1 day' : `${durationDays} days`} selected (within paid balance)`
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label htmlFor="leave-reason" className="mb-1 block text-[0.875rem] font-medium text-[#212121]">
                  Reason
                </label>
                <p className="mb-1 text-[0.75rem] text-[#616161]">Minimum 10 characters</p>
                <textarea
                  id="leave-reason"
                  rows={3}
                  maxLength={200}
                  placeholder="Briefly describe your reason..."
                  value={formData.reason}
                  onChange={(e) => setFormData((p) => ({ ...p, reason: e.target.value }))}
                  className="w-full rounded-[10px] border border-[#E0E7DC] bg-[#FFFFFF] px-3 py-2 text-[0.875rem] focus:outline-none focus:ring-1 focus:ring-[#246427] transition-shadow"
                />
                <p className="mt-1 text-right text-[0.75rem] text-[#616161]">{formData.reason.length}/200</p>
              </div>

              <button
                type="submit"
                disabled={submitDisabled}
                className={`w-full rounded-[10px] py-[10px] text-[0.875rem] font-semibold text-[#FFFFFF] transition-opacity ${
                  submitDisabled ? 'cursor-not-allowed opacity-50 bg-[#246427]' : 'bg-[#246427] hover:bg-[#1a4d1c]'
                }`}
              >
                {submitting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  'Submit Leave Request'
                )}
              </button>
              {submitDisabled && disabledHint ? (
                <p className="mt-2 text-center text-[0.75rem] text-[#616161]">{disabledHint}</p>
              ) : null}
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
