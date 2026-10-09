import React from 'react';
import { Clock, Eye, MapPin, Route, ScanFace, ShieldAlert, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';

// Attendance trust score (Challenge 3) — colours come from design-tokens.css
export const BAND_STYLES = {
  TRUSTED: {
    label: 'Trusted',
    color: 'var(--color-primary)',
    bg: 'var(--color-success-bg)',
    text: 'var(--color-success-text)',
    border: '#A5D6A7',
  },
  REVIEW: {
    label: 'Needs review',
    color: 'var(--color-accent)',
    bg: 'var(--color-warning-bg)',
    text: 'var(--color-warning-text)',
    border: '#FFE082',
  },
  SUSPICIOUS: {
    label: 'Suspicious',
    color: 'var(--color-danger-text)',
    bg: 'var(--color-danger-bg)',
    text: 'var(--color-danger-text)',
    border: '#FFCDD2',
  },
};

const SIGNALS = [
  { key: 'face', label: 'Face match', icon: ScanFace },
  { key: 'liveness', label: 'Liveness', icon: Eye },
  { key: 'geofence', label: 'Geofence', icon: MapPin },
  { key: 'timing', label: 'Timing', icon: Clock },
  { key: 'device', label: 'Device', icon: Smartphone },
  { key: 'travel', label: 'Location jump', icon: Route },
];

function barColor(ratio) {
  if (ratio >= 0.8) return 'var(--color-primary)';
  if (ratio >= 0.5) return 'var(--color-accent)';
  return 'var(--color-danger-text)';
}

/** Small pill for lists: "72 · Needs review" */
export function TrustBadge({ score, band, className = '' }) {
  const s = BAND_STYLES[band];
  if (!s || score == null) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-[10px] py-[3px] text-[0.72rem] font-semibold border ${className}`}
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
      title="Attendance trust score"
    >
      {band === 'TRUSTED' ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
      {score} · {s.label}
    </span>
  );
}

/** Circular score gauge */
export function TrustRing({ score, band, size = 88 }) {
  const s = BAND_STYLES[band] || BAND_STYLES.REVIEW;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score || 0)) / 100;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[1.375rem] font-bold leading-none" style={{ color: s.text }}>
          {score ?? '—'}
        </span>
        <span className="mt-0.5 text-[0.625rem] text-[#9E9E9E]">/ 100</span>
      </div>
    </div>
  );
}

/**
 * Full card: ring + band + per-signal bars + reasons.
 * Accepts either a record ({ confidenceScore, confidenceBand, confidenceSignals })
 * or a check-in response ({ confidence: { score, band, signals, reasons } }).
 */
export function TrustScoreCard({ record, confidence, className = '' }) {
  const score = confidence?.score ?? record?.confidenceScore;
  const band = confidence?.band ?? record?.confidenceBand;
  const signals = confidence?.signals ?? record?.confidenceSignals ?? {};
  const reasons = confidence?.reasons ?? record?.confidenceSignals?._meta?.reasons ?? [];
  const meta = record?.confidenceSignals?._meta;

  if (score == null || !BAND_STYLES[band]) {
    return (
      <div className={`rounded-[10px] border border-dashed border-[#E0E7DC] bg-[#F9FBF7] p-4 text-sm text-[#616161] ${className}`}>
        No trust score for this attendance (recorded before scoring was enabled).
      </div>
    );
  }

  const s = BAND_STYLES[band];
  return (
    <div className={`rounded-[14px] border border-[#E0E7DC] bg-white p-4 shadow-[var(--shadow-card)] ${className}`}>
      <div className="flex items-center gap-4">
        <TrustRing score={score} band={band} />
        <div className="min-w-0">
          <p className="text-[0.75rem] font-medium uppercase tracking-wide text-[#616161]">Attendance trust</p>
          <p className="text-[1.0625rem] font-semibold" style={{ color: s.text }}>{s.label}</p>
          {meta?.checkIn && meta?.checkOut && (
            <p className="mt-1 text-[0.75rem] text-[#616161]">
              Check-in {meta.checkIn.score} · Check-out {meta.checkOut.score} — lower one shown
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {SIGNALS.map(({ key, label, icon: Icon }) => {
          const sig = signals[key];
          if (!sig) return null;
          const ratio = sig.weight ? sig.score / sig.weight : 0;
          return (
            <div key={key}>
              <div className="flex items-center justify-between gap-2 text-[0.8125rem]">
                <span className="flex items-center gap-1.5 font-medium text-[#212121]">
                  <Icon className="h-3.5 w-3.5 text-[#616161]" />
                  {label}
                  {sig.source === 'ai' && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-[#F1F8E9] px-1.5 py-px text-[0.625rem] font-semibold text-[#246427]">
                      <Sparkles className="h-2.5 w-2.5" /> AI
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-[#616161]">
                  {Math.round(sig.score)}/{sig.weight}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#E0E7DC]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.round(ratio * 100)}%`, background: barColor(ratio), transition: 'width 600ms ease' }}
                />
              </div>
              {sig.detail && <p className="mt-0.5 text-[0.72rem] text-[#9E9E9E]">{sig.detail}</p>}
            </div>
          );
        })}
      </div>

      {reasons.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {reasons.map((r, i) => (
            <li
              key={`${i}-${r}`}
              className="flex items-start gap-2 rounded-[10px] px-3 py-2 text-[0.8125rem]"
              style={{ background: s.bg, color: s.text }}
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.text }} />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      {Array.isArray(signals.liveness?.frames) && signals.liveness.frames.length === 2 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[0.75rem] font-medium text-[#616161]">
            Liveness frames{record?.livenessAction ? ` — "${record.livenessAction}"` : ''}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {signals.liveness.frames.map((src, i) => (
              <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                <img src={src} alt={`Liveness frame ${i + 1}`} className="aspect-[4/3] w-full rounded-[10px] border border-[#E0E7DC] object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TrustScoreCard;
