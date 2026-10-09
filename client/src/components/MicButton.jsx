import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { toast } from 'react-toastify';
import { changeLanguage } from '../utils/googleTranslate';
import { detectLanguageIntent } from '../utils/detectLanguageIntent';

const LANG_LABELS = { en: 'English', mr: 'Marathi', hi: 'Hindi' };

export default function MicButton() {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const handleClick = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN'; // best general-purpose model for Hinglish/mixed Indian speech
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setListening(true);
      toast.info('Listening... say the language you want (e.g. "Marathi" or "Hindi")', {
        autoClose: 2500,
      });
    };

    recognition.onresult = (event) => {
      // Check all alternatives, not just the top guess, to improve match odds
      let detected = null;
      for (let i = 0; i < event.results[0].length && !detected; i++) {
        const transcript = event.results[0][i].transcript;
        detected = detectLanguageIntent(transcript);
      }

      if (detected) {
        changeLanguage(detected);
        toast.success(`Switching to ${LANG_LABELS[detected]}`);
      } else {
        toast.warn('Could not detect a language. Please try again and say "Marathi", "Hindi", or "English" clearly.');
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        toast.error('Microphone permission denied.');
      } else if (event.error === 'no-speech') {
        toast.warn('No speech detected. Please try again.');
      } else {
        toast.error('Voice recognition error. Please try again.');
      }
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [listening]);

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Speak to change language"
      className={`relative flex items-center justify-center w-10 h-10 rounded-full border transition-colors notranslate ${
        listening
          ? 'bg-[#246427] border-[#246427] text-white'
          : 'bg-white border-[#E0E7DC] text-[#246427] hover:bg-[#F9FBF7]'
      }`}
    >
      {listening && (
        <span className="absolute inset-0 rounded-full bg-[#246427]/40 animate-ping" />
      )}
      {listening ? <MicOff className="w-4 h-4 relative z-10" /> : <Mic className="w-4 h-4" />}
    </button>
  );
}