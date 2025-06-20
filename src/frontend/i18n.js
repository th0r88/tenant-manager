import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initTranslationValidation } from './utils/translationValidator';

// Import translation files
import sl from './locales/sl.json';
import en from './locales/en.json';

const resources = {
  sl: {
    translation: sl
  },
  en: {
    translation: en
  }
};

// Language detection options
const detectionOptions = {
  // Order of language detection methods
  order: ['localStorage', 'navigator'],
  
  // localStorage key name
  lookupLocalStorage: 'tenant-manager-language',
  
  // Only detect languages we support
  checkWhitelist: true
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    
    // Default language (Slovenian)
    fallbackLng: 'sl',
    
    // Languages we support
    supportedLngs: ['sl', 'en'],
    
    // Language detection configuration
    detection: detectionOptions,
    
    // Interpolation options
    interpolation: {
      escapeValue: false // React already escapes values
    },
    
    // React options
    react: {
      useSuspense: false
    },
    
    // Debug mode (disable in production)
    debug: process.env.NODE_ENV === 'development'
  });

// Initialize translation validation in development mode
if (import.meta.env.DEV) {
  initTranslationValidation();
}

export default i18n;