import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Eye, Hand, RotateCcw, ScanFace } from 'lucide-react';

// Random action makes a printed photo or replayed video useless (Challenge 3 — liveness)
export const LIVENESS_ACTIONS = [
  { label: 'Blink twice', icon: Eye },
  { label: 'Turn your head left', icon: RotateCcw },
  { label: 'Raise your hand', icon: Hand },
];
const COUNTDOWN_SECONDS = 3;

function pickAction(exclude) {
  const options = LIVENESS_ACTIONS.filter((a) => a.label !== exclude);
  return options[Math.floor(Math.random() * options.length)];
}

async function dataUrlToFile(dataUrl, filename) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: 'image/jpeg' });
}

/**
 * Two-frame liveness capture. Frame 1 doubles as the face-verification photo.
 * value: { frame1Preview, frame1File, frame2Preview, frame2File, action } | null
 */
export default function LivenessCapture({ value, onChange, onNext }) {
  const webcamRef = useRef(null);
  const timerRef = useRef(null);
  const [camDenied, setCamDenied] = useState(false);
  const [action, setAction] = useState(() => value?.action ? LIVENESS_ACTIONS.find((a) => a.label === value.action) || pickAction() : pickAction());
  const [countdown, setCountdown] = useState(null); // null = idle
  const [frame1, setFrame1] = useState(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const ActionIcon = action.icon;

  const start = () => {
    const shot = webcamRef.current?.getScreenshot();
    if (!shot) return;
    setFrame1(shot);
    setCountdown(COUNTDOWN_SECONDS);
    let left = COUNTDOWN_SECONDS;
    timerRef.current = setInterval(async () => {
      left -= 1;
      if (left > 0) {
        setCountdown(left);
        return;
      }
      clearInterval(timerRef.current);
      const shot2 = webcamRef.current?.getScreenshot();
      setCountdown(null);
      if (!shot2) {
        setFrame1(null);
        return;
      }
      const [frame1File, frame2File] = await Promise.all([
        dataUrlToFile(shot, 'face.jpg'),
        dataUrlToFile(shot2, 'liveness.jpg'),
      ]);
      onChange({ frame1Preview: shot, frame1File, frame2Preview: shot2, frame2File, action: action.label });
    }, 1000);
  };

  const retake = () => {
    clearInterval(timerRef.current);
    setCountdown(null);
    setFrame1(null);
    setAction((prev) => pickAction(prev.label));
    onChange(null);
  };

  if (camDenied) {
    return (
      <div className="flex flex-col items-center py-8 text-center bg-[#FFEBEE] rounded-[10px] p-4 border border-[#FFCDD2]">
        <Camera className="mb-2 h-12 w-12 text-[#C62828]" />
        <p className="text-sm text-[#C62828]">Camera access denied. Please allow camera permissions.</p>
      </div>
    );
  }

  const ActionChip = (
    <div className="flex items-center gap-3 rounded-[10px] border border-[#FFE082] bg-[#FFF8E1] px-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
        <ActionIcon className="h-5 w-5 text-[#B07D00]" />
      </span>
      <div className="min-w-0">
        <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-[#B07D00]">Liveness action</p>
        <p className="text-[0.9375rem] font-semibold text-[#212121]">{action.label}</p>
      </div>
    </div>
  );

  if (value) {
    return (
      <div className="space-y-3">
        {ActionChip}
        <div className="grid grid-cols-2 gap-2">
          {[
            { src: value.frame1Preview, label: 'Frame 1 · face' },
            { src: value.frame2Preview, label: `Frame 2 · ${value.action.toLowerCase()}` },
          ].map((f) => (
            <figure key={f.label} className="space-y-1">
              <img src={f.src} alt={f.label} className="aspect-[4/3] w-full rounded-[14px] border border-[#E0E7DC] object-cover" />
              <figcaption className="truncate text-center text-[0.72rem] text-[#616161]">{f.label}</figcaption>
            </figure>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-[10px] border-[1.5px] border-[#246427] py-[10px] text-[0.875rem] font-semibold text-[#246427] bg-transparent hover:bg-[#F1F8E9] transition-colors"
            onClick={retake}
          >
            Retake
          </button>
          <button
            type="button"
            className="flex-1 rounded-[10px] bg-[#246427] py-[10px] text-[0.875rem] font-semibold text-[#FFFFFF] hover:bg-[#1a4d1c] transition-colors"
            onClick={onNext}
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  const running = countdown !== null;

  return (
    <div className="space-y-3">
      {ActionChip}
      <div className="relative">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          mirrored
          videoConstraints={{ facingMode: 'user', width: 1280, height: 720 }}
          onUserMediaError={() => setCamDenied(true)}
          className="aspect-[4/3] w-full rounded-[14px] bg-black object-cover"
        />
        <AnimatePresence>
          {running && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center rounded-[14px] bg-black/35 text-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.span
                key={countdown}
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-6xl font-bold"
              >
                {countdown}
              </motion.span>
              <p className="mt-2 rounded-full bg-black/40 px-3 py-1 text-sm font-semibold">{action.label} now</p>
            </motion.div>
          )}
        </AnimatePresence>
        {frame1 && running && (
          <img
            src={frame1}
            alt="Frame 1"
            className="absolute bottom-2 left-2 h-14 w-[4.5rem] rounded-md border-2 border-white object-cover shadow"
          />
        )}
      </div>
      <p className="text-[0.8125rem] text-[#616161]">
        Look at the camera and tap Start. We take one photo, then a second one after {COUNTDOWN_SECONDS} seconds —
        do the action during the countdown.
      </p>
      <button
        type="button"
        disabled={running}
        className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#246427] py-[10px] text-[0.875rem] font-semibold text-[#FFFFFF] hover:bg-[#1a4d1c] transition-colors disabled:opacity-60"
        onClick={start}
      >
        <ScanFace className="h-5 w-5" />
        {running ? 'Capturing…' : 'Start liveness check'}
      </button>
    </div>
  );
}
