import React from 'react';
import { createPortal } from 'react-dom';

// Print: only the portal copy is shown; everything else on the page (modals, layout) is hidden.
const PRINT_CSS = `
@media screen { .ai-report-print-root { display: none; } }
@media print {
  @page { margin: 14mm; }
  body > *:not(.ai-report-print-root) { display: none !important; }
  .ai-report-print-root { display: block !important; }
  .ai-report-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .ai-report-print-root .ai-report-doc { border: none; padding: 0; }
  .ai-report-print-root section { break-inside: avoid; }
}`;

/**
 * Renders `children` into a hidden print-only copy at <body> level, so window.print()
 * prints just the report (no modal clipping). Mount one at a time.
 */
const PrintableReport = ({ heading, children }) => (
  <>
    <style>{PRINT_CSS}</style>
    {createPortal(
      <div className="ai-report-print-root" style={{ fontFamily: "'Outfit', 'Nirmala UI', 'Noto Sans Devanagari', sans-serif" }}>
        {heading && <p style={{ fontSize: 11, color: '#616161', marginBottom: 8 }}>{heading}</p>}
        {children}
      </div>,
      document.body
    )}
  </>
);

export default PrintableReport;
