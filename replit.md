# Overview

This is a medical inventory management system built as a full-stack web application for tracking medications. The system allows users to view, add, search, filter, and dispense medications with a focus on insulin types (rapid-acting, long-acting, intermediate, and other). It features a modern React frontend with a clean medical-themed UI and an Express.js backend with PostgreSQL database integration.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Components**: Shadcn/ui component library built on top of Radix UI primitives
- **Styling**: Tailwind CSS with custom medical-themed color variables and responsive design
- **State Management**: TanStack React Query for server state management and data fetching
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling

## Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js
- **API Design**: RESTful API with JSON responses and structured error handling
- **Data Validation**: Zod schemas for runtime type checking and API validation
- **Development Setup**: Custom Vite integration for development with hot module replacement

## Data Storage
- **Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM for type-safe database operations and migrations
- **Schema**: Single medications table with fields for medical information, quantities, and expiration tracking
- **Session Storage**: Connect-pg-simple for PostgreSQL-backed session storage

## Key Features
- **Medication Management**: CRUD operations for medication inventory
- **Search & Filter**: Real-time search by name and filtering by medication type
- **Dispensing System**: Quantity tracking with validation to prevent over-dispensing
- **Expiration Monitoring**: Date-based expiration tracking with visual indicators
- **Type Classification**: Color-coded medication types (rapid, long, intermediate, other)

## External Dependencies

- **Database**: Neon PostgreSQL serverless database
- **UI Libraries**: Radix UI primitives for accessible components
- **Development Tools**: Replit integration with cartographer plugin for enhanced development experience
- **Fonts**: Google Fonts integration (Architects Daughter, DM Sans, Fira Code, Geist Mono)
- **Icons**: Lucide React for consistent iconography throughout the application