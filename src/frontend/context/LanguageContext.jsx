import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || 'sl');

  // Update current language when i18n language changes
  useEffect(() => {
    const handleLanguageChange = (lng) => {
      setCurrentLanguage(lng);
    };

    i18n.on('languageChanged', handleLanguageChange);
    
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  // Function to change language
  const changeLanguage = async (newLanguage) => {
    try {
      await i18n.changeLanguage(newLanguage);
      
      // Note: localStorage is automatically handled by i18next-browser-languagedetector
      // No need for manual localStorage.setItem() - this prevents duplication
      
      setCurrentLanguage(newLanguage);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  // Get available languages
  const getAvailableLanguages = () => {
    return [
      { code: 'sl', name: 'Slovenščina', flag: '🇸🇮' },
      { code: 'en', name: 'English', flag: '🇬🇧' }
    ];
  };

  // Get current language info
  const getCurrentLanguageInfo = () => {
    const languages = getAvailableLanguages();
    return languages.find(lang => lang.code === currentLanguage) || languages[0];
  };

  const value = {
    currentLanguage,
    changeLanguage,
    getAvailableLanguages,
    getCurrentLanguageInfo,
    isLoading: !i18n.isInitialized
  };

  // Show loading state while i18n is initializing
  if (!i18n.isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading loading-spinner loading-lg"></div>
        <span className="ml-2">Loading translations...</span>
      </div>
    );
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};