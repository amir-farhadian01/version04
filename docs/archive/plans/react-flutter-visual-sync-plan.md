> Naming reconciled 2026-08-16: BusinessPage.tsx is the canonical name.

# Plan: Make React Frontend Visually Identical to Flutter App

## Goal
Make the React frontend (port 5173) look **exactly** like the Flutter app (ports 7357/7359/7360) so they are visually indistinguishable. After this, we can edit the React version (easier to develop) and later mirror changes back to Flutter.

## Current State Analysis

### Flutter App Structure
- **Theme**: Dark theme with `AppColors` (bg: #0D0F1A, bg2: #131624, card: #1E2235, primary: #2B6EFF, secondary: #0FC98A, accent: #FF7A2B, etc.)
- **Phone Mockup**: `PhoneScaffold` wraps every screen in a 375x812 container with rounded corners (44px), border, shadow
- **StatusBar**: Shows "9:41", wifi icon, battery icon, optional notification bell with red dot
- **BottomNav**: Floating glassmorphic nav bar (blur effect, rounded 28px, positioned at bottom with 24px margin)
- **Screens**:
  1. `AuthScreen` - Login/SignUp tabs with email/phone/password fields
  2. `HomeScreen` - Header (location + greeting), week card, search, categories, services, news, events, score card
  3. `SocialScreen` - Explorer/Business Hub tabs, stories, posts with likes/comments/shares
  4. `ActivityScreen` - Activity list with icons and timestamps
  5. `ProfileScreen` - General tab (avatar, settings, security, appearance, upgrade) + Address & Cars tab
  6. `DashboardScreen` - Business dashboard with stats grid, appointments, orders, sidebar menu
  7. `BusinessProfileScreen` - Cover image, business info, package tabs, package cards

### React Frontend Current State
- **Theme**: Same CSS variables already defined in `index.css` matching Flutter's `AppColors`
- **Phone Mockup**: `PhoneContainer` already exists (375x812, rounded 44px, border, shadow)
- **StatusBar**: Already exists but uses SVG wifi/battery icons (different from Flutter's Material Icons)
- **BottomNav**: Exists but is a **sticky bottom bar** (not floating/glassmorphic like Flutter)
- **Pages**:
  1. `Login.tsx` - Email+password only (Flutter has Login/SignUp tabs)
  2. `HomeScreen.tsx` - Similar structure but different content/data
  3. `Explore.tsx` - Different from Flutter's SocialScreen (different tabs, different post structure)
  4. `Activity.tsx` - Different data and styling from Flutter's ActivityScreen
  5. `Profile.tsx` - Much simpler than Flutter's ProfileScreen (no tabs, no Address & Cars)
  6. `BusinessDashboard.tsx` - Different data and layout from Flutter's DashboardScreen
  7. Missing: `BusinessProfileScreen` (Flutter has it, React doesn't)

## Key Visual Differences to Fix

### 1. BottomNav (HIGH PRIORITY)
- **Flutter**: Floating glassmorphic bar with blur effect, rounded 28px, positioned 24px from bottom, horizontal padding 40px
- **React**: Sticky bottom bar with border-top, no glassmorphism, no blur

### 2. StatusBar (MEDIUM PRIORITY)
- **Flutter**: Uses Material Icons (`Icons.wifi`, `Icons.battery_full`, `Icons.notifications_outlined`)
- **React**: Uses custom SVG paths - should match Flutter's icon style

### 3. Auth Screen (HIGH PRIORITY)
- **Flutter**: Login/SignUp tabs, logo, welcome text, styled input fields with icons
- **React**: Email+password only, no tabs, different styling

### 4. Home Screen (MEDIUM PRIORITY)
- **Flutter**: Specific content (TD Bank, RBC, Vaughan news, Craft Festival events, "2,840 pts" score)
- **React**: Different content (AC Service, Home Cleaning, Austin location, "892" score)
- Need to match Flutter's exact content and layout

### 5. Social Screen (MEDIUM PRIORITY)
- **Flutter**: "Explorer" / "Business Hub" tabs, stories with gradient rings, posts with specific content
- **React**: "For You" / "Following" / "Nearby" tabs, different stories, different posts

### 6. Activity Screen (LOW PRIORITY)
- **Flutter**: Specific activity items (Mike's Plumbing, CleanPro, etc.)
- **React**: Different activity items - need to match Flutter's data

### 7. Profile Screen (HIGH PRIORITY)
- **Flutter**: Two tabs (General + Address & Cars), avatar with camera icon, settings tiles, dark/light mode switches, upgrade card, logout
- **React**: Single page, no tabs, simpler layout, no Address & Cars section

### 8. Dashboard Screen (MEDIUM PRIORITY)
- **Flutter**: "AutoFix Vaughan" branding, specific stats (5 appointments, $1,240 revenue), appointments with time blocks, orders
- **React**: "CleanPro Services" branding, different stats, different appointments

### 9. Business Profile Screen (NEW - missing in React)
- **Flutter**: Cover gradient, logo, business info, Packages/Inventory/Reviews/About tabs, package cards
- **React**: Missing entirely

## Implementation Phases

### Phase 0: Ports (Already Done)
- Port 7357: Flutter dev server (running)
- Port 7359: Flutter build web server (running)
- Port 7360: Flutter build web server (running)
- Port 5173: React dev server

### Phase 1: Fix Core UI Components
**Files to modify:**
- [`frontend/src/components/ui/phone/BottomNav.tsx`](frontend/src/components/ui/phone/BottomNav.tsx) - Rewrite to match Flutter's floating glassmorphic design
- [`frontend/src/components/ui/phone/StatusBar.tsx`](frontend/src/components/ui/phone/StatusBar.tsx) - Update icons to match Flutter's Material Icons style
- [`frontend/src/components/ui/phone/PhoneContainer.tsx`](frontend/src/components/ui/phone/PhoneContainer.tsx) - Minor adjustments if needed

**Flutter reference:**
- [`flutter_project/lib/widgets/bottom_nav.dart`](flutter_project/lib/widgets/bottom_nav.dart) - Floating nav with blur, rounded 28px, padding horizontal 40
- [`flutter_project/lib/widgets/status_bar.dart`](flutter_project/lib/widgets/status_bar.dart) - "9:41", wifi icon, battery icon, notification bell

### Phase 2: Rewrite Auth Screen
**Files to modify:**
- [`frontend/src/pages/auth/Login.tsx`](frontend/src/pages/auth/Login.tsx) - Rewrite to match Flutter's AuthScreen with Login/SignUp tabs

**Flutter reference:**
- [`flutter_project/lib/screens/auth_screen.dart`](flutter_project/lib/screens/auth_screen.dart) - Logo, welcome text, tabbed Login/SignUp, styled inputs

### Phase 3: Rewrite Home Screen
**Files to modify:**
- [`frontend/src/pages/public/HomeScreen.tsx`](frontend/src/pages/public/HomeScreen.tsx) - Match Flutter's exact content and layout

**Flutter reference:**
- [`flutter_project/lib/screens/home_screen.dart`](flutter_project/lib/screens/home_screen.dart) - Header with location, week card, search, categories (Building/Auto/Beauty/Transport/Health), services (TD Bank/RBC/etc.), news, events, score card

### Phase 4: Rewrite Social/Explore Screen
**Files to modify:**
- [`frontend/src/pages/public/Explore.tsx`](frontend/src/pages/public/Explore.tsx) - Rename/restructure to match Flutter's SocialScreen

**Flutter reference:**
- [`flutter_project/lib/screens/social_screen.dart`](flutter_project/lib/screens/social_screen.dart) - Explorer/Business Hub tabs, stories, posts with specific content

### Phase 5: Rewrite Activity Screen
**Files to modify:**
- [`frontend/src/pages/customer/Activity.tsx`](frontend/src/pages/customer/Activity.tsx) - Match Flutter's activity data and styling

**Flutter reference:**
- [`flutter_project/lib/screens/activity_screen.dart`](flutter_project/lib/screens/activity_screen.dart) - Activity list with icons, colors, timestamps

### Phase 6: Rewrite Profile Screen
**Files to modify:**
- [`frontend/src/pages/customer/Profile.tsx`](frontend/src/pages/customer/Profile.tsx) - Complete rewrite with two tabs (General + Address & Cars)

**Flutter reference:**
- [`flutter_project/lib/screens/profile_screen.dart`](flutter_project/lib/screens/profile_screen.dart) - Avatar with camera, settings tiles, security, appearance, upgrade, Address & Cars CRUD

### Phase 7: Rewrite Business Dashboard
**Files to modify:**
- [`frontend/src/pages/business/BusinessDashboard.tsx`](frontend/src/pages/business/BusinessDashboard.tsx) - Match Flutter's dashboard layout and data

**Flutter reference:**
- [`flutter_project/lib/screens/dashboard_screen.dart`](flutter_project/lib/screens/dashboard_screen.dart) - Stats grid, appointments with time blocks, orders, sidebar menu

### Phase 8: Create Business Profile Screen (NEW)
**Files to create:**
- [`frontend/src/pages/public/BusinessPage.tsx`](frontend/src/pages/public/BusinessPage.tsx) - New page matching Flutter's BusinessProfileScreen

**Flutter reference:**
- [`flutter_project/lib/screens/business_profile_screen.dart`](flutter_project/lib/screens/business_profile_screen.dart) - Cover, logo, business info, package tabs, package cards

### Phase 9: Update Routing
**Files to modify:**
- [`frontend/src/app/router.tsx`](frontend/src/app/router.tsx) - Add new routes for BusinessProfile, update navigation paths

### Phase 10: Verification
- Open both apps side-by-side
- Compare each screen visually
- Ensure identical appearance

## Key Design Tokens (Already Match!)
The CSS variables in [`frontend/src/index.css`](frontend/src/index.css) already match Flutter's `AppColors`:
- `--bg`: #0D0F1A ✓
- `--bg2`: #131624 ✓
- `--card`: #1E2235 ✓
- `--primary`: #2B6EFF ✓
- `--secondary`: #0FC98A ✓
- `--accent`: #FF7A2B ✓
- `--text`: #F0F2FF ✓
- `--text2`: #8B90B0 ✓
- `--text3`: #4A4F70 ✓
- `--border`: #2A2F4A ✓
- `--border2`: #363B5E ✓

Fonts also match: 'Space Grotesk' for headings, 'DM Sans' for body.

## Navigation Structure Mapping

| Flutter Route | React Route | Status |
|---|---|---|
| `/auth` | `/auth/login` | Exists, needs rewrite |
| `/home` | `/app/home` | Exists, needs rewrite |
| `/social` | `/app/social` | Exists (Explore.tsx), needs rewrite |
| `/activity` | `/app/activity` | Exists, needs rewrite |
| `/profile` | `/app/profile` | Exists, needs rewrite |
| `/dashboard` | `/business/:workspaceId` | Exists, needs rewrite |
| `/biz-profile` | `/services/:id` or new route | Missing, needs creation |

## BottomNav Item Mapping (Flutter → React)

| Flutter | React | Notes |
|---|---|---|
| Home (home icon) | Home (home icon) | Match |
| Social (people icon) | Social (people icon) | Match |
| Activity (auto_awesome_motion) | Activity (dashboard icon) | Different icon! |
| Business (business icon, isBiz) | Business (business icon, isBiz) | Match |
| - | Explore (explore icon) | Extra in React, remove or keep? |

**Decision**: Remove the "Explore" tab from React's BottomNav to match Flutter's 4-item nav (Home, Social, Activity, Business).
