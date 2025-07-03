import { useTranslation as useReactI18next } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { validatedT } from '../utils/translationValidator';

/**
 * Custom hook that combines react-i18next with our language context
 * Provides additional utilities for translation management
 */
export const useTranslation = (namespace) => {
  const { t: originalT, i18n } = useReactI18next(namespace);
  const { currentLanguage, changeLanguage } = useLanguage();
  
  // Enhanced translation function with validation in development
  const t = (key, options) => {
    // Use original react-i18next function directly for interpolation
    return originalT(key, options);
  };

  // Helper function to get translated utility types
  const getUtilityTypes = () => {
    return [
      { key: 'electricity', label: t('utilities.types.electricity') },
      { key: 'water', label: t('utilities.types.water') },
      { key: 'heating', label: t('utilities.types.heating') },
      { key: 'tv_rtv', label: t('utilities.types.tv_rtv') },
      { key: 'cleaning', label: t('utilities.types.cleaning') },
      { key: 'internet', label: t('utilities.types.internet') },
      { key: 'maintenance', label: t('utilities.types.maintenance') },
      { key: 'gas', label: t('utilities.types.gas') },
      { key: 'waste', label: t('utilities.types.waste') }
    ];
  };

  // Helper function to translate a single utility type
  const translateUtilityType = (utilityType) => {
    return t(`utilities.types.${utilityType}`) || utilityType;
  };

  // Helper function to format dates according to current language
  const formatDate = (date, options = {}) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (currentLanguage === 'sl') {
      // Slovenian format: DD. MM. YYYY
      const day = dateObj.getDate().toString().padStart(2, '0');
      const month = (dateObj.getMonth() + 1).toString();
      const year = dateObj.getFullYear();
      return `${day}. ${month}. ${year}`;
    } else {
      // English format: Month DD, YYYY
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options
      });
    }
  };

  // Helper function to format currency according to current language
  const formatCurrency = (amount) => {
    const numAmount = parseFloat(amount) || 0;
    
    if (currentLanguage === 'sl') {
      // Slovenian format: 123,45 €
      return `${numAmount.toFixed(2).replace('.', ',')} €`;
    } else {
      // English format: €123.45
      return `€${numAmount.toFixed(2)}`;
    }
  };

  // Helper function to format numbers according to current language
  const formatNumber = (number, decimals = 2) => {
    const num = parseFloat(number) || 0;
    
    if (currentLanguage === 'sl') {
      // Slovenian format: use comma as decimal separator
      return num.toFixed(decimals).replace('.', ',');
    } else {
      // English format: use period as decimal separator
      return num.toFixed(decimals);
    }
  };

  // Helper function to get month names
  const getMonthNames = () => {
    if (currentLanguage === 'sl') {
      return [
        'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
        'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'
      ];
    } else {
      return [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
    }
  };

  // Helper function to get short month names
  const getShortMonthNames = () => {
    if (currentLanguage === 'sl') {
      return [
        'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
        'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'
      ];
    } else {
      return [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
    }
  };

  return {
    t,
    i18n,
    currentLanguage,
    changeLanguage,
    getUtilityTypes,
    translateUtilityType,
    formatDate,
    formatCurrency,
    formatNumber,
    getMonthNames,
    getShortMonthNames
  };
};