# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a tenant management MVP application for property management. The app allows property owners to:
- Store tenant information (name, surname, address, EMŠO, tax number, rent, lease duration)
- Enter monthly utility costs and allocate them between tenants using different methods (per person or per square meter)
- Generate PDF reports for each tenant showing rent + allocated utilities

## Architecture

**Full-stack application with:**
- **Backend**: Node.js/Express API with SQLite database
- **Frontend**: React application built with Vite
- **Database**: SQLite with three main tables: tenants, utility_entries, tenant_utility_allocations
- **PDF Generation**: Service for creating monthly tenant reports

**Key Services:**
- `calculationService.js`: Handles utility cost allocation logic (per person vs per square meter)
- `pdfService.js`: Generates monthly PDF reports combining rent + utilities
- `api.js`: Frontend service layer for backend communication

## Development Stages

The project follows a 5-stage development plan (see MVP-roadmap.md):
1. Foundation Setup (package.json, database schema, Express server)
2. Tenant Management (CRUD operations, forms, API endpoints)  
3. Utility Cost System (utility entry, cost allocation)
4. Report Generation (PDF service, report calculations)
5. Integration & Polish (end-to-end testing, styling)

## Database Schema

- **tenants**: id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area
- **utility_entries**: id, month, year, utility_type, total_amount, allocation_method
- **tenant_utility_allocations**: id, tenant_id, utility_entry_id, allocated_amount

## Slovenian-specific Fields

- **EMŠO**: Slovenian Unique Master Citizen Number (required for all tenants)
- All forms and reports should accommodate Slovenian address formats and tax requirements