import { useState, useEffect, useRef } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { changeLanguage } from '../utils/googleTranslate';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'mr', label: 'मराठी' },
  { code: 'hi', label: 'हिंदी' },
];

export default function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(() => localStorage.getItem('selectedLang') || 'en');
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Stay in sync if the mic button (or anything else) changes the language
  useEffect(() => {
    const handler = (e) => setCurrent(e.detail);
    window.addEventListener('langchange', handler);
    return () => window.removeEventListener('langchange', handler);
  }, []);

  const handleSelect = (langCode) => {
    changeLanguage(langCode);
    setCurrent(langCode);
    setOpen(false);
  };

  return (
    <div className="relative notranslate" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-[10px] border border-[#E0E7DC] bg-white text-sm text-[#212121] hover:bg-[#F9FBF7] transition-colors"
      >
        <Globe className="w-4 h-4 text-[#246427]" />
        {LANGUAGES.find((l) => l.code === current)?.label || 'English'}
        <ChevronDown className="w-4 h-4 text-[#9E9E9E]" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-36 bg-white border border-[#E0E7DC] rounded-[10px] shadow-lg z-50 overflow-hidden">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-[#F1F8E9] transition-colors ${
                current === lang.code ? 'bg-[#E8F5E9] text-[#246427] font-medium' : 'text-[#212121]'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}