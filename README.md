# Domus - Home Management Application

Domus is a tablet-first, offline-first home management application built with Next.js. It helps household members manage domestic activities including chores, meal planning, grocery lists, tasks, and home improvement projects.

## Features

- **🏠 Dashboard**: Comprehensive overview of all household activities
- **🧹 Chores Manager**: Recurring household task tracking with assignments
- **🛒 Grocery List**: Shared shopping list with categories and checkboxes  
- **📅 Daily Planner**: Weekly calendar layout for household scheduling
- **✅ Task List**: Priority-based to-do management for general tasks
- **🔨 Home Projects**: Kanban-style project management (To Do/In Progress/Done)
- **🍽️ Meal Planner**: Daily meal organization with ingredient tracking
- **⏰ Reminders**: Time-based notifications with priority levels
- **👥 User Profiles**: Family member management with avatars and colors
- **⚙️ Settings**: Theme configuration, notifications, data export/import

## Technology Stack

- **Framework**: Next.js 15+ with App Router
- **Language**: TypeScript
- **Styling**: TailwindCSS with custom warm/cozy theme
- **UI Components**: ShadCN UI (Radix-based components)
- **Database**: IndexedDB via Dexie.js (offline-first storage)
- **Icons**: Lucide React
- **Notifications**: Sonner (toast notifications)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd domus

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

### Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Type checking
npm run type-check
```

## Architecture

### Design Principles
- **Tablet-first**: Optimized for 10-12" touchscreens
- **Offline-first**: All data stored locally in IndexedDB
- **Large touch targets**: Minimum 44px for accessibility
- **Warm color palette**: Orange/amber based with cozy feel
- **Clean typography**: Inter font with proper spacing

### Database Schema
The application uses Dexie.js for offline-first data storage with the following entities:

- **Users**: Family member profiles with avatars and colors
- **Chores**: Recurring household tasks with frequency and assignments
- **GroceryItems**: Shared shopping list with categories
- **Tasks**: One-off to-do items with priorities and due dates
- **HomeImprovements**: Kanban-style project management
- **Meals**: Meal planning with ingredient tracking
- **Reminders**: Time-based notifications
- **CalendarEvents**: Unified calendar view

### Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── chores/            # Chores management
│   ├── grocery/           # Grocery list
│   ├── planner/           # Daily/weekly planner
│   ├── tasks/             # General task list
│   ├── projects/          # Home improvement kanban
│   ├── meals/             # Meal planning
│   ├── reminders/         # Notifications/reminders
│   ├── users/             # User profiles
│   ├── settings/          # App configuration
│   ├── layout.tsx         # Root layout with navigation
│   ├── page.tsx           # Dashboard homepage
│   └── globals.css        # Custom theme and styles
├── components/
│   ├── ui/                # ShadCN UI components
│   └── Navigation.tsx     # Main sidebar navigation
└── lib/
    ├── db.ts              # Dexie database schema
    └── utils.ts           # Utility functions
```

## Usage

The application features a sidebar navigation optimized for tablet use with large touch targets. All modules include realistic mock data and are fully functional for household management:

1. **Home Dashboard**: Overview cards for all modules
2. **Chores Manager**: Assign and track recurring household tasks
3. **Grocery List**: Collaborative shopping list with categories
4. **Daily Planner**: Weekly calendar for household scheduling
5. **Task List**: Manage general to-do items with priorities
6. **Home Projects**: Track home improvement projects using Kanban boards
7. **Meal Planner**: Plan meals and track ingredients
8. **Reminders**: Set time-based notifications
9. **User Profiles**: Manage family members and view activity stats
10. **Settings**: Configure themes, notifications, and data management

## Development Guidelines

### Adding New Features
1. Create new page in `src/app/[module]/page.tsx`
2. Add route to navigation in `src/components/Navigation.tsx`
3. Update database schema in `src/lib/db.ts` if needed
4. Follow existing UI patterns and design system

### Database Operations
- Use Dexie.js for all data persistence
- Ensure all operations work offline
- Implement proper error handling for IndexedDB operations

### UI Components
- Use ShadCN components for consistency
- Maintain large touch targets (minimum 44px)
- Follow the warm/cozy design system
- Ensure responsive design for various tablet sizes

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the development guidelines
4. Run linting and type checking
5. Test on tablet-sized devices
6. Submit a pull request

## License

This project is licensed under the MIT License.