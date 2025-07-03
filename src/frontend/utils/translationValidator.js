/**
 * Translation Validation Utilities
 * Development tools for ensuring translation completeness and consistency
 */

import slTranslations from '../locales/sl.json';
import enTranslations from '../locales/en.json';

/**
 * Development mode checker
 */
const isDevelopment = () => {
  return import.meta.env.DEV;
};

/**
 * Get all translation keys from a nested object
 */
const getNestedKeys = (obj, prefix = '') => {
  const keys = [];
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        keys.push(...getNestedKeys(obj[key], newKey));
      } else {
        keys.push(newKey);
      }
    }
  }
  
  return keys;
};

/**
 * Find missing translation keys between languages
 */
export const findMissingKeys = () => {
  const slKeys = new Set(getNestedKeys(slTranslations));
  const enKeys = new Set(getNestedKeys(enTranslations));
  
  const missingInEn = [...slKeys].filter(key => !enKeys.has(key));
  const missingInSl = [...enKeys].filter(key => !slKeys.has(key));
  
  return {
    missingInEnglish: missingInEn,
    missingInSlovenian: missingInSl,
    totalKeys: {
      slovenian: slKeys.size,
      english: enKeys.size
    }
  };
};

/**
 * Validate translation key consistency
 */
export const validateTranslationConsistency = () => {
  if (!isDevelopment()) return;
  
  const missing = findMissingKeys();
  const hasIssues = missing.missingInEnglish.length > 0 || missing.missingInSlovenian.length > 0;
  
  if (hasIssues) {
    console.group('🌐 Translation Validation Issues');
    
    if (missing.missingInEnglish.length > 0) {
      console.warn('❌ Missing in English translations:', missing.missingInEnglish);
    }
    
    if (missing.missingInSlovenian.length > 0) {
      console.warn('❌ Missing in Slovenian translations:', missing.missingInSlovenian);
    }
    
    console.groupEnd();
  } else {
    console.log('✅ All translation keys are consistent between languages');
  }
  
  return missing;
};

/**
 * Check if a translation key exists
 */
export const keyExists = (key, language = 'sl') => {
  const translations = language === 'sl' ? slTranslations : enTranslations;
  const keys = key.split('.');
  let current = translations;
  
  for (const k of keys) {
    if (current && typeof current === 'object' && current.hasOwnProperty(k)) {
      current = current[k];
    } else {
      return false;
    }
  }
  
  return typeof current === 'string';
};

/**
 * Track missing translation key usage
 */
const missingKeyTracker = new Set();

/**
 * Enhanced translation function with validation
 */
export const validatedT = (i18n, key, options = '') => {
  if (!isDevelopment()) {
    return i18n.t(key, options);
  }
  
  const result = i18n.t(key, options);
  
  // Check if translation was found
  if (result === key && !keyExists(key, i18n.language)) {
    if (!missingKeyTracker.has(key)) {
      console.warn(`🔍 Missing translation key: "${key}" for language "${i18n.language}"`);
      missingKeyTracker.add(key);
    }
  }
  
  return result || (typeof options === 'string' ? options : '') || key;
};

/**
 * Generate translation coverage report
 */
export const generateCoverageReport = () => {
  if (!isDevelopment()) return;
  
  const missing = findMissingKeys();
  const totalUnique = new Set([
    ...getNestedKeys(slTranslations),
    ...getNestedKeys(enTranslations)
  ]).size;
  
  const coverage = {
    slovenian: ((missing.totalKeys.slovenian / totalUnique) * 100).toFixed(1),
    english: ((missing.totalKeys.english / totalUnique) * 100).toFixed(1),
    overall: (((missing.totalKeys.slovenian + missing.totalKeys.english) / (totalUnique * 2)) * 100).toFixed(1)
  };
  
  console.group('📊 Translation Coverage Report');
  console.log(`Slovenian: ${missing.totalKeys.slovenian}/${totalUnique} keys (${coverage.slovenian}%)`);
  console.log(`English: ${missing.totalKeys.english}/${totalUnique} keys (${coverage.english}%)`);
  console.log(`Overall Coverage: ${coverage.overall}%`);
  
  if (missing.missingInEnglish.length > 0) {
    console.log('Missing in English:', missing.missingInEnglish);
  }
  
  if (missing.missingInSlovenian.length > 0) {
    console.log('Missing in Slovenian:', missing.missingInSlovenian);
  }
  
  console.groupEnd();
  
  return coverage;
};

/**
 * Initialize translation validation in development mode
 */
export const initTranslationValidation = () => {
  if (!isDevelopment()) return;
  
  console.log('🔧 Translation validation enabled (development mode)');
  
  // Run initial validation
  validateTranslationConsistency();
  generateCoverageReport();
  
  // Add global helper functions for development
  if (typeof window !== 'undefined') {
    window.translationValidation = {
      validateConsistency: validateTranslationConsistency,
      generateReport: generateCoverageReport,
      findMissing: findMissingKeys,
      checkKey: keyExists
    };
    
    console.log('💡 Translation validation helpers available at window.translationValidation');
  }
};

/**
 * Reset missing key tracker (useful for testing)
 */
export const resetMissingKeyTracker = () => {
  missingKeyTracker.clear();
};

export default {
  findMissingKeys,
  validateTranslationConsistency,
  keyExists,
  validatedT,
  generateCoverageReport,
  initTranslationValidation,
  resetMissingKeyTracker
};