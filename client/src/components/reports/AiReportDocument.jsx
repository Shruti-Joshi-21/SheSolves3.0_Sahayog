import React from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, HelpCircle, Lightbulb, Sparkles, Clock } from 'lucide-react';

// Section headings in the report's own language (Challenge 4 — multilingual reports)
const HEADINGS = {
  en: {
    summary: 'Summary', workDone: 'Work done', quantities: 'Key numbers', issues: 'Issues found',
    evidence: 'Photo evidence check', attendance: 'Attendance', recs: 'Recommendations',
    match: 'Photos match the task', mismatch: 'Photos do not match the task', unchecked: 'Not checked automatically',
    ai: 'AI-generated', fallback: 'Auto-generated (AI unavailable)', generated: 'Generated',
    none: 'None',
  },
  hi: {
    summary: 'सारांश', workDone: 'किया गया कार्य', quantities: 'मुख्य आँकड़े', issues: 'पाई गई समस्याएँ',
    evidence: 'फ़ोटो साक्ष्य जाँच', attendance: 'उपस्थिति', recs: 'सुझाव',
    match: 'फ़ोटो कार्य से मेल खाते हैं', mismatch: 'फ़ोटो कार्य से मेल नहीं खाते', unchecked: 'स्वचालित जाँच नहीं हुई',
    ai: 'AI द्वारा तैयार', fallback: 'स्वतः तैयार (AI उपलब्ध नहीं)', generated: 'तैयार किया गया',
    none: 'कोई नहीं',
  },
  mr: {
    summary: 'सारांश', workDone: 'केलेले काम', quantities: 'मुख्य आकडे', issues: 'आढळलेल्या समस्या',
    evidence: 'फोटो पुरावा तपासणी', attendance: 'उपस्थिती', recs: 'शिफारसी',
    match: 'फोटो कामाशी जुळतात', mismatch: 'फोटो कामाशी जुळत नाहीत', unchecked: 'स्वयंचलित तपासणी झाली नाही',
    ai: 'AI द्वारे तयार', fallback: 'स्वयं तयार (AI उपलब्ध नाही)', generated: 'तयार केले',
    none: 'काहीही नाही',
  },
};

const SectionTitle = ({ icon: Icon, children }) => (
  <p className="flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wider text-[#616161]">
    {Icon && <Icon className="h-3.5 w-3.5 text-[#246427]" />}
    {children}
  </p>
);

const BulletList = ({ items, empty, tone = 'default' }) => {
  const list = (items || []).filter(Boolean);
  if (!list.length) return <p className="text-sm text-[#9E9E9E]">{empty}</p>;
  const dot = tone === 'warn' ? 'bg-[#B07D00]' : 'bg-[#246427]';
  return (
    <ul className="space-y-1.5">
      {list.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed text-[#424242]">
          <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
};

/** Renders a saved FieldReport.aiReport as a document. Used on screen and in the print copy. */
const AiReportDocument = ({ report, meta = {} }) => {
  if (!report) return null;
  const h = HEADINGS[report.lang] || HEADINGS.en;
  const isAi = report.source === 'ai';
  const ev = report.evidenceAssessment || {};
  const evState = ev.photosMatchTask === true ? 'match' : ev.photosMatchTask === false ? 'mismatch' : 'unchecked';
  const evStyle = {
    match: { bg: 'bg-[#E8F5E9]', text: 'text-[#246427]', Icon: CheckCircle2 },
    mismatch: { bg: 'bg-[#FFEBEE]', text: 'text-[#C62828]', Icon: AlertTriangle },
    unchecked: { bg: 'bg-[#FFF8E1]', text: 'text-[#B07D00]', Icon: HelpCircle },
  }[evState];
  const generatedAt = report.generatedAt ? new Date(report.generatedAt).toLocaleString() : '';

  return (
    <article lang={report.lang || 'en'} className="ai-report-doc space-y-5 rounded-[14px] border border-[#E0E7DC] bg-white p-5">
      <header className="space-y-2 border-b border-[#E0E7DC] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
              isAi ? 'bg-[#F1F8E9] text-[#246427]' : 'bg-[#FFF8E1] text-[#B07D00]'
            }`}
          >
            <Sparkles className="h-3 w-3" /> {isAi ? h.ai : h.fallback}
          </span>
          {generatedAt && <span className="text-[0.65rem] text-[#9E9E9E]">{h.generated} · {generatedAt}</span>}
        </div>
        <h3 className="text-lg font-semibold leading-snug text-[#1a4a1a]">{report.title}</h3>
        {(meta.workerName || meta.workType || meta.locationName) && (
          <p className="text-xs text-[#757575]">
            {[meta.workerName, meta.workType, meta.locationName].filter(Boolean).join(' · ')}
          </p>
        )}
      </header>

      <section className="space-y-2">
        <SectionTitle icon={ClipboardList}>{h.summary}</SectionTitle>
        <p className="text-sm leading-relaxed text-[#424242]">{report.summary}</p>
      </section>

      {Array.isArray(report.quantities) && report.quantities.length > 0 && (
        <section className="space-y-2">
          <SectionTitle>{h.quantities}</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {report.quantities.map((q, i) => (
              <div key={i} className="min-w-[110px] rounded-[10px] border border-[#E0E7DC] bg-[#F9FBF7] px-3 py-2">
                <p className="text-lg font-semibold leading-tight text-[#246427] tabular-nums">
                  {q.value}
                  {q.unit ? <span className="ml-1 text-xs font-medium text-[#616161]">{q.unit}</span> : null}
                </p>
                <p className="text-[0.7rem] text-[#757575]">{q.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <SectionTitle icon={CheckCircle2}>{h.workDone}</SectionTitle>
        <BulletList items={report.workDone} empty={h.none} />
      </section>

      <section className="space-y-2">
        <SectionTitle icon={AlertTriangle}>{h.issues}</SectionTitle>
        <BulletList items={report.issuesFound} empty={h.none} tone="warn" />
      </section>

      <section className="space-y-2">
        <SectionTitle>{h.evidence}</SectionTitle>
        <div className={`rounded-[10px] ${evStyle.bg} p-3`}>
          <p className={`flex items-center gap-1.5 text-sm font-semibold ${evStyle.text}`}>
            <evStyle.Icon className="h-4 w-4" /> {h[evState]}
          </p>
          {ev.notes && <p className="mt-1 text-[13px] leading-relaxed text-[#424242]">{ev.notes}</p>}
        </div>
        {Array.isArray(report.evidenceImages) && report.evidenceImages.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {report.evidenceImages.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-[10px] border border-[#E0E7DC]">
                <img src={src} alt={`Evidence ${i + 1}`} className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </section>

      {report.attendanceNote && (
        <section className="space-y-2">
          <SectionTitle icon={Clock}>{h.attendance}</SectionTitle>
          <p className="text-sm leading-relaxed text-[#424242]">{report.attendanceNote}</p>
        </section>
      )}

      <section className="space-y-2">
        <SectionTitle icon={Lightbulb}>{h.recs}</SectionTitle>
        <BulletList items={report.recommendations} empty={h.none} />
      </section>
    </article>
  );
};

export default AiReportDocument;
