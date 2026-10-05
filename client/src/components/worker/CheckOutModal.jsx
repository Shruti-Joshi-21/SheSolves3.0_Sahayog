import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  MapPin,
  Camera,
  ImagePlus,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import api from "../../utils/api";
import StepIndicator from './StepIndicator';

const STEPS = ['GPS Location', 'Face Capture', 'After Photo', 'Confirm'];

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function dataUrlToFile(dataUrl, filename) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: 'image/jpeg' });
}

export default function CheckOutModal({ isOpen, onClose, task, attendanceRecord, onSuccess }) {
  const [step, setStep] = useState(0);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsError, setGpsError] = useState('');
  const [gpsData, setGpsData] = useState(null);
  const [distanceM, setDistanceM] = useState(null);
  const [inRange, setInRange] = useState(true);

  const webcamRef = useRef(null);
  const fieldInputRef = useRef(null);
  const [camDenied, setCamDenied] = useState(false);
  const [facePreview, setFacePreview] = useState(null);
  const [faceImageFile, setFaceImageFile] = useState(null);

  const [fieldImageFile, setFieldImageFile] = useState(null);
  const [fieldPreviewUrl, setFieldPreviewUrl] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const [earlyReason, setEarlyReason] = useState("");
  const [showEarlyConfirmation, setShowEarlyConfirmation] = useState(false);

  useEffect(() => {
    if (isOpen && task?.endTime && !result) {
      const now = new Date();
      const [h, m] = task.endTime.split(':').map(Number);
      const buffer = task.checkOutBuffer || 15;
      const earlyEndMinutes = h * 60 + m - buffer;
      const earlyEnd = new Date();
      earlyEnd.setHours(Math.floor(earlyEndMinutes / 60), earlyEndMinutes % 60, 0, 0);

      if (now < earlyEnd) {
        setShowEarlyConfirmation(true);
      } else {
        setShowEarlyConfirmation(false);
      }
    }
  }, [isOpen, task, result]);

  useEffect(() => {
    if (!isOpen) {
      setStep(0);
      setGpsLoading(true);
      setGpsError('');
      setGpsData(null);
      setDistanceM(null);
      setInRange(true);
      setCamDenied(false);
      setFacePreview(null);
      setFaceImageFile(null);
      setFieldImageFile(null);
      setFieldPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setSubmitting(false);
      setResult(null);
    }
  }, [isOpen]);

  const captureGps = useCallback(() => {
    if (!isOpen || !task) return;
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setGpsData({ latitude, longitude });
        const d = getDistanceMeters(latitude, longitude, task.latitude, task.longitude);
        setDistanceM(Math.round(d));
        setInRange(d <= task.allowedRadius);
        setGpsLoading(false);
      },
      () => {
        setGpsError('Could not get location. Please enable GPS and try again.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, [isOpen, task]);

  useEffect(() => {
    if (isOpen && step === 0 && task) {
      captureGps();
    }
  }, [isOpen, step, task, captureGps]);

  const handleCaptureFace = async () => {
    const shot = webcamRef.current?.getScreenshot();
    if (!shot) return;
    setFacePreview(shot);
    const file = await dataUrlToFile(shot, 'face.jpg');
    setFaceImageFile(file);
  };

  const handleFieldFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFieldPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setFieldImageFile(file);
    e.target.value = '';
  };

  const performCheckOut = async () => {
    if (!attendanceRecord?._id || !gpsData || !faceImageFile || !fieldImageFile) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('attendanceId', String(attendanceRecord._id ?? ''));
      formData.append('latitude', String(gpsData.latitude));
      formData.append('longitude', String(gpsData.longitude));
      formData.append('faceImage', faceImageFile);
      formData.append('fieldImage', fieldImageFile);
      if (earlyReason) {
        formData.append('earlyCheckoutReason', earlyReason);
      }

      // Let axios set multipart boundary — never set Content-Type: multipart/form-data manually.
      const res = await api.post('/worker/checkout', formData);
      const data = res.data?.data ?? {};
      setResult({
        ...data,
        message: res.data?.message || data.message,
      });
      setShowEarlyConfirmation(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-out failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!attendanceRecord?._id || !gpsData || !faceImageFile || !fieldImageFile) return;
    performCheckOut();
  };

  const handleCloseResult = () => {
    if (result && onSuccess) onSuccess(result);
    onClose();
  };

  const existingFlags = attendanceRecord?.flagReasons?.length
    ? attendanceRecord.flagReasons
    : [];

  const overlay = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative mt-2 sm:mt-6 w-full max-w-lg rounded-[20px] bg-[#FFFFFF] p-4 sm:p-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.14)]"
            style={{ maxHeight: '92vh' }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            {showEarlyConfirmation ? (
              <div className="space-y-6 py-4">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="bg-amber-50 p-4 rounded-full">
                    <AlertTriangle className="h-10 w-10 text-amber-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 leading-tight px-4">
                    You are checking out early, attendance will be marked after approval by team lead
                  </h3>
                  <div className="w-full text-left space-y-2 px-2">
                    <label className="text-sm font-medium text-gray-700">Enter your reason of early checkout</label>
                    <textarea
                        className="w-full rounded-xl border border-gray-200 p-4 text-sm focus:ring-2 focus:ring-[#246427] focus:border-transparent transition-all h-32 resize-none"
                        placeholder="Please state why you are leaving before completion..."
                        value={earlyReason}
                        onChange={(e) => setEarlyReason(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="flex flex-col gap-3 px-2">
                  <button
                    type="button"
                    className="w-full rounded-[12px] bg-[#246427] py-4 text-[1rem] font-bold text-white shadow-[0_4px_14px_rgba(36,100,39,0.2)] hover:bg-[#1a4d1c] transition-all"
                    onClick={() => {
                        setShowEarlyConfirmation(false);
                        onClose();
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!earlyReason.trim()}
                    className="w-full rounded-[12px] border-2 border-[#246427] py-3 text-[0.95rem] font-bold text-[#246427] hover:bg-[#F1F8E9] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    onClick={() => setShowEarlyConfirmation(false)}
                  >
                    Proceed
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  aria-label="Close"
                  className="absolute right-[16px] top-[16px] rounded-lg p-1 text-[#616161] hover:text-[#246427] transition-colors z-10"
                  onClick={onClose}
                >
                  <X className="h-5 w-5" />
                </button>

                {(!task || !attendanceRecord) && (
                  <p className="text-center text-gray-600">Missing task or attendance record.</p>
                )}

                {task && attendanceRecord && result && (
                  <div className="space-y-6 pt-2 text-center">
                    {result.finalStatus === 'FLAGGED' ? (
                      <>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                          className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-amber-100"
                        >
                          <AlertTriangle className="h-12 w-12 text-amber-600" />
                        </motion.div>
                        <h3 className="text-xl font-bold text-amber-700">Checked Out with Flags</h3>
                        <ul className="space-y-2 text-left">
                          {(result.flagReasons || []).map((r, i) => (
                            <li key={`${i}-${r}`} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                              {r}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                          className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#005F02]"
                        >
                          <CheckCircle2 className="h-12 w-12 text-white" />
                        </motion.div>
                        <h3 className="text-xl font-bold text-[#005F02]">Attendance Verified!</h3>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p>
                            In:{' '}
                            {result.checkInTime
                              ? new Date(result.checkInTime).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              })
                              : '—'}
                          </p>
                          <p>
                            Out:{' '}
                            {result.checkOutTime
                              ? new Date(result.checkOutTime).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              })
                              : '—'}
                          </p>
                        </div>
                        <p className="text-gray-500">Great work today!</p>
                      </>
                    )}
                    <button
                      type="button"
                      className="w-full rounded-[10px] bg-[#246427] py-[10px] text-[0.875rem] font-semibold text-[#FFFFFF] hover:bg-[#1a4d1c] transition-colors"
                      onClick={handleCloseResult}
                    >
                      Close
                    </button>
                  </div>
                )}

            {task && attendanceRecord && !result && (
              <>
                <h2 className="bg-[#F1F8E9] border-b border-[#E0E7DC] px-4 sm:px-[24px] py-[16px] rounded-t-[20px] text-[1rem] font-semibold text-[#212121] -mx-4 sm:-mx-[24px] -mt-4 sm:-mt-[24px] mb-[24px] pr-12">Check Out</h2>
                <div className="mb-5 mt-3 overflow-x-auto">
                  <StepIndicator steps={STEPS} currentStep={step} />
                </div>

                <div className="max-h-[calc(90vh-12rem)] overflow-y-auto pr-1">
                  {step === 0 && (
                    <div className="space-y-4">
                      <h3 className="text-[0.9375rem] font-semibold text-[#212121]">Capturing Your Location</h3>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-[10px] bg-[#E8F5E9] px-3 py-1 text-xs font-semibold text-[#246427]">
                          {task.title}
                        </span>
                        <span className="rounded-[10px] bg-[#F9FBF7] px-3 py-1 text-xs text-[#616161] border border-[#E0E7DC]">
                          {task.locationName}
                        </span>
                      </div>
                      {gpsLoading && (
                        <div className="flex flex-col items-center py-8">
                          <div className="relative flex h-24 w-24 items-center justify-center">
                            {[0, 1, 2].map((i) => (
                              <motion.span
                                key={i}
                                className="absolute rounded-full border-2 border-[#246427]/30"
                                style={{ width: 48 + i * 28, height: 48 + i * 28 }}
                                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                                transition={{ repeat: Infinity, duration: 2.2, delay: i * 0.25 }}
                              />
                            ))}
                            <MapPin className="relative z-10 h-10 w-10 text-[#246427]" />
                          </div>
                          <p className="mt-4 text-sm text-[#616161]">Fetching GPS coordinates...</p>
                        </div>
                      )}
                      {!gpsLoading && gpsError && (
                        <div className="space-y-3">
                          <p className="text-sm text-[#C62828] bg-[#FFEBEE] p-3 rounded-[10px] border border-[#FFCDD2]">{gpsError}</p>
                          <button
                            type="button"
                            className="w-full rounded-[10px] bg-[#246427] py-[10px] text-[0.875rem] font-semibold text-[#FFFFFF] hover:bg-[#1a4d1c] transition-colors"
                            onClick={captureGps}
                          >
                            Retry
                          </button>
                        </div>
                      )}
                      {!gpsLoading && gpsData && !gpsError && (
                        <div className="space-y-4">
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex justify-center"
                          >
                            <CheckCircle2 className="h-14 w-14 text-[#246427]" />
                          </motion.div>
                          <p className="font-mono text-[0.875rem] text-[#616161] text-center">
                            Lat: {gpsData.latitude.toFixed(5)}, Lng: {gpsData.longitude.toFixed(5)}
                          </p>
                          {inRange ? (
                            <span className="inline-flex rounded-full bg-[#E8F5E9] px-[10px] py-[3px] text-[0.72rem] font-semibold text-[#246427] border border-[#A5D6A7]">
                              ✓ Within range ({distanceM}m)
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-[#FFF8E1] px-[10px] py-[3px] text-[0.72rem] font-semibold text-[#B07D00] border border-[#FFE082]">
                              ⚠ {distanceM}m from site (limit: {task.allowedRadius}m) — will be flagged
                            </span>
                          )}
                          <button
                            type="button"
                            className="w-full rounded-[10px] bg-[#246427] py-[10px] text-[0.875rem] font-semibold text-[#FFFFFF] hover:bg-[#1a4d1c] transition-colors"
                            onClick={() => setStep(1)}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {step === 1 && (
                    <div className="space-y-4">
                      <h3 className="text-[0.9375rem] font-semibold text-[#212121]">Verify Your Identity</h3>
                      <p className="text-[0.875rem] text-[#616161]">Look at the camera and click capture</p>
                      {camDenied ? (
                        <div className="flex flex-col items-center py-8 text-center bg-[#FFEBEE] rounded-[10px] p-4 border border-[#FFCDD2]">
                          <Camera className="mb-2 h-12 w-12 text-[#C62828]" />
                          <p className="text-sm text-[#C62828]">
                            Camera access denied. Please allow camera permissions.
                          </p>
                        </div>
                      ) : !facePreview ? (
                        <>
                          <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            mirrored
                            videoConstraints={{ facingMode: 'user', width: 1280, height: 720 }}
                            onUserMediaError={() => setCamDenied(true)}
                            className="aspect-[4/3] w-full rounded-[14px] bg-black object-cover"
                          />
                          <button
                            type="button"
                            className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#246427] py-[10px] text-[0.875rem] font-semibold text-[#FFFFFF] hover:bg-[#1a4d1c] transition-colors"
                            onClick={handleCaptureFace}
                          >
                            <Camera className="h-5 w-5" />
                            Capture
                          </button>
                        </>
                      ) : (
                        <div className="space-y-3">
                          <img
                            src={facePreview}
                            alt="Face capture"
                            className="aspect-[4/3] w-full rounded-[14px] border border-[#E0E7DC] object-cover"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="flex-1 rounded-[10px] border-[1.5px] border-[#246427] py-[10px] text-[0.875rem] font-semibold text-[#246427] bg-transparent hover:bg-[#F1F8E9] transition-colors"
                              onClick={() => {
                                setFacePreview(null);
                                setFaceImageFile(null);
                              }}
                            >
                              Retake
                            </button>
                            <button
                              type="button"
                              className="flex-1 rounded-[10px] bg-[#246427] py-[10px] text-[0.875rem] font-semibold text-[#FFFFFF] hover:bg-[#1a4d1c] transition-colors"
                              onClick={() => setStep(2)}
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-4">
                      <h3 className="text-[0.9375rem] font-semibold text-[#212121]">Upload After Photo</h3>
                      <p className="text-[0.875rem] text-[#616161]">
                        Take a photo of the field AFTER completing work
                      </p>
                      <input
                        ref={fieldInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleFieldFile}
                      />
                      {!fieldPreviewUrl ? (
                        <button
                          type="button"
                          onClick={() => fieldInputRef.current?.click()}
                          className="flex min-h-[200px] w-full flex-col items-center justify-center rounded-[14px] border border-dashed border-[#246427] bg-[#F9FBF7] transition-colors hover:bg-[#F1F8E9]"
                        >
                          <ImagePlus className="mb-2 h-14 w-14 text-[#246427]" />
                          <span className="text-[0.875rem] text-[#616161]">
                            Tap to capture or upload field photo
                          </span>
                        </button>
                      ) : (
                        <div className="relative">
                          <button
                            type="button"
                            className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 shadow"
                            onClick={() => {
                              setFieldPreviewUrl((prev) => {
                                if (prev) URL.revokeObjectURL(prev);
                                return null;
                              });
                              setFieldImageFile(null);
                            }}
                            aria-label="Remove photo"
                          >
                            <X className="h-4 w-4 text-[#C62828]" />
                          </button>
                          <img
                            src={fieldPreviewUrl}
                            alt="Field"
                            className="max-h-64 w-full rounded-[14px] object-cover border border-[#E0E7DC]"
                          />
                          <p className="mt-2 text-[0.875rem] text-[#616161]">
                            {fieldImageFile?.name} ({Math.round((fieldImageFile?.size || 0) / 1024)} KB)
                          </p>
                          <button
                            type="button"
                            className="mt-3 w-full rounded-[10px] bg-[#246427] py-[10px] text-[0.875rem] font-semibold text-[#FFFFFF] hover:bg-[#1a4d1c] transition-colors"
                            onClick={() => setStep(3)}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-4">
                      <h3 className="text-[0.9375rem] font-semibold text-[#212121]">Review & Check Out</h3>
                      <div className="rounded-[10px] bg-[#F9FBF7] p-[16px] mb-[16px] text-[0.875rem] space-y-2 border border-[#E0E7DC]">
                        <div className="flex justify-between gap-2">
                          <span className="text-[#616161]">Task</span>
                          <span className="font-medium text-[#212121] text-right">{task.title}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-[#616161]">Location</span>
                          <span className="text-[#212121] text-right">{task.locationName}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-[#616161]">Checked In At</span>
                          <span className="text-[#212121]">
                            {attendanceRecord.checkInTime
                              ? new Date(attendanceRecord.checkInTime).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              })
                              : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-[#616161]">Time</span>
                          <span className="text-[#212121]">
                            {new Date().toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2 items-center">
                          <span className="text-[#616161]">GPS</span>
                          {inRange ? (
                            <span className="rounded-full bg-[#E8F5E9] px-2 py-0.5 text-xs font-semibold text-[#246427] border border-[#A5D6A7]">
                              ✓ Within range ({distanceM}m)
                            </span>
                          ) : (
                            <span className="rounded-full bg-[#FFF8E1] px-2 py-0.5 text-xs font-semibold text-[#B07D00] border border-[#FFE082]">
                              ⚠ {distanceM}m — flagged
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between gap-2 items-center">
                          <span className="text-[#616161]">Face</span>
                          <span className="text-[#246427] font-semibold">Captured ✓</span>
                        </div>
                        <div className="flex justify-between gap-2 items-center">
                          <span className="text-[#616161]">Field Photo</span>
                          {fieldPreviewUrl && (
                            <img
                              src={fieldPreviewUrl}
                              alt=""
                              className="h-10 w-10 rounded-md object-cover"
                            />
                          )}
                        </div>
                      </div>
                      {existingFlags.length > 0 && (
                        <div className="rounded-[10px] border border-[#FFE082] bg-[#FFF8E1] p-3 text-[0.875rem] text-[#B07D00]">
                          <span className="font-semibold">Existing flags from check-in: </span>
                          {existingFlags.join(', ')}
                        </div>
                      )}
                      {!inRange && (
                        <div className="flex gap-2 rounded-[10px] border border-[#FFE082] bg-[#FFF8E1] p-3 text-[0.875rem] text-[#B07D00]">
                          <AlertTriangle className="h-5 w-5 shrink-0 text-[#B07D00]" />
                          <p>
                            Your location was flagged. Check-out will be submitted but team lead will be
                            notified.
                          </p>
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={submitting}
                        className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#C62828] py-[10px] text-[0.875rem] font-semibold text-[#FFFFFF] hover:bg-[#b71c1c] transition-colors disabled:opacity-60"
                        onClick={handleSubmit}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="h-6 w-6 animate-spin" />
                            Checking out...
                          </>
                        ) : (
                          'CHECK OUT'
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {step > 0 && !result && (
                  <button
                    type="button"
                    className="mt-4 w-full text-[0.875rem] text-[#616161] hover:text-[#246427] transition-colors bg-transparent border-none text-center block"
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                  >
                    Back
                  </button>
                )}
              </>
            )}
            </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
}
