import { useState, useCallback, useEffect } from 'react';

export interface UseTtsOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export const useTts = (options: UseTtsOptions = {}) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isEnabled, setIsEnabled] = useState(() => {
    const saved = localStorage.getItem('kitchenTtsEnabled');
    return saved !== null ? JSON.parse(saved) : false;
  });

  const {
    lang = 'es-ES',
    rate = 1.0,
    pitch = 1.0,
    volume = 1.0
  } = options;

  // Verificar soporte de TTS y cargar voces
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);

      const loadVoices = () => {
        const availableVoices = speechSynthesis.getVoices();
        setVoices(availableVoices);
        
        // Seleccionar una voz en español por defecto
        const spanishVoice = availableVoices.find(voice => voice.lang.startsWith('es'));
        if (spanishVoice) {
          setSelectedVoice(spanishVoice);
        }
      };

      loadVoices();
      
      // En algunos navegadores, las voces se cargan de forma asincrónica
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  // Guardar estado de activación de TTS
  useEffect(() => {
    localStorage.setItem('kitchenTtsEnabled', JSON.stringify(isEnabled));
  }, [isEnabled]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported || !isEnabled || !text.trim()) return;

      // Cancelar cualquier speech anterior
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = selectedVoice?.lang || lang;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      speechSynthesis.speak(utterance);
    },
    [isSupported, isEnabled, selectedVoice, lang, rate, pitch, volume]
  );

  const stop = useCallback(() => {
    if (isSupported) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    isSpeaking,
    isEnabled,
    setIsEnabled,
    voices,
    selectedVoice,
    setSelectedVoice,
    speak,
    stop
  };
};
