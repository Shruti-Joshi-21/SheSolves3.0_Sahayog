import React, { useEffect, useState } from 'react';
import { Loader2, Printer, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../utils/api.js';
import AiReportDocument from './AiReportDocument.jsx';
import PrintableReport from './PrintableReport.jsx';

const LANG_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिंदी' },
  { value: 'mr', label: 'मराठी' },
];

const LOADING_STEPS = ['Analysing report and photos…', 'Checking before / after evidence…', 'Writing the report…'];

/**
 * Challenge 4 — "Generate AI report" for a field report (Team Lead detail view).
 * Shows the saved report (FieldReport.aiReport) right away if there is one.
 */
const AiReportPanel = ({ fieldReport }) => {
  const saved = fieldReport?.aiReport || null;
  const [report, setReport] = useState(saved);
  const [lang, setLang] = useState(saved?.lang || 'en');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    setReport(fieldReport?.aiReport || null);
    setLang(fieldReport?.aiReport?.lang || 'en');
    setError('');
  }, [fieldReport?._id]);

  useEffect(() => {
    if (!loading) return undefined;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 6000);
    return () => clearInterval(t);
  }, [loading]);

  const sameLang = report?.lang === lang;

  const generate = async () => {
    if (!fieldReport?._id) return;
    setLoading(true);
    setError('');
    try {
      const refresh = sameLang ? '&refresh=1' : '';
      const res = await api.post(`/ai/reports/${fieldReport._id}/generate?lang=${lang}${refresh}`, null, { timeout: 90000 });
      const data = res.data?.data;
      setReport(data);
      if (data?.source === 'ai') toast.success(data.cached ? 'Loaded saved AI report' : 'AI report ready');
      else toast.warn('AI is busy — showing a basic report from the raw data');
    } catch (err) {
      const msg = err.code === 'ECONNABORTED' ? 'AI took too long — please try again' : err.response?.data?.message || 'Could not generate the report';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const meta = {
    workerName: fieldReport?.worker?.fullName,
    workType: fieldReport?.task?.workType,
    locationName: fieldReport?.task?.locationName?.split(',').slice(0, 2).join(','),
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wider text-[#616161]">
          <Sparkles className="h-3.5 w-3.5 text-[#246427]" /> AI Report
        </p>
        {report && !loading && (
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-[#E0E7DC] px-3 py-1.5 text-xs font-semibold text-[#616161] transition-colors hover:bg-gray-50"
          >
            <Printer className="h-3.5 w-3.5" /> Print / Save as PDF
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex rounded-[10px] border border-[#E0E7DC] bg-[#F9FBF7] p-1" role="radiogroup" aria-label="Report language">
          {LANG_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={lang === o.value}
              disabled={loading}
              onClick={() => setLang(o.value)}
              className={`flex-1 rounded-[8px] px-3 py-1.5 text-xs font-semibold transition-colors ${
                lang === o.value ? 'bg-[#246427] text-white' : 'text-[#616161] hover:bg-white'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={generate}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#246427] px-4 py-2 text-[0.8rem] font-semibold text-white transition-all hover:bg-[#1a4d1c] disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : sameLang ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {loading ? 'Generating…' : sameLang ? 'Regenerate' : 'Generate AI report'}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3 rounded-[14px] border border-[#E0E7DC] bg-[#F9FBF7] p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-[#246427]">
            <Loader2 className="h-4 w-4 animate-spin" /> {LOADING_STEPS[step]}
          </p>
          <p className="text-xs text-[#9E9E9E]">AI is reading the photos - this usually takes 15–30 seconds.</p>
          <div className="space-y-2">
            {[90, 75, 60].map((w) => (
              <div key={w} className="h-3 animate-pulse rounded-full bg-[#E0E7DC]" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      ) : error && !report ? (
        <div className="rounded-[12px] border border-[#FFCDD2] bg-[#FFEBEE] p-4 text-sm text-[#C62828]">
          {error}
        </div>
      ) : report ? (
        <AiReportDocument report={report} meta={meta} />
      ) : (
        <div className="rounded-[12px] border border-dashed border-[#E0E7DC] p-4 text-center text-xs text-[#9E9E9E]">
          Turn this report and its photos into a clean summary for admins and donors — in English, Hindi or Marathi.
        </div>
      )}

      {report && !loading && (
        <PrintableReport heading={`Sahayog · Field report${fieldReport?.task?.title ? ` · ${fieldReport.task.title}` : ''}`}>
          <AiReportDocument report={report} meta={meta} />
        </PrintableReport>
      )}
    </div>
  );
};

export default AiReportPanel;
