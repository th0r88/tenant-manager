# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-property tenant management system optimized for Slovenia with advanced utility allocation, PDF reporting, and production-grade database support.

**Core Features:**
- Multi-property portfolio management with complete data isolation
- Advanced utility allocation (per-person/per-sqm with proportional mid-month calculations)
- Professional PDF invoice generation with Slovenian Unicode support
- Real-time dashboard with revenue trends and occupancy analytics
- Slovenian compliance (EMŠO validation, tax numbers, localized formats)

## Architecture

### Tech Stack
- **Backend**: Node.js/Express with adapter-based database layer
- **Frontend**: React + Vite with DaisyUI/Tailwind CSS
- **Database**: SQLite (dev) or PostgreSQL (production) with automatic migrations
- **Internationalization**: i18next with Slovenian/English translations

### Directory Structure
```
src/
├── backend/
│   ├── config/           # Environment configuration
│   ├── database/         # Adapter pattern, schemas, migrations, constraints
│   ├── middleware/       # Error handling, validation
│   ├── routes/           # API endpoints (properties, tenants, utilities, reports, dashboard)
│   ├── services/         # Business logic (calculations, PDF, backups, occupancy tracking)
│   ├── tests/            # Vitest tests
│   └── utils/            # Precision math, EMŠO validation, logging, error recovery
└── frontend/
    ├── components/       # React UI (forms, lists, dashboard, modals)
    ├── context/          # Language context
    ├── hooks/            # Translation hooks, error handling
    ├── locales/          # sl.json, en.json translation files
    ├── services/         # API client (api.js)
    └── tests/            # Localization tests
```

### Key Services

**calculationService.js** - Utility allocation engine
- `calculateAllocations(utilityEntryId)`: Main allocation logic
- Per-person method: Person-days weighted allocation (people × occupied days)
- Per-sqm method: (HeatingCost ÷ HouseArea) × RoomArea × occupancy ratio
- Enforces 100% cost distribution with precision math
- Handles mid-month move-ins/move-outs automatically

**proportionalCalculationService.js** - Date range calculations
- `calculateOccupiedDays(moveInDate, moveOutDate, year, month)`: Days tenant occupied room
- Used for proportional rent and utility allocation

**pdfService.js** / **streamingPdfService.js** - PDF report generation
- Creates monthly invoices with rent + allocated utilities
- Slovenian Unicode support for proper diacritics
- QR code integration for payment slips
- Multilingual output (Slovenian/English)
- `streamingPdfService.js` streams large PDFs to avoid memory issues

**backupService.js** - Database backup automation
- Automatic scheduled backups (configurable interval)
- Integrity verification
- Retention management

**occupancyTrackingService.js** - Occupancy analytics
- Tracks tenant move-ins/move-outs
- Calculates effective occupancy rates
- Generates occupancy timelines

### Database Architecture

**Adapter Pattern** (`adapter.js`):
- Unified interface for SQLite/PostgreSQL/HTTP databases
- Automatic query translation ($1, $2 → ?, ? for SQLite)
- Connection pooling for PostgreSQL
- Migration and constraint management

**Core Tables**:
- `properties`: Multi-property support with house_area
- `tenants`: Full tenant info including move_in_date, move_out_date, occupancy_status
- `utility_entries`: Monthly utilities with allocation_method
- `tenant_utility_allocations`: Calculated allocations
- `billing_periods`: Custom billing periods tracking
- `occupancy_tracking`: Historical occupancy data

**Important**: Database uses parameterized queries. PostgreSQL uses `$1, $2` placeholders, SQLite uses `?` placeholders (adapter handles translation).

### Environment Configuration

Configuration managed via `environment.js` with three-layer hierarchy:
1. Default values
2. Environment variables (DATABASE_TYPE, DATABASE_HOST, etc.)
3. Local `config.json` file (optional)

**Key Environment Variables**:
- `DATABASE_TYPE`: 'file' (SQLite) or 'postgresql'
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME` (PostgreSQL)
- `DATABASE_USER`, `DATABASE_PASSWORD` (PostgreSQL)
- `BACKUP_INTERVAL`, `BACKUP_ENABLED`
- `NODE_ENV`: 'development' or 'production'

See `ENVIRONMENT-VARIABLES.md` for complete reference.

### Precision Math

All monetary calculations use `precisionMath.js` (Decimal.js wrapper) to avoid floating-point errors:
- `precisionMath.divide(a, b)` - Safe division
- `precisionMath.multiply(a, b)` - Safe multiplication
- Always returns Decimal instances, convert to float when storing

### Slovenian Localization

**EMŠO Validation** (`emsoValidator.js`):
- Validates Slovenian Unique Master Citizen Number
- Format: DDMMYYY + region code + sex digit + checksum
- Required for all tenants

**i18next Integration**:
- Translations in `src/frontend/locales/sl.json` and `en.json`
- Use `useTranslation()` hook in components
- PDF service uses `translationService.js` for backend translations

### Error Handling

**Three-Layer Error System**:
1. `errorHandler.js` middleware - Request validation, global error catching
2. `errorRecovery.js` - Circuit breakers, retry logic, graceful shutdown
3. `responseFormatter.js` - Standardized API responses (apiSuccess, apiError, apiList)

**Circuit Breaker Pattern**:
- Tracks failure rates for operations
- Automatically opens circuit on repeated failures
- Self-healing with configurable reset timeout

## Development Commands

### Essential Commands
```bash
npm run dev                      # Start full stack (backend:5999 + frontend:3000)
npm run server                   # Backend only
npm run build                    # Production build
npm run check                    # Build + health check
```

### Database Management
```bash
npm run backup                   # Create manual backup
npm run backup:restore          # Restore from backup
npm run backup:list             # List available backups
npm run backup:verify           # Verify database integrity
npm run backup:info             # Show backup info/stats
npm run backup:cleanup          # Remove old backups
npm run recalculate-allocations # Fix utility calculations
npm run verify-allocations      # Verify allocation totals
```

### Testing
```bash
npm test                        # Run all tests (requires vitest: npm i -D vitest)
npm run test:localization       # Translation completeness tests
npm run test:pdf-language       # PDF multilingual tests
npm run validate-translations   # Validate translation files
```

**Note**: `vitest` is used as the test runner but is not listed in `devDependencies`. Install it manually: `npm install -D vitest`

### Deployment
```bash
docker compose up -d            # Start with PostgreSQL
docker compose down             # Stop services
docker logs tenant-manager      # View application logs
docker logs postgres            # View database logs
```

## Development Guidelines

### Database Queries
- Use `db.query(sql, params)` for adapter compatibility
- PostgreSQL: `SELECT * FROM tenants WHERE id = $1`
- SQLite: `SELECT * FROM tenants WHERE id = ?` (adapter auto-converts)
- Always use parameterized queries (prevent SQL injection)

### Adding New Allocations
When adding allocation methods to `calculationService.js`:
1. Add to `allocation_method` CHECK constraint in schema
2. Implement in `calculateAllocations()`
3. Ensure 100% cost distribution
4. Use `precisionMath` for all calculations
5. Handle mid-month occupancy with `calculateOccupiedDays()`

### Adding Translations
1. Add keys to both `src/frontend/locales/sl.json` and `en.json`
2. Run `npm run validate-translations` to verify completeness
3. Use nested keys for organization (e.g., `tenant.form.name`)

### PDF Generation
- Font: 'Helvetica' (built-in, supports Latin Extended characters)
- Always test Slovenian characters (č, š, ž)
- Use `translationService.getTranslatedText()` for backend strings
- Stream responses for large PDFs to avoid memory issues

### Git Workflow
```bash
git add .
git commit -m "[descriptive message]"  # No "claude code" references
npm version patch                      # Bump version
git push origin [branch] --tags        # Push with tags
```

## API Endpoints

### Properties
- GET `/api/properties` - List all properties
- POST `/api/properties` - Create property
- PUT `/api/properties/:id` - Update property
- DELETE `/api/properties/:id` - Delete property

### Tenants
- GET `/api/tenants?property_id=X` - List tenants (filtered by property)
- POST `/api/tenants` - Create tenant
- PUT `/api/tenants/:id` - Update tenant
- DELETE `/api/tenants/:id` - Delete tenant

### Utilities
- GET `/api/utilities?property_id=X&month=Y&year=Z` - List utilities
- POST `/api/utilities` - Create utility entry (triggers allocation calculation)
- DELETE `/api/utilities/:id` - Delete utility

### Reports
- GET `/api/reports/:tenantId/:month/:year` - Download PDF report
- GET `/api/reports/batch` - Download batch PDFs (zip)

### Dashboard
- GET `/api/dashboard/revenue?property_id=X` - 12-month revenue data
- GET `/api/dashboard/occupancy?property_id=X` - Occupancy metrics

### Billing Periods
- GET `/api/billing-periods?property_id=X&status=Y&year=Z` - List billing periods
- POST `/api/billing-periods` - Create/update billing period
- PUT `/api/billing-periods/:id/finalize` - Finalize a billing period
- PUT `/api/billing-periods/:id/recalculate` - Recalculate a billing period
- GET `/api/billing-periods/:id/audit` - Get audit trail

### Occupancy Tracking
- GET `/api/occupancy-tracking/tenant/:id` - Tenant occupancy history
- GET `/api/occupancy-tracking/property/:id` - Property occupancy history
- GET `/api/occupancy-tracking/snapshot` - Current occupancy snapshot
- GET `/api/occupancy-tracking/monthly-stats` - Monthly occupancy statistics

## Testing Strategy

**Localization Tests** (`localization.test.js`):
- Verify translation key completeness
- Check for missing translations
- Validate nested key structures

**PDF Language Tests** (`pdfLanguage.test.js`):
- Test Slovenian/English PDF generation
- Verify Unicode character rendering
- Validate date formatting

**Run tests before commits**: `npm test`

## Production Deployment

### PostgreSQL Configuration
1. Set environment variables in `docker-compose.yml`
2. Database initialized with `init-postgres.sql`
3. Migrations applied automatically on startup
4. Constraints enforced via `constraints-postgres.sql`

### Health Monitoring
- `/api/health` - Basic health check
- `/api/status` - Full system status with circuit breaker info
- Automatic health checks every 30 minutes (configurable)

### Backup Strategy
- Automatic backups every 24 hours (default)
- 30-day retention
- Integrity verification on each backup
- Manual backup: `npm run backup`

## Troubleshooting

### Common Issues

**Allocation doesn't total 100%**:
- Check `precisionMath` usage in calculations
- Verify `calculateOccupiedDays()` logic
- Run `npm run verify-allocations`

**PDF Unicode issues**:
- Ensure UTF-8 encoding in pdfService
- Verify font supports Slovenian characters
- Test with `npm run test:pdf-language`

**Database connection errors**:
- Check DATABASE_TYPE matches infrastructure
- Verify PostgreSQL container is running: `docker ps`
- Check connection settings in environment.js

**Translation missing**:
- Run `npm run validate-translations`
- Add missing keys to both sl.json and en.json
- Rebuild: `npm run build`

## Key Design Patterns

**Adapter Pattern**: Database abstraction for SQLite/PostgreSQL portability
**Circuit Breaker**: Fault tolerance for external operations
**Precision Math**: Decimal.js prevents floating-point errors
**Proportional Allocation**: Person-days weighting for fair utility distribution
**Response Formatting**: Standardized API responses across all endpoints
