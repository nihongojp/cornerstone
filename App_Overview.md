# Cornerstone - App Overview

## 1. App Overview

**Cornerstone** (codename for the **NihonGo** nonprofit's Japanese language learning platform) is a comprehensive full-stack educational application designed to teach Japanese language and culture. The platform provides interactive lessons focused on Japanese prefectures, cultural facts, vocabulary, and language mastery through gamified learning experiences.

### Core Purpose
- **Japanese Language Learning**: Users progress through structured lessons covering vocabulary, characters, and pronunciation
- **Cultural Education**: Explore Japanese prefectures with interactive maps, cultural facts, and stories
- **Gamification**: Earn XP, achievements, and track progress across multiple learning modules
- **Interactive Exercises**: Engage with drag-and-drop activities, audio matching, dot-connection puzzles, and vocabulary quizzes

### Target Audience
- Students learning Japanese language and culture
- Language enthusiasts seeking immersive educational experiences
- Educators looking for gamified learning platforms
- Learners of all proficiency levels (beginner to intermediate)

---

## 2. Tech Stack

### Frontend (Client)
| Category | Technology | Purpose |
|----------|-----------|---------|
| **Framework** | React 19.0.0 | UI library and component management |
| **Language** | TypeScript 4.9 | Type-safe development |
| **Routing** | React Router DOM 7.1.1 | Client-side navigation |
| **UI Framework** | Material-UI (MUI) 6.4.11 | Pre-built component library |
| **Styling** | Emotion (@emotion/react, @emotion/styled) 11.14.0 | CSS-in-JS solution |
| **Icons** | MUI Icons 6.4.11, Lucide React 0.541.0 | Icon sets |
| **Animations** | Framer Motion 12.25.0 | Smooth animations and transitions |
| **HTTP Client** | Axios 1.7.9 | API communication |
| **Data Visualization** | D3.js 7.9.0 | Map rendering and interactive charts |
| **Calendar** | React Calendar 5.1.0 | Date selection UI |
| **Build Tool** | Create React App (react-scripts 5.0.1) | Zero-config React setup |

### Backend (Server)
| Category | Technology | Purpose |
|----------|-----------|---------|
| **Language** | TypeScript 5.7.3 | Type-safe server development |
| **Framework** | Express.js 4.21.1 | REST API server |
| **Database** | MongoDB 8.23.0, Mongoose | NoSQL database with ODM |
| **Authentication** | JWT (jsonwebtoken 9.0.2) | Secure token-based auth |
| **Password Security** | bcrypt/bcryptjs (6.0.0/3.0.3) | Password hashing |
| **CORS** | cors 2.8.5 | Cross-origin resource sharing |
| **Environment Config** | dotenv 16.4.7 | Environment variable management |
| **Body Parsing** | body-parser (built-in to Express) | JSON payload parsing |
| **Development** | nodemon 3.1.9, ts-node 10.9.2 | Hot reload and TS execution |

### DevOps & Build
- **Repository Structure**: Monorepo with separate `/client` and `/server` folders
- **Package Managers**: npm (Node 14.x or above)
- **Build Deployment**: Client builds to `/docs` folder for GitHub Pages hosting

---

## 3. Key Features

### User Authentication & Management
- ✅ User registration with email/password
- ✅ JWT-based authentication with token persistence in localStorage
- ✅ Password encryption using bcrypt
- ✅ Protected routes with RequireAuth guard
- ✅ User profile management (name, email, avatar initials)
- ✅ Cross-tab logout synchronization

### Learning Modules
- ✅ **Lessons**: Interactive lessons organized by Japanese prefectures
  - 47 prefecture-based curriculum units
  - Structured progression system
  - Achievement tracking with XP rewards
  
- ✅ **Vocabulary & Flashcards**: Study materials with spaced repetition support

- ✅ **Interactive Exercises**: Multiple exercise types:
  - Connect-the-dots (character tracing)
  - Audio-letter matching (pronunciation practice)
  - Vocabulary drag-and-drop
  
- ✅ **Watch**: Video content section for supplementary learning

- ✅ **Talk**: Discussion or speaking practice module

### Educational Content
- ✅ **Fun Facts**: Cultural and historical information about Japan
- ✅ **Resources**: External learning materials and references
- ✅ **Gallery**: Visual showcase of characters, prefectures, and cultural elements
- ✅ **Stories**: Narrative-driven cultural content (Story variants: D, G, V)
- ✅ **Character Info**: Detailed breakdowns of Japanese characters

### User Progress & Gamification
- ✅ Progress tracking across all lessons
- ✅ Achievement badges and XP system
- ✅ Lesson attempt history and scoring
- ✅ Review items for spaced repetition
- ✅ User dashboard with overview of all activities

### UI/UX Features
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Sticky navigation header
- ✅ Mobile-friendly hamburger menu
- ✅ Dynamic theme support via Material-UI
- ✅ Smooth animations with Framer Motion
- ✅ Interactive maps with D3.js visualization
- ✅ Real-time user authentication state management

---

## 4. Architecture & Directory Structure

### Project Layout

```
Cornerstone/
├── client/                          # React frontend application
│   ├── public/                      # Static assets
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   │   ├── Header.tsx           # Sticky navigation with auth menu
│   │   │   ├── Footer.tsx           # Page footer
│   │   │   ├── Navigation.tsx       # Navigation helper component
│   │   │   ├── DragDrop.tsx         # Drag-and-drop exercise component
│   │   │   ├── AudioMatch.tsx       # Audio matching exercise
│   │   │   ├── MatchDots.tsx        # Connect-the-dots exercise
│   │   │   ├── Flips.tsx            # Flip card component
│   │   │   ├── Fact.tsx             # Fact/info card component
│   │   │   ├── Rewards.tsx          # Achievement display component
│   │   │   ├── RewardInfo.tsx       # Reward information panel
│   │   │   ├── Menut.tsx            # Menu/navigation component
│   │   │   ├── ContentIntro.tsx     # Intro banner component
│   │   │   └── AuthProbe.tsx        # Auth status check component
│   │   ├── pages/                   # Page components (routes)
│   │   │   ├── Home.tsx             # Landing page
│   │   │   ├── AuthForm.tsx         # Login/signup form
│   │   │   ├── Dashboard.tsx        # Main lesson selector & map
│   │   │   ├── Lesson.tsx           # Interactive lesson player
│   │   │   ├── Watch.tsx            # Video content section
│   │   │   ├── Talk.tsx             # Discussion/speaking module
│   │   │   ├── Profile.tsx          # User profile page
│   │   │   ├── Resources.tsx        # Learning resources page
│   │   │   ├── FunFacts.tsx         # Cultural facts page
│   │   │   ├── Gallery.tsx          # Visual gallery page
│   │   │   ├── Stories.tsx          # Stories overview
│   │   │   ├── StoryD.tsx           # Story variant D
│   │   │   ├── StoryG.tsx           # Story variant G
│   │   │   ├── StoryV.tsx           # Story variant V
│   │   │   ├── CharInfo.tsx         # Character information page
│   │   │   └── AvatarInfo.tsx       # Avatar/user info page
│   │   ├── services/                # API & utility services
│   │   │   ├── api.ts               # Axios HTTP client + interceptors
│   │   │   ├── auth.ts              # Authentication helpers
│   │   │   ├── lessons.ts           # Lesson API calls
│   │   │   └── progress.ts          # User progress API calls
│   │   ├── data/                    # Static data files
│   │   │   ├── characters.ts        # Japanese character data
│   │   │   └── lessonData.ts        # Lesson configuration
│   │   ├── App.tsx                  # Root component with routing
│   │   ├── index.tsx                # React entry point
│   │   ├── theme.ts                 # MUI theme configuration
│   │   └── App.css                  # Global styles
│   ├── package.json                 # Frontend dependencies
│   └── tsconfig.json                # TypeScript configuration
│
├── server/                          # Express.js backend application
│   ├── src/
│   │   ├── controllers/             # Business logic & handlers
│   │   ├── routes/                  # API endpoint definitions
│   │   │   ├── authRoutes.ts        # /api/auth endpoints
│   │   │   ├── userRoutes.ts        # /api/user endpoints
│   │   │   ├── lessonRoutes.ts      # /api/lessons endpoints
│   │   │   ├── attemptsRoutes.ts    # /api/attempts endpoints
│   │   │   ├── progressRoutes.ts    # /api/progress endpoints
│   │   │   ├── reviewRoutes.ts      # /api/review endpoints
│   │   │   ├── resourceRoute.ts     # /api/resources endpoints
│   │   │   └── galleryRoutes.ts     # /api/gallery endpoints (unused)
│   │   ├── models/                  # Mongoose schemas & types
│   │   │   ├── user.ts              # User document schema
│   │   │   ├── Lesson.ts            # Lesson document schema
│   │   │   ├── Attempt.ts           # Lesson attempt tracking
│   │   │   ├── UserProgress.ts      # User progress document
│   │   │   ├── ReviewItem.ts        # Spaced repetition items
│   │   │   ├── Resource.ts          # Learning resources
│   │   │   ├── Unit.ts              # Curriculum units
│   │   │   └── Gallery.ts           # Gallery items (empty)
│   │   ├── db/                      # Database connection
│   │   │   └── db.ts                # MongoDB connection setup
│   │   ├── middleware/              # Express middleware
│   │   ├── types/                   # Shared TypeScript types
│   │   ├── utils/                   # Utility functions
│   │   └── server.ts                # Express app initialization
│   ├── dist/                        # Compiled JavaScript output
│   ├── package.json                 # Backend dependencies
│   └── tsconfig.json                # TypeScript configuration
│
├── docs/                            # GitHub Pages deployment folder
├── .gitignore                       # Git ignore rules
├── package-lock.json                # Dependency lock file
└── README.md                        # Project README

```

### Directory Purposes

| Directory | Purpose |
|-----------|---------|
| **client/src/components** | Reusable React components used across multiple pages (Header, exercises, UI elements) |
| **client/src/pages** | Full-page components mapped to routes; each represents a unique view/feature |
| **client/src/services** | API client (Axios config), authentication helpers, and data-fetching utilities |
| **client/src/data** | Static JSON/TS data files for characters, lessons, and configuration |
| **server/src/models** | Mongoose schemas defining the database structure |
| **server/src/routes** | Express route handlers organizing endpoints by feature domain |
| **server/src/controllers** | Business logic extracted from routes (typically empty in this project) |
| **server/src/db** | Database connection and initialization code |

---

## 5. Setup & Installation

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 14.x or above) — [Download](https://nodejs.org/)
- **npm** (comes with Node.js) — verify with `npm --version`
- **MongoDB Atlas** or local MongoDB instance — [MongoDB Atlas](https://www.mongodb.com/atlas/database)
- **Git** — [Download](https://git-scm.com/)
- **A code editor** (VS Code recommended) — [Download](https://code.visualstudio.com/)

### Step 1: Clone the Repository

```bash
git clone https://github.com/Sachi2631/Cornerstone.git
cd Cornerstone
```

### Step 2: Install Backend Dependencies

```bash
cd server
npm install
```

### Step 3: Install Frontend Dependencies

```bash
cd ../client
npm install
```

Or install both at once from the root directory (if a root package.json exists):

```bash
cd ..
npm install
```

### Step 4: Configure Environment Variables

#### Server Environment (`.env` in `server/` folder)

Create a `.env` file in the `server` directory with the following variables:

```env
# MongoDB Connection String
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/cornerstone?retryWrites=true&w=majority

# Server Port (optional, defaults to 5001)
PORT=5001

# JWT Secret (optional, use a strong random string in production)
JWT_SECRET=your_jwt_secret_key_here
```

**How to get MONGO_URI:**
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas/database)
2. Create a free cluster
3. Set up authentication (username & password)
4. Click "Connect" → "Drivers" → copy the connection string
5. Replace `<username>` and `<password>` with your credentials

#### Client Environment (`.env` in `client/` folder)

Create a `.env` file in the `client` directory:

```env
# Backend API Base URL
# For development (local backend):
REACT_APP_API_BASE_URL=http://localhost:5001

# For production (remote backend):
# REACT_APP_API_BASE_URL=https://your-api-domain.com
```

> **Note**: CRA uses `REACT_APP_*` prefix for environment variables. Variables without this prefix are ignored.

### Step 5: Run the Application Locally

#### Start the Backend Server

```bash
cd server
npm run dev
```

This starts the server in development mode with hot-reload via `nodemon` on port `5001`.

Expected output:
```
Server is running on port 5001
Database connected
```

#### Start the Frontend Development Server

In a new terminal:

```bash
cd client
npm start
```

This opens the app in your default browser at `http://localhost:3000`.

Expected behavior:
- Page auto-reloads when you make code changes
- Console shows lint errors and HTTP requests

### Step 6: Verify Everything Works

1. Navigate to `http://localhost:3000` in your browser
2. You should see the Nihon-Go! landing page
3. Click **"Get Started"** to proceed to the auth form
4. Sign up with a test email and password
5. After signup, you should be redirected to the Dashboard

---

## 6. Component Breakdown

### Layout Components

#### **Header** (`client/src/components/Header.tsx`)
- **Responsibility**: Main navigation bar with branding, menu, and user authentication UI
- **Features**:
  - Logo/branding link to home
  - Desktop navigation buttons (Dashboard, Watch, Talk, Lessons)
  - Mobile hamburger menu with drawer
  - User avatar with profile/logout menu
  - Auth status detection (shows "Get Started" when logged out)
  - Cross-tab logout synchronization
  - Fetches user info from `/api/auth/me` endpoint
- **Props**: None (uses hooks: `useNavigate`, `useLocation`, `useTheme`)
- **State**: `me` (user data), `authToken` (JWT), `anchorEl` (menu anchor), `drawerOpen` (mobile menu)

#### **Footer** (`client/src/components/Footer.tsx`)
- **Responsibility**: Page footer with links and branding
- **Features**: Social media links, copyright info, help/contact links
- **Visibility**: Hidden on Dashboard and Lesson pages

#### **Navigation** (`client/src/components/Navigation.tsx`)
- **Responsibility**: Helper component for navigation links
- **Usage**: Reusable nav button renderer

---

### Exercise Components

#### **DragDrop** (`client/src/components/DragDrop.tsx`)
- **Responsibility**: Drag-and-drop vocabulary exercise
- **Features**:
  - Drag items from a list to correct positions
  - Shuffle and reset functionality
  - Immediate feedback (correct/incorrect)
  - Score tracking
  - Keyboard accessibility
- **Used in**: Lesson module for vocabulary practice

#### **AudioMatch** (`client/src/components/AudioMatch.tsx`)
- **Responsibility**: Audio matching exercise (hear sound, select correct option)
- **Features**:
  - Play audio pronunciation
  - Multiple-choice selection
  - Score tracking
  - Reset and retry
- **Used in**: Lesson module for listening comprehension

#### **MatchDots** (`client/src/components/MatchDots.tsx`)
- **Responsibility**: Connect-the-dots character tracing exercise
- **Features**:
  - Click/tap dots in order to trace character strokes
  - Validation of correct sequence
  - Score calculation
  - Visual feedback
- **Used in**: Lesson module for character writing practice

#### **Flips** (`client/src/components/Flips.tsx`)
- **Responsibility**: Flip card component for flashcard-style review
- **Features**:
  - Click to flip between question/answer
  - Multiple cards in sequence
  - Progress counter
- **Used in**: Lesson module for vocabulary review

---

### UI & Info Components

#### **Rewards** (`client/src/components/Rewards.tsx`)
- **Responsibility**: Display achievement badges and XP earned
- **Features**:
  - Show XP points
  - Display achievement title
  - Animations for earned rewards
- **Used in**: Lesson completion screens

#### **RewardInfo** (`client/src/components/RewardInfo.tsx`)
- **Responsibility**: Detailed reward information panel
- **Features**: List of earned badges, XP breakdown
- **Used in**: User profile and progress tracking

#### **Fact** (`client/src/components/Fact.tsx`)
- **Responsibility**: Display cultural fact cards
- **Features**: Formatted fact text, related prefecture info
- **Used in**: Fun Facts page

#### **Menut** (`client/src/components/Menut.tsx`)
- **Responsibility**: Menu/navigation component for lesson selection
- **Features**: List of available lessons/prefectures, click to select
- **Used in**: Dashboard

#### **ContentIntro** (`client/src/components/ContentIntro.tsx`)
- **Responsibility**: Intro/header banner for lesson content
- **Features**: Title, description, visual styling
- **Used in**: Various lesson pages

#### **AuthProbe** (`client/src/components/AuthProbe.tsx`)
- **Responsibility**: Check authentication status and handle redirects
- **Features**: Validates JWT token, redirects if unauthorized
- **Used in**: Protected route validation

---

### Page Components (Routes)

#### **Home** (`client/src/pages/Home.tsx`)
- **Route**: `/`
- **Purpose**: Landing page with introduction and call-to-action
- **Features**: Hero section, feature highlights, signup prompt

#### **AuthForm** (`client/src/pages/AuthForm.tsx`)
- **Route**: `/auth`, `/login`, `/signup`
- **Purpose**: User authentication (login & signup)
- **Features**:
  - Tab-based login/signup forms
  - Email & password validation
  - JWT token storage
  - Redirect to dashboard on success
  - Error handling and messages

#### **Dashboard** (`client/src/pages/Dashboard.tsx`)
- **Route**: `/dashboard` (protected)
- **Purpose**: Main hub showing all available lessons
- **Features**:
  - Interactive map of Japan with all 47 prefectures
  - Lesson cards with progress indicators
  - Visual prefecture grouping
  - Click prefecture to start lesson
  - D3.js map integration

#### **Lesson** (`client/src/pages/Lesson.tsx`)
- **Route**: `/lesson/:lessonId` (protected)
- **Purpose**: Interactive lesson player
- **Features**:
  - Load and display lesson content by prefecture
  - Render exercises dynamically (drag-drop, audio, dots)
  - Track user attempts and score
  - Award XP and achievements
  - Save progress to backend
  - Navigation between exercises

#### **Watch** (`client/src/pages/Watch.tsx`)
- **Route**: `/watch` (protected)
- **Purpose**: Video content library
- **Features**: Video player, playlist, supplementary learning materials

#### **Talk** (`client/src/pages/Talk.tsx`)
- **Route**: `/talk` (protected)
- **Purpose**: Discussion or speaking practice module
- **Features**: Conversation prompts, speaking exercises

#### **Profile** (`client/src/pages/Profile.tsx`)
- **Route**: `/profile` (protected)
- **Purpose**: User profile and progress dashboard
- **Features**:
  - Display user info (name, email, avatar)
  - Show learning statistics (lessons completed, XP earned)
  - Display achievements and badges
  - Edit profile (if implemented)
  - Progress timeline

#### **Resources** (`client/src/pages/Resources.tsx`)
- **Route**: `/resources`
- **Purpose**: Curated learning resources and external links
- **Features**:
  - List of recommended textbooks, websites, apps
  - Resource filtering by category
  - External link management

#### **FunFacts** (`client/src/pages/FunFacts.tsx`)
- **Route**: `/funfacts`
- **Purpose**: Cultural facts and trivia about Japan
- **Features**:
  - Fact cards with cultural/historical information
  - Filtering by prefecture or topic
  - Share facts functionality

#### **Gallery** (`client/src/pages/Gallery.tsx`)
- **Route**: `/gallery`
- **Purpose**: Visual showcase of characters, prefectures, and cultural content
- **Features**:
  - Image grid or carousel view
  - Click to view details
  - Filter by category

#### **Stories** (`client/src/pages/Stories.tsx`)
- **Route**: `/stories`
- **Purpose**: Narrative-driven cultural content
- **Features**: Story selection, reading interface

#### **CharInfo** (`client/src/pages/CharInfo.tsx`)
- **Route**: `/characters/:id`
- **Purpose**: Detailed information about Japanese characters
- **Features**:
  - Character breakdown (hiragana, katakana, kanji)
  - Pronunciation guide
  - Usage examples
  - Writing strokes animation

---

### Service Layer (API & Utilities)

#### **api.ts** (`client/src/services/api.ts`)
- **Purpose**: Centralized HTTP client with Axios configuration
- **Key Features**:
  - Base URL resolution (localhost vs. production)
  - JWT token management (get, set, clear)
  - Request interceptor: auto-attach Bearer token
  - Response interceptor: handle 401 Unauthorized (redirect to auth)
  - Legacy path rewriting (/lessons → /api/lessons)
  - Logging for debugging
- **Exported Functions**:
  - `getToken()` - Retrieve JWT from localStorage
  - `setToken(token)` - Store JWT in localStorage
  - `clearToken()` - Remove JWT
  - `isAuthed()` - Check if user is authenticated
  - `json<T>(path, init?)` - Generic fetch wrapper
  - `fetchJSON<T>(url, init)` - Alternative fetch
  - `safe(fn)` - Wrap async function for safe execution

#### **auth.ts** (`client/src/services/auth.ts`)
- **Purpose**: Authentication-related utilities
- **Functions**: Login, signup, logout helpers

#### **lessons.ts** (`client/src/services/lessons.ts`)
- **Purpose**: Lesson data fetching and management
- **Functions**: Fetch lessons, get lesson details, fetch exercises

#### **progress.ts** (`client/src/services/progress.ts`)
- **Purpose**: User progress tracking
- **Functions**: Fetch user progress, save attempt, get achievements

---

### Data Files

#### **characters.ts** (`client/src/data/characters.ts`)
- **Purpose**: Static data for Japanese characters
- **Content**: Hiragana, katakana, kanji with pronunciation and meanings

#### **lessonData.ts** (`client/src/data/lessonData.ts`)
- **Purpose**: Lesson configuration and metadata
- **Content**: Lesson titles, descriptions, exercise templates

---

## Backend API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info

### Users (`/api/user`)
- `GET /api/user/profile` - User profile data
- `PUT /api/user/profile` - Update user profile

### Lessons (`/api/lessons`)
- `GET /api/lessons` - List all lessons
- `GET /api/lessons/:id` - Get lesson details
- `GET /api/lessons/:id/exercises` - Get exercises for lesson

### Attempts (`/api/attempts`)
- `POST /api/attempts` - Record lesson attempt
- `GET /api/attempts` - Get user's attempt history

### Progress (`/api/progress`)
- `GET /api/progress` - Get user's overall progress
- `POST /api/progress/save` - Save progress

### Review (`/api/review`)
- `GET /api/review/items` - Get items for review
- `POST /api/review/update` - Update review status

### Resources (`/api/resources`)
- `GET /api/resources` - List learning resources

---

## Development Workflow

### Building for Production

#### Frontend Build
```bash
cd client
npm run build
```
This creates an optimized production build in `client/build/`, then moves it to `../docs/` for GitHub Pages.

#### Backend Build
```bash
cd server
npm run build
```
This compiles TypeScript to JavaScript in `server/dist/`.

### Running Tests
```bash
cd client
npm test

cd ../server
npm test
```

### Debugging

**Frontend**:
- Use Chrome DevTools (F12)
- Check browser console for HTTP requests/responses
- React DevTools extension for component inspection

**Backend**:
- Check server console logs for errors
- Use `npm run dev` for hot-reload debugging
- MongoDB Atlas dashboard to inspect database

---

## Common Issues & Troubleshooting

### Issue: "Cannot GET /api/..." (404 errors)
**Solution**: Ensure backend server is running and `REACT_APP_API_BASE_URL` points to correct server URL.

### Issue: "401 Unauthorized" errors
**Solution**: Clear localStorage and re-login. Check JWT token expiration and backend JWT_SECRET.

### Issue: MongoDB connection fails
**Solution**: Verify `MONGO_URI` is correct, whitelist your IP in MongoDB Atlas, and check credentials.

### Issue: CORS errors in browser console
**Solution**: Ensure backend has CORS enabled. Check that `origin: true` is set in the cors middleware.

### Issue: Port already in use
**Solution**: Change the port in `.env` (backend) or kill the process using the port:
```bash
# macOS/Linux
lsof -i :5001
kill -9 <PID>

# Windows
netstat -ano | findstr :5001
taskkill /PID <PID> /F
```

---

## Project Statistics

- **Total TypeScript Files**: 98.9% of repository
- **Frontend Components**: 13 reusable components
- **Frontend Pages**: 15 page routes
- **Backend Models**: 8 Mongoose schemas
- **API Endpoints**: 20+ RESTful endpoints
- **Prefectures**: 47 Japanese prefectures covered

---

## Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express.js Guide](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Material-UI Components](https://mui.com/material-ui/getting-started/)
- [D3.js Documentation](https://d3js.org/)

---

## License & Credits

**Project**: Cornerstone (Nihon-Go!)  
**Repository**: [Sachi2631/Cornerstone](https://github.com/Sachi2631/Cornerstone)  
**Language Composition**: 98.9% TypeScript, 1.1% Other

---

**Last Updated**: June 2026  
**Documentation Version**: 1.0
