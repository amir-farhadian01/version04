# Profile Page Redesign — React (5173) + Flutter (7357)

> Created: 2026-05-31T05:37:09.105Z
> Total tasks: 14

---

## TASK 1: Analyze reference screenshot with image-vision

Use MCP tool `analyze_image` from server `image-vision` to analyze `screenshots/3333.jpg`.

Prompt to use:
"This is a screenshot of a mobile app profile/account page. Analyze in detail: the color theme (dark mode colors), icon style (line icons, thickness), layout structure (header, menu items, sections), spacing between items, and overall design patterns. Output a concise summary useful for implementation."

Save the analysis result for reference in tasks 4 and 8.

---

## TASK 2: Read current source code (both platforms)

Read these files:
- frontend/src/pages/customer/Profile.tsx (all 667 lines)
- flutter_project/lib/screens/profile_screen.dart (all 780 lines)
- frontend/src/app/router.tsx (all 126 lines)
- frontend/tailwind.config.ts
- frontend/src/store/authStore.ts
- flutter_project/pubspec.yaml (check available icon packages)

Understand the current structure before modifying.

---

## TASK 3: React: Remove fake StatusBar + redundant back label

Edit `frontend/src/pages/customer/Profile.tsx`:

1. Remove the `import { StatusBar } from '../../components/ui/phone/StatusBar'` line at top
2. Remove the `<StatusBar />` JSX component from the rendered output (it's the first element in the return)
3. Remove the "Profile" text label from the top area (find and delete the back button text containing 'Profile')
4. Keep only the back arrow icon if it exists, or remove the entire back button row since bottom nav handles navigation

Verify: The fake "9:41" time, Wi-Fi icon, battery icon, antenna icon are gone from the page.

---

## TASK 4: React: Reorganize menu into 3 grouped sections with accordion

Edit `frontend/src/pages/customer/Profile.tsx`:

Replace the flat menu list with 3 grouped sections:

**Section 1 — "MY SERVICES"** (header: uppercase, 13px, #888, letter-spacing 0.8, with divider line)
- My Appointments (calendar icon) → navigate to /app/appointments
- Saved Businesses (heart icon) → navigate to /app/saved
- Payments & Wallet (wallet icon) → navigate to /app/payments

**Section 2 — "PERSONAL INFO"** (EXPANDABLE ACCORDION, collapsed by default)
- Add a chevron-expandable accordion container
- When tapped, smoothly animate open (CSS transition max-height + opacity)
- Inside: My Addresses (location pin icon), My Cars (car icon) with staggered fade-in (animation-delay 50ms each)
- Keep the existing address/car management modals — just move them inside this section

**Section 3 — "SETTINGS & SUPPORT"**
- Notifications (bell icon + red badge pill "3")
- Help & Support (question mark icon)
- Clear Cache (trash icon)

Keep bottom section (Settings + Logout) as-is.

Style each menu item:
- Row with: icon container (44x44, rounded-12, bg colored per section) on left, text, chevron-right on right
- Icon container backgrounds: blue (#4F46E5/10) for Services, purple (#7C3AED/10) for Personal Info
- Divider between items within same section
- Tap state: active:scale-[0.98] transition

---

## TASK 5: React: Add Share Profile button + Share Dialog

Edit `frontend/src/pages/customer/Profile.tsx`:

1. Add a "Share Profile" button (share icon) positioned as a small floating action button on the bottom-right of the avatar card

2. When tapped, open a Share Dialog (modal) with these options:

**Option A — QR Code (Primary)**
- Generate a QR code encoding `neighborly://user/{USER_ID}` using a lightweight QR library (use `qrcode` npm package if available, or inline SVG QR generator)
- Center the QR code prominently in the dialog
- Show user's name/ID below the QR code

**Option B — Copy Profile ID**
- Button that copies the user's profile link to clipboard via `navigator.clipboard.writeText()`
- Show temporary "Copied!" toast on success

**Option C — Native Share (Web Share API)**
- Only show if `navigator.share` is available (mobile Chrome/Safari)
- Share content: "Add me on Neighborly! My profile: neighborly://user/{USER_ID}"

Add graceful degradation: hide options that aren't available on the current device.

Create the ShareDialog as a separate component at `frontend/src/components/ShareProfileDialog.tsx`.

---

## TASK 6: React: UX enhancements — avatar glow, section headers, animations

Edit `frontend/src/pages/customer/Profile.tsx`:

**Avatar Section (top of screen, before menu):**
- Move avatar to top, centered (mx-auto)
- Increase size to 96x96px
- Add a subtle glow ring: box-shadow: 0 0 20px rgba(79,70,229,0.3) around the avatar
- Add pulse animation (2s loop): `@keyframes pulse-glow { 0%,100% { box-shadow: 0 0 10px rgba(79,70,229,0.2) } 50% { box-shadow: 0 0 25px rgba(79,70,229,0.4) } }`
- Display name centered below avatar (text-xl, bold)
- Email below name (text-sm, text-nh-text-muted)
- Edit button (pencil icon) next to name

**Section Headers:**
- Uppercase (uppercase class)
- Font size: 13px
- Color: #888888 (text-nh-text-muted or custom)
- Letter-spacing: tracking-[0.8px] or style
- Small divider line below (border-b border-nh-border with padding)

**Animations:**
- Page enters with staggered fade-up: each section starts with opacity-0 translate-y-4, then transitions to opacity-100 translate-y-0
- Use CSS animation with animation-delay (section 1: 0ms, section 2: 100ms, section 3: 200ms)

**Menu Item Tap State:**
- Add `active:scale-[0.98] transition-transform duration-150` to each menu item button
- Add hover:bg-nh-surface-hover

Remove the 'Profile' back label text from the top area.

---

## TASK 7: Flutter: Remove fake status bar + redundant back label

Edit `flutter_project/lib/screens/profile_screen.dart`:

1. Remove the `import '../widgets/status_bar.dart';` line
2. Remove the `StatusBar()` widget from the build method (it's in the Stack > Positioned at top)
3. In the AppBar, remove the "Profile" text title — keep only the Settings gear icon button
4. Remove or simplify the back button/arrow

Build method structure should become:
```dart
Scaffold(
  appBar: AppBar(
    title: Text('My Profile'), // keep this
    actions: [Settings icon button],
  ),
  body: ... // profile content without StatusBar
)
```

Verify: The mock "9:41" time, Wi-Fi icon, battery icon, and antenna icon are gone.

---

## TASK 8: Flutter: Reorganize menu into 3 grouped sections with accordion

Edit `flutter_project/lib/screens/profile_screen.dart`:

Replace the current flat `_buildMenuSection()` with 3 grouped sections:

**Section 1 — "MY SERVICES"** (header: uppercase, 13sp, Color(0xFF888888), letterSpacing 0.8, with Divider)
- My Appointments (Icons.calendar_month_outlined) → navigate
- Saved Businesses (Icons.favorite_outline) → navigate  
- Payments & Wallet (Icons.account_balance_wallet_outlined) → navigate

**Section 2 — "PERSONAL INFO"** (EXPANDABLE ACCORDION, collapsed by default)
- Use `ExpansionTile` or custom `AnimatedContainer` with spring physics
- When tapped, smoothly animate open with `AnimatedCrossFade` or `SizeTransition`
- Inside: My Addresses (Icons.location_on_outlined), My Cars (Icons.directions_car_outlined)
- Items inside fade in with staggered delay (use `Future.delayed` + `AnimatedOpacity`)
- Keep collapsed by default (`_personalInfoExpanded = false`)

**Section 3 — "SETTINGS & SUPPORT"**
- Notifications (Icons.notifications_outlined + red badge "3")
- Help & Support (Icons.help_outline)
- Clear Cache (Icons.delete_outline)

Style each menu item as:
- Container with: leading icon in colored box (44x44, borderRadius 12), title text, trailing chevron
- Icon box colors: blue for Services, purple for Personal Info, teal for Settings

---

## TASK 9: Flutter: Share Profile dialog with QR, NFC, Nearby

Create `flutter_project/lib/screens/share_profile_dialog.dart`:

A modal bottom sheet / dialog with these sharing options:

**Option A — QR Code (Primary)**
- Use `qr_flutter` package (check pubspec.yaml, add if needed)
- Generate QR code for: `neighborly://user/{USER_ID}`
- Center prominently in the dialog, show user name below

**Option B — Copy Profile ID**
- Button that copies to clipboard using `Clipboard.setData(ClipboardData(text: ...))`
- Show SnackBar "Copied!" confirmation

**Option C — Native Share**
- Use `share_plus` package (check pubspec.yaml)
- Share text: "Add me on Neighborly! My profile: neighborly://user/{USER_ID}"

**Option D — NFC Profile Transfer**
- Check NFC availability using `flutter_nfc_kit` (add to pubspec if available)
- If available: show "Share via NFC" option
- Write NDEF message containing the profile URL to NFC tag

**Option E — Nearby Connections**
- Use `flutter_nearby_connections` if available
- Show "Share via Nearby" option
- Advertise + discover nearby devices running Neighborly

**Graceful degradation:**
- Check each capability before showing the option
- Hide unavailable features (NFC on iOS simulator, Nearby on web, etc.)

Edit `flutter_project/lib/screens/profile_screen.dart` to add a share button (Icons.share) on the avatar card and open this dialog on tap.

---

## TASK 10: Flutter: UX enhancements — avatar glow, headers, animations

Edit `flutter_project/lib/screens/profile_screen.dart`:

**Avatar Section (top of screen):**
- Move avatar to top, centered (MainAxisAlignment.center)
- Increase size to 96x96
- Add glow ring: use `CustomPaint` or `Container` with boxShadow: [BoxShadow(color: AppColors.primary.withOpacity(0.3), blurRadius: 20, spreadRadius: 2)]
- Add pulse animation: `AnimationController` with 2s repeat, animate boxShadow blur from 10→25→10
- Display name centered below (headlineSmall, bold)
- Email below name (bodySmall, grey)
- Edit button next to name
- Share button (Icons.share) as floating button on bottom-right of avatar

**Section Headers:**
- Uppercase with `TextStyle(fontSize: 13, color: Color(0xFF888888), letterSpacing: 0.8, fontWeight: FontWeight.w600)`
- Divider below each header

**Animations:**
- Page enters with staggered fade-up: use `AnimationController` + `SlideTransition` + `FadeTransition`
- Each section has staggered delay (0ms, 100ms, 200ms) using `Interval`
- Expandable accordion uses spring physics (`Curves.easeOutBack` or `spring`)
- Menu items scale down on tap: wrap in `GestureDetector` with `onTapDown`/`onTapUp` + `AnimatedScale`

**Pulse Glow on Avatar:**
```dart
AnimationController _pulseController;
@override
void initState() {
  _pulseController = AnimationController(
    vsync: this, duration: Duration(seconds: 2))..repeat(reverse: true);
}
```
Use `AnimatedBuilder` to vary the boxShadow blur.

---

## TASK 11: React: Playwright verification (port 5173)

Use `browser` MCP tools (Playwright) to verify the React profile page:

**Pre-requisite:** Ensure React dev server is running on port 5173

1. Navigate to `http://localhost:5173/auth/login`
2. Login with test credentials (use a known test account)
3. Navigate to `/app/profile` or `/profile`
4. Take screenshot: `react-profile-01-full-page.png`

**Checks:**
- ✅ Fake StatusBar (9:41, Wi-Fi, battery) is NOT visible on the page
- ✅ "Profile" text label on back button is gone
- ✅ Avatar is centered at top with glow ring
- ✅ Three section headers visible: "MY SERVICES", "PERSONAL INFO", "SETTINGS & SUPPORT"
- ✅ Personal Info section is collapsed by default
- ✅ Click Personal Info header → accordion expands → Addresses and Cars appear
- ✅ Share button visible on avatar card
- ✅ Click Share button → Share Dialog opens with QR code, Copy ID, Share options
- ✅ Click each menu item → navigates or opens correct modal
- ✅ Notifications badge shows "3" in red pill

**Mobile:**
- Set viewport to 375×812
- Take screenshot: `react-profile-02-mobile.png`
- Verify layout is not broken

**Console:**
- Check for JavaScript errors (zero allowed)
- Check for failed network requests

Save ALL screenshots to `screenshots/` directory.

---

## TASK 12: Flutter: Playwright verification (port 7357)

Use `browser` MCP tools (Playwright) to verify the Flutter web profile page:

**Pre-requisite:** Ensure Flutter web server is running on port 7357. If code was changed, RESTART the Flutter web server: `cd flutter_project && flutter run -d web-server --web-port 7357`

1. Navigate to `http://localhost:7357`
2. Login if needed, navigate to profile
3. Take screenshot: `flutter-profile-01-full-page.png`

**Checks:**
- ✅ Fake StatusBar (9:41, battery, Wi-Fi) is NOT visible
- ✅ "Profile" back label text is removed
- ✅ Avatar is centered at top with glow ring + pulse animation
- ✅ Three section headers visible: "MY SERVICES", "PERSONAL INFO", "SETTINGS & SUPPORT"
- ✅ Personal Info accordion is collapsed by default
- ✅ Tap Personal Info → animates open → Addresses and Cars fade in
- ✅ Share button visible on avatar card
- ✅ Tap Share → Share Dialog opens with QR code, Copy ID, Share options
- ✅ NFC option visible only if hardware available (may be hidden on web)
- ✅ Each menu item tappable and navigates correctly
- ✅ Notifications badge shows "3" in red

**Mobile:**
- Set viewport to 375×812
- Take screenshot: `flutter-profile-02-mobile.png`
- Verify responsive layout

**Console:**
- Check for JavaScript errors
- Check for Flutter rendering errors (red error widget, RenderFlex overflow)

Save ALL screenshots to `screenshots/` directory.

---

## TASK 13: Final checks — typecheck, analyze, lint

Run all static analysis checks:

**React/Frontend:**
```bash
cd frontend && npm run typecheck 2>&1
```
- Zero TypeScript errors

```bash
cd frontend && npm run lint 2>&1
```
- Zero lint errors (or only pre-existing ones)

**Flutter:**
```bash
cd flutter_project && flutter analyze 2>&1
```
- Zero analysis errors (or only pre-existing warnings)

**If any errors found:** fix them, then re-run checks until clean.

---

## TASK 14: Git commit and push

Commit all changes and push to remote:

```bash
git add -A
git status
git commit -m "feat: redesign profile page for React and Flutter

- Remove fake status bar and redundant back label on both platforms
- Reorganize menu into 3 grouped sections (Services, Personal Info accordion, Settings)
- Add Share Profile dialog with QR code, Copy ID, Web Share API, NFC, Nearby
- Add avatar glow ring with pulse animation
- Add staggered fade-up page entrance animations
- Add expandable Personal Info accordion with spring physics
- Update section headers with uppercase styling and dividers

React: frontend/src/pages/customer/Profile.tsx
Flutter: flutter_project/lib/screens/profile_screen.dart"

git push
```

Verify commit is pushed successfully.

---

