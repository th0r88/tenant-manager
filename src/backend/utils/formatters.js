/**
 * Localized formatting utilities for backend
 */

/**
 * Format currency according to language
 * @param {number} amount - Amount to format
 * @param {string} language - Language code (sl, en)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, language = 'sl') {
  const numAmount = parseFloat(amount) || 0;
  
  if (language === 'sl') {
    // Slovenian format: 123,45 €
    return `${numAmount.toFixed(2).replace('.', ',')} €`;
  } else {
    // English format: €123.45
    return `€${numAmount.toFixed(2)}`;
  }
}

/**
 * Format number according to language
 * @param {number} number - Number to format
 * @param {string} language - Language code
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number string
 */
export function formatNumber(number, language = 'sl', decimals = 2) {
  const num = parseFloat(number) || 0;
  
  if (language === 'sl') {
    // Slovenian format: use comma as decimal separator
    return num.toFixed(decimals).replace('.', ',');
  } else {
    // English format: use period as decimal separator
    return num.toFixed(decimals);
  }
}

/**
 * Format date according to language
 * @param {Date|string} date - Date to format
 * @param {string} language - Language code
 * @param {Object} options - Additional formatting options
 * @returns {string} Formatted date string
 */
export function formatDate(date, language = 'sl', options = {}) {
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (language === 'sl') {
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
}

/**
 * Format date for short display
 * @param {Date|string} date - Date to format
 * @param {string} language - Language code
 * @returns {string} Short formatted date string
 */
export function formatDateShort(date, language = 'sl') {
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (language === 'sl') {
    // Slovenian short format: DD.MM.YYYY
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}.${month}.${year}`;
  } else {
    // English short format: MM/DD/YYYY
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }
}

/**
 * Get month and year string
 * @param {number} month - Month number (1-12)
 * @param {number} year - Year
 * @param {string} language - Language code
 * @returns {string} Formatted month/year string
 */
export function formatMonthYear(month, year, language = 'sl') {
  if (language === 'sl') {
    return `${month}/${year}`;
  } else {
    // For English, we might want to show month name
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[month - 1]} ${year}`;
  }
}

/**
 * Format percentage
 * @param {number} value - Value to format as percentage
 * @param {string} language - Language code
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage string
 */
export function formatPercentage(value, language = 'sl', decimals = 1) {
  const num = parseFloat(value) || 0;
  
  if (language === 'sl') {
    return `${num.toFixed(decimals).replace('.', ',')} %`;
  } else {
    return `${num.toFixed(decimals)}%`;
  }
}

/**
 * Validate and normalize language code
 * @param {string} language - Language code to validate
 * @returns {string} Normalized language code (sl or en)
 */
export function normalizeLanguage(language) {
  const supportedLanguages = ['sl', 'en'];
  const normalized = (language || 'sl').toLowerCase().substring(0, 2);
  return supportedLanguages.includes(normalized) ? normalized : 'sl';
}