/**
 * Query Adapter for PostgreSQL compatibility
 * Converts SQLite-specific queries to PostgreSQL equivalents
 */

/**
 * Database-specific query templates
 */
const queryTemplates = {
    sqlite: {
        systemTables: "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        systemTablesByName: "SELECT sql FROM sqlite_master WHERE name = ?",
        systemTableCount: "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'",
        dateFormatting: {
            yearMonth: "strftime('%Y-%m', ?)",
            year: "strftime('%Y', ?)",
            month: "strftime('%m', ?)",
            dateConstruct: "date(? || '-' || printf('%02d', ?) || '-01')",
            monthEnd: "date(? || '-' || printf('%02d', ?) || '-01', '+1 month', '-1 day')"
        },
        dateArithmetic: {
            monthsAgo: "datetime('now', '-' || ? || ' months')",
            currentDate: "date('now')",
            currentTimestamp: "CURRENT_TIMESTAMP"
        },
        patternMatching: {
            emsoValidation: "NEW.emso NOT GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'"
        }
    },
    postgresql: {
        systemTables: "SELECT table_name as name, '' as sql FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
        systemTablesByName: "SELECT '' as sql",
        systemTableCount: "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
        dateFormatting: {
            yearMonth: "to_char(?, 'YYYY-MM')",
            year: "EXTRACT(year FROM ?)",
            month: "EXTRACT(month FROM ?)",
            dateConstruct: "DATE(? || '-' || LPAD(CAST(? AS TEXT), 2, '0') || '-01')",
            monthEnd: "DATE(? || '-' || LPAD(CAST(? AS TEXT), 2, '0') || '-01') + INTERVAL '1 month' - INTERVAL '1 day'"
        },
        dateArithmetic: {
            monthsAgo: "CURRENT_TIMESTAMP - INTERVAL '1 month' * ?",
            currentDate: "CURRENT_DATE",
            currentTimestamp: "CURRENT_TIMESTAMP"
        },
        patternMatching: {
            emsoValidation: "NEW.emso !~ '^[0-9]{13}$'"
        }
    }
};

/**
 * Convert SQLite query to PostgreSQL equivalent
 */
export function convertQuery(query, dbType = 'postgresql') {
    if (dbType === 'sqlite' || dbType === 'file') {
        return query; // No conversion needed for SQLite
    }
    
    let convertedQuery = query;
    
    // System catalog queries
    convertedQuery = convertedQuery.replace(
        /SELECT\s+name,\s*sql\s+FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*'table'\s+AND\s+name\s+NOT\s+LIKE\s+'sqlite_%'/gi,
        queryTemplates.postgresql.systemTables
    );
    
    convertedQuery = convertedQuery.replace(
        /SELECT\s+sql\s+FROM\s+sqlite_master\s+WHERE\s+name\s*=\s*\?/gi,
        queryTemplates.postgresql.systemTablesByName
    );
    
    convertedQuery = convertedQuery.replace(
        /SELECT\s+COUNT\(\*\)\s+as\s+count\s+FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*["']table["']/gi,
        queryTemplates.postgresql.systemTableCount
    );
    
    // Date functions
    convertedQuery = convertedQuery.replace(
        /strftime\('%Y',\s*([^)]+)\)/gi,
        'EXTRACT(year FROM $1)'
    );
    
    convertedQuery = convertedQuery.replace(
        /strftime\('%m',\s*([^)]+)\)/gi,
        'EXTRACT(month FROM $1)'
    );
    
    convertedQuery = convertedQuery.replace(
        /strftime\('%Y-%m',\s*([^)]+)\)/gi,
        "to_char($1, 'YYYY-MM')"
    );
    
    // Date construction
    convertedQuery = convertedQuery.replace(
        /date\(([^)]+)\s*\|\|\s*'-'\s*\|\|\s*printf\('%02d',\s*([^)]+)\)\s*\|\|\s*'-01'\)/gi,
        "DATE($1 || '-' || LPAD(CAST($2 AS TEXT), 2, '0') || '-01')"
    );
    
    convertedQuery = convertedQuery.replace(
        /date\(([^)]+)\s*\|\|\s*'-'\s*\|\|\s*printf\('%02d',\s*([^)]+)\)\s*\|\|\s*'-01',\s*'\+1 month',\s*'-1 day'\)/gi,
        "DATE($1 || '-' || LPAD(CAST($2 AS TEXT), 2, '0') || '-01') + INTERVAL '1 month' - INTERVAL '1 day'"
    );
    
    // Date arithmetic
    convertedQuery = convertedQuery.replace(
        /datetime\('now',\s*'-(\d+)\s*months'\)/gi,
        "CURRENT_TIMESTAMP - INTERVAL '$1 months'"
    );
    
    convertedQuery = convertedQuery.replace(
        /datetime\('now',\s*'-'\s*\|\|\s*\?\s*\|\|\s*'\s*months'\)/gi,
        "CURRENT_TIMESTAMP - INTERVAL '1 month' * ?"
    );
    
    // Date defaults
    convertedQuery = convertedQuery.replace(
        /date\('now'\)/gi,
        'CURRENT_DATE'
    );
    
    // Pattern matching
    convertedQuery = convertedQuery.replace(
        /NOT\s+GLOB\s+'(\[[0-9\]]+)'/gi,
        "!~ '^[0-9]{13}$'"
    );
    
    return convertedQuery;
}

/**
 * Get database-specific query template
 */
export function getQueryTemplate(templateName, dbType = 'postgresql') {
    const templates = queryTemplates[dbType] || queryTemplates.postgresql;
    return templates[templateName] || templateName;
}

/**
 * Convert date construction queries
 */
export function convertDateQuery(year, month, dbType = 'postgresql') {
    if (dbType === 'sqlite' || dbType === 'file') {
        return `date('${year}-' || printf('%02d', ${month}) || '-01')`;
    }
    
    return `DATE('${year}-' || LPAD(CAST(${month} AS TEXT), 2, '0') || '-01')`;
}

/**
 * Convert month end date queries
 */
export function convertMonthEndQuery(year, month, dbType = 'postgresql') {
    if (dbType === 'sqlite' || dbType === 'file') {
        return `date('${year}-' || printf('%02d', ${month}) || '-01', '+1 month', '-1 day')`;
    }
    
    return `DATE('${year}-' || LPAD(CAST(${month} AS TEXT), 2, '0') || '-01') + INTERVAL '1 month' - INTERVAL '1 day'`;
}

/**
 * Convert occupancy date range queries
 */
export function getOccupancyDateRangeQuery(dbType = 'postgresql') {
    if (dbType === 'sqlite' || dbType === 'file') {
        return {
            moveInCheck: `AND move_in_date <= date(? || '-' || printf('%02d', ?) || '-01', '+1 month', '-1 day')`,
            moveOutCheck: `AND (move_out_date IS NULL OR move_out_date = '' OR move_out_date >= date(? || '-' || printf('%02d', ?) || '-01'))`
        };
    }
    
    return {
        moveInCheck: `AND move_in_date <= DATE(? || '-' || LPAD(CAST(? AS TEXT), 2, '0') || '-01') + INTERVAL '1 month' - INTERVAL '1 day'`,
        moveOutCheck: `AND (move_out_date IS NULL OR move_out_date = '' OR move_out_date >= DATE(? || '-' || LPAD(CAST(? AS TEXT), 2, '0') || '-01'))`
    };
}

/**
 * Convert dashboard date filtering queries
 */
export function getDashboardDateFilterQuery(months, dbType = 'postgresql') {
    if (dbType === 'sqlite' || dbType === 'file') {
        return `WHERE datetime(ue.year || '-' || printf('%02d', ue.month) || '-01') >= datetime('now', '-${months} months')`;
    }
    
    return `WHERE DATE(ue.year || '-' || LPAD(CAST(ue.month AS TEXT), 2, '0') || '-01') >= CURRENT_DATE - INTERVAL '${months} months'`;
}

/**
 * Convert strftime queries for date filtering
 */
export function getDateFilterQuery(field, format, dbType = 'postgresql') {
    if (dbType === 'sqlite' || dbType === 'file') {
        return `strftime('${format}', ${field}) = ?`;
    }
    
    switch (format) {
        case '%Y':
            return `EXTRACT(year FROM ${field}) = ?`;
        case '%m':
            return `EXTRACT(month FROM ${field}) = ?`;
        case '%Y-%m':
            return `to_char(${field}, 'YYYY-MM') = ?`;
        default:
            return `to_char(${field}, '${format}') = ?`;
    }
}

export default {
    convertQuery,
    getQueryTemplate,
    convertDateQuery,
    convertMonthEndQuery,
    getOccupancyDateRangeQuery,
    getDashboardDateFilterQuery,
    getDateFilterQuery
};