#!/usr/bin/env node

/**
 * Translation Validation Script
 * Validates translation completeness and consistency across the application
 * Can be run as part of CI/CD pipeline or manually during development
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.bold}${colors.cyan}${msg}${colors.reset}`),
  subtitle: (msg) => console.log(`${colors.bold}${msg}${colors.reset}`)
};

// Load translation files
const loadTranslations = () => {
  try {
    const slPath = path.join(__dirname, '../src/frontend/locales/sl.json');
    const enPath = path.join(__dirname, '../src/frontend/locales/en.json');
    
    const sl = JSON.parse(fs.readFileSync(slPath, 'utf8'));
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    
    return { sl, en };
  } catch (error) {
    log.error(`Failed to load translation files: ${error.message}`);
    process.exit(1);
  }
};

// Get all nested keys from translation object
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

// Check for missing keys between languages
const checkMissingKeys = (sl, en) => {
  log.title('Translation Key Consistency Check');
  
  const slKeys = new Set(getNestedKeys(sl));
  const enKeys = new Set(getNestedKeys(en));
  
  const missingInEn = [...slKeys].filter(key => !enKeys.has(key));
  const missingInSl = [...enKeys].filter(key => !slKeys.has(key));
  
  let hasErrors = false;
  
  if (missingInEn.length > 0) {
    log.error(`Missing in English translation (${missingInEn.length} keys):`);
    missingInEn.forEach(key => console.log(`  - ${key}`));
    hasErrors = true;
  }
  
  if (missingInSl.length > 0) {
    log.error(`Missing in Slovenian translation (${missingInSl.length} keys):`);
    missingInSl.forEach(key => console.log(`  - ${key}`));
    hasErrors = true;
  }
  
  if (!hasErrors) {
    log.success('All translation keys are consistent between languages');
  }
  
  return {
    missingInEnglish: missingInEn,
    missingInSlovenian: missingInSl,
    totalKeys: {
      slovenian: slKeys.size,
      english: enKeys.size
    }
  };
};

// Check for empty translations
const checkEmptyTranslations = (sl, en) => {
  log.title('Empty Translation Check');
  
  const checkEmpty = (obj, lang, prefix = '') => {
    const emptyKeys = [];
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          emptyKeys.push(...checkEmpty(obj[key], lang, newKey));
        } else if (!obj[key] || obj[key].trim() === '') {
          emptyKeys.push(newKey);
        }
      }
    }
    
    return emptyKeys;
  };
  
  const emptyInSl = checkEmpty(sl, 'sl');
  const emptyInEn = checkEmpty(en, 'en');
  
  let hasErrors = false;
  
  if (emptyInSl.length > 0) {
    log.error(`Empty translations in Slovenian (${emptyInSl.length} keys):`);
    emptyInSl.forEach(key => console.log(`  - ${key}`));
    hasErrors = true;
  }
  
  if (emptyInEn.length > 0) {
    log.error(`Empty translations in English (${emptyInEn.length} keys):`);
    emptyInEn.forEach(key => console.log(`  - ${key}`));
    hasErrors = true;
  }
  
  if (!hasErrors) {
    log.success('No empty translations found');
  }
  
  return {
    emptyInSlovenian: emptyInSl,
    emptyInEnglish: emptyInEn
  };
};

// Check for required translation keys
const checkRequiredKeys = (sl, en) => {
  log.title('Required Translation Keys Check');
  
  const requiredKeys = [
    // Common keys
    'common.loading',
    'common.error',
    'common.success',
    'common.cancel',
    'common.save',
    'common.delete',
    'common.edit',
    'common.add',
    
    // Navigation
    'navigation.dashboard',
    'navigation.tenants',
    'navigation.utilities',
    'navigation.reports',
    
    // Language switching
    'language.slovenian',
    'language.english',
    
    // PDF specific
    'reports.pdfLanguage',
    'reports.downloadPdf',
    'reports.batchExport',
    
    // Critical business keys
    'tenants.title',
    'utilities.title',
    'reports.title'
  ];
  
  const missingKeys = [];
  
  requiredKeys.forEach(key => {
    const slHasKey = getNestedValue(sl, key) !== undefined;
    const enHasKey = getNestedValue(en, key) !== undefined;
    
    if (!slHasKey || !enHasKey) {
      missingKeys.push({
        key,
        missingInSl: !slHasKey,
        missingInEn: !enHasKey
      });
    }
  });
  
  if (missingKeys.length > 0) {
    log.error(`Missing required translation keys (${missingKeys.length}):`);
    missingKeys.forEach(({ key, missingInSl, missingInEn }) => {
      const missing = [];
      if (missingInSl) missing.push('SL');
      if (missingInEn) missing.push('EN');
      console.log(`  - ${key} (missing in: ${missing.join(', ')})`);
    });
    return false;
  } else {
    log.success('All required translation keys are present');
    return true;
  }
};

// Get nested value from object
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
};

// Generate coverage report
const generateCoverageReport = (missing) => {
  log.title('Translation Coverage Report');
  
  const totalUnique = new Set([
    ...getNestedKeys(translations.sl),
    ...getNestedKeys(translations.en)
  ]).size;
  
  const coverage = {
    slovenian: ((missing.totalKeys.slovenian / totalUnique) * 100).toFixed(1),
    english: ((missing.totalKeys.english / totalUnique) * 100).toFixed(1),
    overall: (((missing.totalKeys.slovenian + missing.totalKeys.english) / (totalUnique * 2)) * 100).toFixed(1)
  };
  
  console.log(`Slovenian: ${missing.totalKeys.slovenian}/${totalUnique} keys (${coverage.slovenian}%)`);
  console.log(`English: ${missing.totalKeys.english}/${totalUnique} keys (${coverage.english}%)`);
  console.log(`Overall Coverage: ${coverage.overall}%`);
  
  // Quality gates
  const minCoverage = 95;
  if (parseFloat(coverage.overall) < minCoverage) {
    log.error(`Coverage ${coverage.overall}% is below minimum threshold of ${minCoverage}%`);
    return false;
  } else {
    log.success(`Coverage ${coverage.overall}% meets quality threshold`);
    return true;
  }
};

// Check translation structure consistency
const checkStructureConsistency = (sl, en) => {
  log.title('Translation Structure Consistency Check');
  
  const getStructure = (obj, prefix = '') => {
    const structure = {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          structure[key] = getStructure(obj[key], fullKey);
        } else {
          structure[key] = 'string';
        }
      }
    }
    
    return structure;
  };
  
  const slStructure = JSON.stringify(getStructure(sl), null, 2);
  const enStructure = JSON.stringify(getStructure(en), null, 2);
  
  if (slStructure === enStructure) {
    log.success('Translation structures are consistent');
    return true;
  } else {
    log.error('Translation structures are inconsistent between languages');
    return false;
  }
};

// Main validation function
const validateTranslations = () => {
  log.title('🌐 Translation Validation');
  console.log('Validating translation completeness and consistency...\n');
  
  const translations = loadTranslations();
  let allPassed = true;
  
  // Run all checks
  const missing = checkMissingKeys(translations.sl, translations.en);
  const empty = checkEmptyTranslations(translations.sl, translations.en);
  const requiredPassed = checkRequiredKeys(translations.sl, translations.en);
  const coveragePassed = generateCoverageReport(missing);
  const structurePassed = checkStructureConsistency(translations.sl, translations.en);
  
  // Check if any validation failed
  if (missing.missingInEnglish.length > 0 || missing.missingInSlovenian.length > 0) {
    allPassed = false;
  }
  
  if (empty.emptyInSlovenian.length > 0 || empty.emptyInEnglish.length > 0) {
    allPassed = false;
  }
  
  if (!requiredPassed || !coveragePassed || !structurePassed) {
    allPassed = false;
  }
  
  // Final result
  log.title('Validation Summary');
  if (allPassed) {
    log.success('All translation validations passed! 🎉');
    process.exit(0);
  } else {
    log.error('Translation validation failed. Please fix the issues above.');
    process.exit(1);
  }
};

// Export for testing
export {
  loadTranslations,
  getNestedKeys,
  checkMissingKeys,
  checkEmptyTranslations,
  checkRequiredKeys,
  generateCoverageReport,
  checkStructureConsistency
};

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateTranslations();
}