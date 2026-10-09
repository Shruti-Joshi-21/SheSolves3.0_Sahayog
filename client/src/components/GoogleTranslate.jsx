import { useEffect } from 'react';

export default function GoogleTranslate() {
  useEffect(() => {
    if (document.getElementById('google-translate-script')) return;

    window.googleTranslateElementInit = () => {
      new window.google.translate.TranslateElement(
        {
          pageLanguage: 'en',
          includedLanguages: 'en,mr,hi',
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false,
        },
        'google_translate_element'
      );
    };

    const script = document.createElement('script');
    script.id = 'google-translate-script';
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return <div id="google_translate_element" style={{ display: 'none' }} />;
}

export function setGoogTransCookie(langCode) {
  const value = langCode === 'en' ? '/en/en' : `/en/${langCode}`;
  document.cookie = `googtrans=${value}; path=/`;
  document.cookie = `googtrans=${value}; path=/; domain=${window.location.hostname}`;
}

export function changeLanguage(langCode) {
  localStorage.setItem('selectedLang', langCode);
  setGoogTransCookie(langCode);

  const select = document.querySelector('.goog-te-combo');
  if (select) {
    select.value = langCode;
    select.dispatchEvent(new Event('change'));
  } else {
    window.location.reload();
  }

  // Let other components (like the dropdown UI) know the language changed
  window.dispatchEvent(new CustomEvent('langchange', { detail: langCode }));
}