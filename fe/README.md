# Zahoot Legal AI Trainer

AI-Powered training platform for top-tier law students built with Next.js 15.

## Features

- **Dashboard**: Track your learning progress and streaks
- **User Management**: Manage users and permissions (admin only)

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: Google Gemini API
- **Charts**: Recharts
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Gemini API Key

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Then edit `.env.local` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
/app                          # Next.js App Router
  /(auth)                     # Auth route group
    /login/page.tsx
    /signup/page.tsx
  /(dashboard)                # Protected route group
    /dashboard/page.tsx
    /users/page.tsx
    /settings/page.tsx
    layout.tsx                # Dashboard layout with sidebar
  layout.tsx                  # Root layout
  page.tsx                    # Home page (redirect)
  /api                       # API routes
    /gemini/route.ts         # Gemini service API route
/components                  # Shared components
  /ui                        # Reusable UI components
  /layout                    # Layout components
  /features                  # Feature-specific components
/lib                         # Utilities and helpers
  /services                  # Service layer
  /constants                 # Constants
  /types                     # TypeScript types
  /utils                     # Utility functions
/public                      # Static assets
/styles                      # Global styles
```

## Key Features

### Authentication
- Simple client-side authentication (can be upgraded to NextAuth.js)
- Protected routes using route groups

### API Routes
- API routes are available in `/app/api/` for future use

### Styling
- Tailwind CSS with custom brand colors
- Dark mode support
- Glass morphism effects
- Responsive design

## Development

### Adding New Features

1. Create components in `/components/features/`
2. Add types to `/lib/types/`
3. Add constants to `/lib/constants/`
4. Create API routes in `/app/api/` if needed
5. Create pages in `/app/(dashboard)/` for new routes

### Code Style

- Use TypeScript for all files
- Use `'use client'` directive for client components
- Use path aliases (`@/`) for imports
- Follow Next.js 15 best practices

## Environment Variables

- `GEMINI_API_KEY`: Your Google Gemini API key (required)

## License

© 2024 Zahoot Legal Brain
