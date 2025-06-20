# Tenant Manager

A modern multi-property tenant management application for property managers in Slovenia.

## Features

- **Multi-Property Management**: Manage multiple properties with isolated data
- **Tenant Management**: Full CRUD operations for tenant information (EMŠO, tax numbers, rent)
- **Utility Cost Allocation**: Automatic allocation per person or per square meter
- **Monthly Reports**: PDF generation for tenant invoices
- **Dashboard Analytics**: Cross-property insights and revenue trends
- **Modern UI**: Professional interface built with DaisyUI and Tailwind CSS

## Tech Stack

- **Backend**: Node.js, Express, SQLite
- **Frontend**: React, Vite, DaisyUI, Tailwind CSS
- **PDF Generation**: PDFKit
- **Database**: SQLite with foreign key relationships

## Quick Start

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd tennants
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

This will start:
- Backend server on http://localhost:3001
- Frontend development server on http://localhost:3000

### Available Scripts

- `npm run dev` - Start both backend and frontend in development mode
- `npm run server` - Start only the backend server
- `npm run client` - Start only the frontend development server
- `npm run build` - Build frontend for production

## Project Structure

```
src/
├── backend/
│   ├── database/          # Database schema and initialization
│   ├── routes/           # API endpoints
│   └── services/         # Business logic (PDF generation, calculations)
└── frontend/
    ├── components/       # React components
    └── services/         # API client
```

## Database Schema

- **Properties**: Multi-property support with isolation
- **Tenants**: Complete tenant information with property association
- **Utility Entries**: Monthly utility costs with allocation methods
- **Tenant Utility Allocations**: Calculated allocations per tenant

## Features Overview

### Multi-Property Support
- Switch between properties seamlessly
- Data isolation per property
- Cross-property analytics dashboard

### Tenant Management
- Store complete tenant information (EMŠO, tax numbers)
- Room area and lease duration tracking
- Edit and delete with confirmation modals

### Utility Management
- Slovenian utility types (Elektrika, Voda, Ogrevanje, etc.)
- Two allocation methods: per person or per square meter
- Automatic calculation and distribution

### Reporting
- Monthly summary reports
- Individual tenant PDF invoices
- Revenue trends and analytics

## Contributing

1. Create a feature branch from `develop`
2. Make your changes
3. Submit a pull request

## License

Private project for property management in Slovenia.

Created with help of Claude Code