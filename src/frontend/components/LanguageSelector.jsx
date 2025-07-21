import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTranslation } from '../hooks/useTranslation';

const LanguageSelector = () => {
  const { currentLanguage, changeLanguage, getAvailableLanguages, getCurrentLanguageInfo } = useLanguage();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const availableLanguages = getAvailableLanguages();
  const currentLangInfo = getCurrentLanguageInfo();

  const handleLanguageChange = async (languageCode) => {
    await changeLanguage(languageCode);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-base-content bg-base-100 border border-base-300 rounded-md hover:bg-base-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        aria-label={t('language.select')}
      >
        <span className="text-lg">{currentLangInfo.flag}</span>
        <span className="hidden sm:inline">{currentLangInfo.code === 'sl' ? t('language.slovenian') : t('language.english')}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 z-20 mt-2 w-48 bg-base-100 border border-base-300 rounded-md shadow-lg">
            <div className="py-1">
              {availableLanguages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => handleLanguageChange(language.code)}
                  className={`flex items-center w-full px-4 py-2 text-sm text-left hover:bg-base-200 ${
                    currentLanguage === language.code
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-base-content'
                  }`}
                >
                  <span className="mr-3 text-lg">{language.flag}</span>
                  <span>{language.code === 'sl' ? t('language.slovenian') : t('language.english')}</span>
                  {currentLanguage === language.code && (
                    <svg className="w-4 h-4 ml-auto text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSelector;