/**
 * Backend Translation Service
 * Provides translations for PDF generation and server-side formatting
 */

export const translations = {
  sl: {
    // PDF Headers and Labels
    pdf: {
      statementDate: 'Datum obračuna',
      billingPeriod: 'Obračunsko obdobje',
      tenant: 'Najemnik',
      chargesBreakdown: 'RAZČLENITEV STROŠKOV',
      monthlyRent: 'MESEČNA NAJEMNINA',
      utilityCharges: 'STROŠKI',
      totalAmountDue: 'SKUPAJ ZA PLAČILO',
      amount: 'Znesek',
      totalAmount: 'Skupni znesek',
      yourShare: 'Tvoj delež',
      utilityType: 'Tip obračuna',
      generated: 'Ustvarjeno',
      propertyManagementSystem: 'Sistem upravljanja nepremičnin',
      confidentialDocument: 'Zaupni dokument'
    },
    // Months
    months: {
      full: [
        'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
        'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'
      ],
      short: [
        'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
        'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'
      ]
    },
    // Utility Types
    utilities: {
      electricity: 'Elektrika',
      water: 'Voda',
      heating: 'Ogrevanje',
      tv_rtv: 'TV + RTV prispevek',
      cleaning: 'Snaga',
      internet: 'Internet',
      maintenance: 'Vzdrževanje',
      gas: 'Plin',
      waste: 'Smeti'
    }
  },
  en: {
    // PDF Headers and Labels
    pdf: {
      statementDate: 'Statement Date',
      billingPeriod: 'Billing Period',
      tenant: 'Tenant',
      chargesBreakdown: 'CHARGES BREAKDOWN',
      monthlyRent: 'MONTHLY RENT',
      utilityCharges: 'UTILITY CHARGES',
      totalAmountDue: 'TOTAL AMOUNT DUE',
      amount: 'Amount',
      totalAmount: 'Total Amount',
      yourShare: 'Your Share',
      utilityType: 'Utility Type',
      generated: 'Generated',
      propertyManagementSystem: 'Property Management System',
      confidentialDocument: 'Confidential Document'
    },
    // Months
    months: {
      full: [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ],
      short: [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ]
    },
    // Utility Types
    utilities: {
      electricity: 'Electricity',
      water: 'Water',
      heating: 'Heating',
      tv_rtv: 'TV + RTV License',
      cleaning: 'Cleaning',
      internet: 'Internet',
      maintenance: 'Maintenance',
      gas: 'Gas',
      waste: 'Waste Management'
    }
  }
};

/**
 * Get translation for a specific key and language
 * @param {string} language - Language code (sl, en)
 * @param {string} key - Translation key (e.g., 'pdf.statementDate')
 * @param {string} fallback - Fallback text if translation not found
 * @returns {string} Translated text
 */
export function t(language, key, fallback = '') {
  const lang = translations[language] || translations.sl;
  const keys = key.split('.');
  
  let value = lang;
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) break;
  }
  
  return value || fallback || key;
}

/**
 * Get month name in specified language
 * @param {number} monthIndex - Month index (0-11)
 * @param {string} language - Language code
 * @param {boolean} short - Use short month names
 * @returns {string} Month name
 */
export function getMonthName(monthIndex, language = 'sl', short = false) {
  const lang = translations[language] || translations.sl;
  const months = short ? lang.months.short : lang.months.full;
  return months[monthIndex] || months[0];
}

/**
 * Get translated utility type
 * @param {string} utilityType - Original utility type
 * @param {string} language - Language code
 * @returns {string} Translated utility type
 */
export function translateUtilityType(utilityType, language = 'sl') {
  const lang = translations[language] || translations.sl;
  const type = utilityType.toLowerCase();
  
  // Map common variations to standard keys
  const typeMap = {
    'elektrika': 'electricity',
    'electricity': 'electricity',
    'voda': 'water',
    'water': 'water',
    'ogrevanje': 'heating',
    'heating': 'heating',
    'tv_rtv': 'tv_rtv',
    'tv + rtv prispevek': 'tv_rtv',
    'snaga': 'cleaning',
    'čiščenje': 'cleaning',
    'cleaning': 'cleaning',
    'plin': 'gas',
    'gas': 'gas',
    'internet': 'internet',
    'wifi': 'internet',
    'vzdrževanje': 'maintenance',
    'maintenance': 'maintenance',
    'smeti': 'waste',
    'waste': 'waste'
  };
  
  const standardKey = typeMap[type];
  if (standardKey && lang.utilities[standardKey]) {
    return lang.utilities[standardKey];
  }
  
  // Return original if no translation found
  return utilityType;
}

/**
 * Get all available utility types with translations
 * @param {string} language - Language code
 * @returns {Object} Object with utility type mappings
 */
export function getUtilityTypes(language = 'sl') {
  const lang = translations[language] || translations.sl;
  return lang.utilities;
}