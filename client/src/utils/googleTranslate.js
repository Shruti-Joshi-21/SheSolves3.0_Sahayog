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