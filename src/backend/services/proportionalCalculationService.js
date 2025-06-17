/**
 * Proportional Calculation Service
 * Handles rent and utility calculations based on actual occupancy periods
 */

/**
 * Get the number of days in a specific month and year
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @returns {number} - Number of days in the month
 */
export const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
};

/**
 * Calculate the number of days a tenant occupied a property in a specific month
 * @param {string|Date} moveInDate - Tenant move-in date (YYYY-MM-DD)
 * @param {string|Date|null} moveOutDate - Tenant move-out date (YYYY-MM-DD) or null if active
 * @param {number} year - Target year
 * @param {number} month - Target month (1-12)
 * @returns {number} - Number of occupied days in the month
 */
export const calculateOccupiedDays = (moveInDate, moveOutDate, year, month) => {
    // Convert dates to Date objects if they're strings
    const moveIn = new Date(moveInDate);
    const moveOut = moveOutDate ? new Date(moveOutDate) : null;
    
    // Create month boundaries
    const monthStart = new Date(year, month - 1, 1); // First day of month
    const monthEnd = new Date(year, month, 0); // Last day of month
    
    // Determine effective start and end dates for the month
    let effectiveStart = moveIn > monthStart ? moveIn : monthStart;
    let effectiveEnd = monthEnd;
    
    // If tenant moved out, use the earlier of move-out date or month end
    if (moveOut && moveOut < monthEnd) {
        effectiveEnd = moveOut;
    }
    
    // If tenant hasn't moved in yet during this month, return 0
    if (moveIn > monthEnd) {
        return 0;
    }
    
    // If tenant moved out before this month, return 0
    if (moveOut && moveOut < monthStart) {
        return 0;
    }
    
    // Calculate the difference in days (inclusive)
    const timeDiff = effectiveEnd.getTime() - effectiveStart.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    
    return Math.max(0, daysDiff);
};

/**
 * Calculate proportional rent for a tenant for a specific month
 * @param {number} monthlyRent - Full monthly rent amount
 * @param {string|Date} moveInDate - Tenant move-in date
 * @param {string|Date|null} moveOutDate - Tenant move-out date or null
 * @param {number} year - Target year
 * @param {number} month - Target month (1-12)
 * @returns {Object} - Calculation details including prorated amount
 */
export const calculateProportionalRent = (monthlyRent, moveInDate, moveOutDate, year, month) => {
    const totalDaysInMonth = getDaysInMonth(year, month);
    const occupiedDays = calculateOccupiedDays(moveInDate, moveOutDate, year, month);
    const dailyRate = monthlyRent / totalDaysInMonth;
    const proRatedAmount = dailyRate * occupiedDays;
    
    return {
        monthlyRent,
        totalDaysInMonth,
        occupiedDays,
        dailyRate: Math.round(dailyRate * 100) / 100, // Round to 2 decimal places
        proRatedAmount: Math.round(proRatedAmount * 100) / 100,
        isFullMonth: occupiedDays === totalDaysInMonth,
        occupancyPercentage: Math.round((occupiedDays / totalDaysInMonth) * 100)
    };
};

/**
 * Calculate person-days for utility allocation
 * @param {Array} tenants - Array of tenant objects with occupancy data
 * @param {number} year - Target year
 * @param {number} month - Target month (1-12)
 * @returns {Array} - Array of tenant objects with person-days calculations
 */
export const calculatePersonDays = (tenants, year, month) => {
    return tenants.map(tenant => {
        const occupiedDays = calculateOccupiedDays(tenant.move_in_date, tenant.move_out_date, year, month);
        return {
            ...tenant,
            occupiedDays,
            personDays: occupiedDays // 1 person * occupied days
        };
    });
};

/**
 * Calculate square-meter-days for utility allocation
 * @param {Array} tenants - Array of tenant objects with occupancy and room area data
 * @param {number} year - Target year
 * @param {number} month - Target month (1-12)
 * @returns {Array} - Array of tenant objects with sqm-days calculations
 */
export const calculateSqmDays = (tenants, year, month) => {
    return tenants.map(tenant => {
        const occupiedDays = calculateOccupiedDays(tenant.move_in_date, tenant.move_out_date, year, month);
        return {
            ...tenant,
            occupiedDays,
            sqmDays: (tenant.room_area || 0) * occupiedDays
        };
    });
};

/**
 * Handle edge cases and validate calculation inputs
 * @param {string|Date} moveInDate - Move-in date
 * @param {string|Date|null} moveOutDate - Move-out date
 * @param {number} year - Target year
 * @param {number} month - Target month
 * @returns {Object} - Validation result and any warnings
 */
export const validateCalculationInputs = (moveInDate, moveOutDate, year, month) => {
    const warnings = [];
    const errors = [];
    
    // Validate dates
    const moveIn = new Date(moveInDate);
    const moveOut = moveOutDate ? new Date(moveOutDate) : null;
    
    if (isNaN(moveIn.getTime())) {
        errors.push('Invalid move-in date');
    }
    
    if (moveOutDate && isNaN(moveOut.getTime())) {
        errors.push('Invalid move-out date');
    }
    
    if (moveOut && moveIn >= moveOut) {
        errors.push('Move-out date must be after move-in date');
    }
    
    // Validate month/year
    if (month < 1 || month > 12) {
        errors.push('Month must be between 1 and 12');
    }
    
    if (year < 2020 || year > 2050) {
        warnings.push('Year seems unusual, please verify');
    }
    
    // Check for same-day move scenarios
    if (moveOut && moveIn.getTime() === moveOut.getTime()) {
        warnings.push('Same-day move-in and move-out detected');
    }
    
    // Check for future dates
    const today = new Date();
    if (moveIn > today) {
        warnings.push('Move-in date is in the future');
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
};

/**
 * Get occupancy period description for reporting
 * @param {string|Date} moveInDate - Move-in date
 * @param {string|Date|null} moveOutDate - Move-out date
 * @param {number} year - Target year
 * @param {number} month - Target month
 * @returns {string} - Human-readable occupancy period
 */
export const getOccupancyPeriodDescription = (moveInDate, moveOutDate, year, month) => {
    const moveIn = new Date(moveInDate);
    const moveOut = moveOutDate ? new Date(moveOutDate) : null;
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    
    let startDate = moveIn > monthStart ? moveIn : monthStart;
    let endDate = monthEnd;
    
    if (moveOut && moveOut < monthEnd) {
        endDate = moveOut;
    }
    
    const formatDate = (date) => {
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };
    
    if (startDate.getTime() === monthStart.getTime() && endDate.getTime() === monthEnd.getTime()) {
        return `Full month (${formatDate(monthStart)} - ${formatDate(monthEnd)})`;
    }
    
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

export default {
    getDaysInMonth,
    calculateOccupiedDays,
    calculateProportionalRent,
    calculatePersonDays,
    calculateSqmDays,
    validateCalculationInputs,
    getOccupancyPeriodDescription
};