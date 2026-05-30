#!/usr/bin/env bash
# =============================================================================
# Neighborly — Master Automation Script (Phase 2 + Phase 3 Implementation)
# =============================================================================
# This script orchestrates the ENTIRE remaining implementation for the
# Neighborly project. It is designed to be followed by an orchestrator AI
# (e.g., Roo Code in Orchestrator mode) or a human developer.
#
# Each task runs sequentially. The script does NOT auto-execute code changes;
# it prints clear instructions for each task, then waits for confirmation.
#
# Usage:
#   ./scripts/master-automation.sh                  # interactive mode
#   ./scripts/master-automation.sh --status         # show current progress
#   ./scripts/master-automation.sh --mark-done T1   # mark task T1 as done
#   ./scripts/master-automation.sh --mark-failed T1 # mark task T1 as failed
#   ./scripts/master-automation.sh --skip-checks    # skip prerequisite checks
#   ./scripts/master-automation.sh --run T1         # run a specific task
#   ./scripts/master-automation.sh --run-range T1-T5 # run a range of tasks
#
# Estimated total time: ~40-60 hours (spread across multiple sessions)
# =============================================================================

set -euo pipefail

SCRIPT_VERSION="1.0.0"
SCRIPT_DATE="2026-05-26"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; BOLD='\033[1m'; NC='\033[0m'

# ── Logging ───────────────────────────────────────────────────────────────────
log_info()    { echo -e "${CYAN}[INFO]${NC}    $1"; }
log_ok()      { echo -e "${GREEN}[OK]${NC}      $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}    $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC}   $1"; }
log_step()    { echo -e "\n${MAGENTA}══════════════════════════════════════════════════════════════${NC}"; }
log_header()  { echo -e "${BOLD}$1${NC}"; }
log_task()    { echo -e "\n${BOLD}${CYAN}┌─ TASK $1 ──────────────────────────────────────────────────┐${NC}"; }
log_divider() { echo -e "${MAGENTA}────────────────────────────────────────────────────────────────${NC}"; }

# ── State File ────────────────────────────────────────────────────────────────
STATE_FILE="$PROJECT_ROOT/.master-automation-state"
touch "$STATE_FILE"

save_state() {
  local task_id="$1" status="$2"
  if grep -q "^${task_id}|" "$STATE_FILE" 2>/dev/null; then
    sed -i "s/^${task_id}|.*/${task_id}|${status}/" "$STATE_FILE"
  else
    echo "${task_id}|${status}" >> "$STATE_FILE"
  fi
}

get_state() {
  local task_id="$1"
  grep "^${task_id}|" "$STATE_FILE" 2>/dev/null | cut -d'|' -f2 || echo "pending"
}

print_progress() {
  echo ""
  log_header "${BOLD}${CYAN}📊 CURRENT PROGRESS${NC}"
  log_divider
  local total=0 done_count=0 in_progress=0 failed=0 skipped=0 blocked=0
  for task in "${TASKS[@]}"; do
    local id="${task%%|*}"
    local state="$(get_state "$id")"
    total=$((total + 1))
    case "$state" in
      done)        done_count=$((done_count + 1)) ;;
      in-progress) in_progress=$((in_progress + 1)) ;;
      failed)      failed=$((failed + 1)) ;;
      skipped)     skipped=$((skipped + 1)) ;;
      blocked)     blocked=$((blocked + 1)) ;;
    esac
  done
  echo -e "  ${GREEN}✅ Done:${NC}        $done_count / $total"
  echo -e "  ${YELLOW}🔄 In Progress:${NC}  $in_progress"
  echo -e "  ${RED}❌ Failed:${NC}       $failed"
  echo -e "  ${CYAN}⏭️  Skipped:${NC}     $skipped"
  echo -e "  ${MAGENTA}🚫 Blocked:${NC}     $blocked"
  echo -e "  ${BOLD}📈 Progress:${NC}     $(( done_count * 100 / total ))%"
  log_divider
}

# ── Prerequisite Checks ───────────────────────────────────────────────────────
check_prerequisites() {
  log_step
  log_header "${BOLD}${CYAN}🔍 PREREQUISITE CHECKS${NC}"
  log_divider
  local all_ok=true
  command -v node &>/dev/null && log_ok "Node.js: $(node --version)" || { log_error "Node.js is NOT installed"; all_ok=false; }
  command -v npm &>/dev/null && log_ok "npm: $(npm --version)" || { log_error "npm is NOT installed"; all_ok=false; }
  npx tsx --version &>/dev/null 2>&1 && log_ok "tsx: available" || log_warn "tsx not found globally"
  command -v psql &>/dev/null && log_ok "PostgreSQL client: available" || log_warn "psql not found"
  command -v docker &>/dev/null && log_ok "Docker: available" || log_warn "Docker not found"
  command -v flutter &>/dev/null && log_ok "Flutter: $(flutter --version 2>/dev/null | head -1)" || log_warn "Flutter not found"
  npx playwright --version &>/dev/null 2>&1 && log_ok "Playwright: available" || log_warn "Playwright not found"
  [ -f "$PROJECT_ROOT/.env" ] && log_ok ".env file: present" || log_warn ".env file NOT found"
  [ -d "$PROJECT_ROOT/node_modules" ] && log_ok "Backend node_modules: present" || log_warn "Backend node_modules NOT found"
  [ -d "$PROJECT_ROOT/node_modules/.prisma/client" ] && log_ok "Prisma client: generated" || log_warn "Prisma client NOT generated"
  [ -d "$PROJECT_ROOT/frontend/node_modules" ] && log_ok "Frontend node_modules: present" || log_warn "Frontend node_modules NOT found"
  [ -d "$PROJECT_ROOT/frontend/admin/node_modules" ] && log_ok "Admin SPA node_modules: present" || log_warn "Admin SPA node_modules NOT found"
  log_divider
  [ "$all_ok" = true ] && log_ok "All prerequisites satisfied!" || log_warn "Some prerequisites are missing."
  echo ""
}

# ── Port Verification ─────────────────────────────────────────────────────────
verify_port() {
  local port="$1" service="$2"
  if timeout 2 bash -c "echo > /dev/tcp/127.0.0.1/$port" 2>/dev/null; then
    log_ok "Port $port ($service): OPEN"; return 0
  else
    log_warn "Port $port ($service): CLOSED"; return 1
  fi
}

verify_http() {
  local url="$1" name="$2"
  local code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "ERR")"
  [ "$code" != "ERR" ] && log_ok "$name → $url → HTTP $code" || log_warn "$name → $url → UNREACHABLE"
}

verify_all_ports() {
  log_step; log_header "${BOLD}${CYAN}🔌 PORT VERIFICATION${NC}"; log_divider
  verify_port 8080 "Backend API (local dev)"
  verify_port 9090 "Admin API + Admin SPA"
  verify_port 5173 "Vite React Frontend"
  verify_port 7357 "Flutter Web"
  verify_port 5432 "PostgreSQL"
  log_divider; echo ""
}

# ── Git Commit Helper ─────────────────────────────────────────────────────────
git_commit() {
  local message="$1"
  log_info "Committing changes..."
  cd "$PROJECT_ROOT" && git add -A
  git commit -m "[automation] $message" || log_warn "Nothing to commit"
  log_ok "Committed: $message"
}

# ═══════════════════════════════════════════════════════════════════════════════
# TASK DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════════════
# Format: "id|name|description|mode|est_hours|dependencies|files|tests"
TASKS=(
  # ── PHASE 3: Remaining Items (13 tasks) ────────────────────────────────────
  "T1|G10 — Commission Logic Enhancement|Admin dashboard to show commission earnings. Commission calc exists in lib/orderPayments.ts (15% default). Need to expose commission data in admin routes.|code|2.0||routes/adminPayments.ts, lib/adminOrdersList.ts|npx vitest run lib/orderPayments.test.ts"
  "T2|G11 — Auto-Release Escrow Cron Job|escrowReleaseAt is set to 48h but NO cron job exists to auto-release. Create scripts/autoReleaseEscrow.ts that checks escrowReleaseAt <= now() and releases.|code|3.0|T1|scripts/autoReleaseEscrow.ts, package.json, server.ts|Manual verification"
  "T3|G13 — NATS Payment Notification Handlers|NATS events are published but no subscriber/consumer logic exists. Add payment.captured, escrow.released, payment.refunded handlers.|code|2.5|T2|lib/orderLifecycleNotifications.ts|npx vitest run"
  "T4|B3 — Description Validation Mismatch|Fix 10 vs 20 char mismatch in order description validation. Check routes/orders.ts for validation logic.|debug|1.0||routes/orders.ts|npx vitest run routes/orders.test.ts"
  "T5|B6 — Missing OrderEntryPoint Enum Values|Migration exists (20260526060000_add_order_entry_point_values). Verify enum values in Prisma schema match the migration.|code|1.0||prisma/schema.prisma|npx vitest run routes/bookingMode.test.ts"
  "T6|G7 — Group Service Session Management|Migration exists (20260526090000_add_order_session_model). Verify implementation and wire up missing pieces.|code|3.0|T5|prisma/schema.prisma, routes/orders.ts|TBD"
  "T7|G8 — Inventory-Linked Service BOM|Wire Bill of Materials to orders. Ensure inventory items are properly linked when order is created.|code|3.0|T6|routes/orders.ts, lib/orderPayments.ts|TBD"
  "T8|G14 — Automatic Matching Window Expiry Cron|Create cron job for matching window expiry. When window expires without match, trigger fallback.|code|2.0|T2|scripts/matchingWindowExpiry.ts, server.ts|TBD"
  "T9|G16 — Provider Accept/Decline Invite Endpoint|Create endpoint for providers to accept or decline matching invitations.|code|2.0|T8|routes/quotes.ts, routes/orders.ts|npx vitest run routes/quotes.test.ts"
  "T10|G17 — Guest Checkout Flow|Implement guest checkout flow allowing unauthenticated users to place orders.|code|4.0|T4|routes/orders.ts, lib/orderLifecycleNotifications.ts|TBD"
  "T11|G18 — Staff Assignment Validation|Implement validation for staff assignment to orders. Ensure only qualified staff can be assigned.|code|2.0|T6|routes/orders.ts, lib/orderCapacity.ts|TBD"
  "T12|G19 — Dispute Resolution Dead-End State|Implement dispute resolution dead-end state handling. When dispute reaches dead-end, escalate to admin.|code|2.0||routes/contracts.ts, lib/contractEvents.ts|TBD"
  "T13|G20 — Phase Missing from API Response|Add phase field to API response for orders. Ensure phase is serialized in all order endpoints.|code|1.0||routes/orders.ts, lib/orderPhase.ts|TBD"

  # ── PHASE 4: Polish (4 tasks) ──────────────────────────────────────────────
  "T14|M1 — Add phase to Order Model + Serialization|Ensure phase field is properly added to Order model in Prisma schema and serialized in all API responses.|code|1.5|T13|prisma/schema.prisma, routes/orders.ts|npx vitest run"
  "T15|M2 — Add OrderEntryPoint to Order Model|Ensure OrderEntryPoint enum is properly integrated into Order model and serialized.|code|1.0|T5|prisma/schema.prisma, routes/orders.ts|npx vitest run"
  "T16|M4 — Add BookingMode to Order Model|Ensure BookingMode enum is properly integrated into Order model and serialized.|code|1.0|T5|prisma/schema.prisma, routes/orders.ts|npx vitest run"
  "T17|M5 — Add OrderStatus to Order Model|Ensure OrderStatus enum is properly integrated into Order model and serialized.|code|1.0||prisma/schema.prisma, routes/orders.ts|npx vitest run"

  # ── PHASE 5: Frontend & Admin (12 tasks) ───────────────────────────────────
  "T18|F1 — Customer Dashboard Live Order Status Polling|Implement live polling on customer dashboard to show real-time order status updates.|code|3.0|T14,T15,T16,T17|frontend/src/pages/customer/Dashboard.tsx, frontend/src/services/orderService.ts|npx playwright test"
  "T19|F7 — Public Business Page|Implement public-facing business page with trust layer (license, insurance, work experience from KYC).|code|4.0||routes/businessPage.ts, frontend/src/pages/BusinessPage.tsx|npx playwright test frontend/e2e/business-page.spec.ts"
  "T20|F8 — Staff Identity Display|Display staff photo + name per service. Required before in-person service so customer knows who will perform work.|code|3.0|T11|routes/services.ts, frontend/src/components/business/StaffCard.tsx|npx playwright test"
  "T21|F11 — Payment Gateway Setup Flow|Implement payment gateway setup flow for providers to connect their payment accounts.|code|4.0||routes/orderPayments.ts, frontend/src/pages/provider/PaymentSetup.tsx|npx vitest run lib/orderPayments.test.ts"
  "T22|F12 — Invoice PDF Generation|Implement PDF invoice generation for completed orders.|code|3.0||lib/invoiceGenerator.ts, routes/orders.ts|TBD"
  "T23|M3 — Stripe Connect Integration|Integrate Stripe Connect for marketplace payouts. ⚠️ CHECK AGENTS.md RULE #6 FIRST — Stripe may be out of scope.|code|5.0|T21|routes/orderPayments.ts, lib/orderPayments.ts|TBD"
  "T24|A1 — Admin: Commission Dashboard|Add commission tracking and display to admin dashboard.|code|2.0|T1|frontend/admin/src/pages/Dashboard.tsx, routes/adminPayments.ts|npx playwright test"
  "T25|A2 — Admin: Audit Log Viewer|Implement audit log viewer in admin panel.|code|2.0||routes/admin.ts, frontend/admin/src/pages/AuditLog.tsx|npx playwright test"
  "T26|A3 — Admin: Media Audit Dashboard|Implement media audit dashboard showing video/photo stats.|code|2.0||routes/adminMedia.ts, frontend/admin/src/pages/Media.tsx|npx playwright test"
  "T27|A4 — Admin: Analytics Dashboard|Implement analytics dashboard with charts and metrics.|code|3.0||routes/admin.ts, frontend/admin/src/pages/Analytics.tsx|npx playwright test"
  "T28|A5 — Admin: Home Content Management|Implement admin UI for managing home content (news, media, external API integration).|code|3.0||routes/adminHomeContent.ts, frontend/admin/src/pages/HomeContent.tsx|npx playwright test"
  "T29|A6 — Admin: Local Insights Configuration|Implement admin UI for configuring aggregate data display and privacy boundaries.|code|2.0||routes/admin.ts, frontend/admin/src/pages/Settings.tsx|npx playwright test"

  # ── PHASE 6: Compliance & Polish (12 tasks) ────────────────────────────────
  "T30|S2 — Security: Input Validation Audit|Audit all API endpoints for proper input validation using Zod schemas.|code|3.0||routes/*.ts|npx vitest run"
  "T31|S5 — Security: Rate Limiting|Implement rate limiting on auth and order endpoints.|code|2.0||server.ts, routes/auth.ts|Manual test"
  "T32|S6 — Security: PII Masking Audit|Audit all API responses to ensure PII is properly masked before contract approval.|code|2.0||lib/privacyThreshold.ts, routes/orders.ts|npx vitest run"
  "T33|F2 — Frontend: Order Wizard Polish|Polish the order wizard UI for better UX.|code|2.0|T14,T15,T16,T17|frontend/src/pages/customer/OrderWizard.tsx|npx playwright test"
  "T34|F3 — Frontend: Business Dashboard|Polish the business dashboard UI.|code|2.0||frontend/src/pages/business/Dashboard.tsx|npx playwright test"
  "T35|F4 — Frontend: Provider Workspace|Polish the provider workspace UI.|code|2.0||frontend/src/pages/provider/Workspace.tsx|npx playwright test"
  "T36|F5 — Frontend: Notification Center|Implement notification center UI.|code|2.0||frontend/src/pages/Notifications.tsx, routes/notifications.ts|npx playwright test"
  "T37|F6 — Frontend: Mobile Responsiveness|Ensure all pages are mobile-responsive.|code|3.0||frontend/src/**/*.tsx|npx playwright test"
  "T38|F10 — Frontend: Accessibility Audit|Audit and fix accessibility issues (ARIA labels, keyboard navigation, contrast).|code|2.0||frontend/src/**/*.tsx|npx playwright test"
  "T39|T3 — Test: Integration Tests for Order Flow|Write integration tests for the complete order flow.|code|3.0|T1,T2,T3,T4,T5,T6,T7,T8,T9,T10,T11,T12,T13|routes/orders.test.ts, routes/quotes.test.ts|npx vitest run"
  "T40|T4 — Test: E2E Tests for Admin Panel|Write end-to-end tests for admin panel features.|code|3.0|T24,T25,T26,T27,T28,T29|frontend/e2e/admin-*.spec.ts|npx playwright test"
  "T41|T5 — Test: Load Testing for Matching Engine|Write load tests for the matching engine.|code|2.0||scripts/loadTestMatching.ts|npx tsx scripts/loadTestMatching.ts"

  # ── FINAL LAUNCH ────────────────────────────────────────────────────────────
  "T42|LAUNCH — Start All Services + UI Verification|Start all services, run Playwright UI tests on all ports, verify everything works together.|code|2.0|T1,T2,T3,T4,T5,T6,T7,T8,T9,T10,T11,T12,T13,T14,T15,T16,T17,T18,T19,T20,T21,T22,T23,T24,T25,T26,T27,T28,T29,T30,T31,T32,T33,T34,T35,T36,T37,T38,T39,T40,T41|All services|Full Playwright suite"
)

# ═══════════════════════════════════════════════════════════════════════════════
# TASK EXECUTION ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

print_task_header() {
  local tid="$1" tn="$2" td="$3" tm="$4" te="$5" tdep="$6" tf="$7" ttest="$8"
  log_task "$tid: $tn"
  echo -e "  ${CYAN}Description:${NC}  $td"
  echo -e "  ${CYAN}Mode:${NC}          $tm"
  echo -e "  ${CYAN}Est. Time:${NC}     ${te}h"
  echo -e "  ${CYAN}Dependencies:${NC}  ${tdep:-None}"
  echo -e "  ${CYAN}Files:${NC}         ${tf:-TBD}"
  echo -e "  ${CYAN}Tests:${NC}         ${ttest:-None specified}"
  log_divider
}

check_dependencies() {
  local tid="$1" deps="$2"
  [ -z "$deps" ] && return 0
  local IFS=','
  for dep in $deps; do
    dep="$(echo "$dep" | xargs)"
    local st="$(get_state "$dep")"
    [ "$st" != "done" ] && { log_error "Dependency $dep is not done (state: $st). Cannot proceed with $tid."; return 1; }
  done
  return 0
}

run_task() {
  local entry="$1"
  local tid tn td tm te tdep tf ttest
  IFS='|' read -r tid tn td tm te tdep tf ttest <<< "$entry"
  local cs="$(get_state "$tid")"
  [ "$cs" = "done" ] && { log_info "Task $tid already completed. Skipping."; return 0; }
  [ "$cs" = "skipped" ] && { log_info "Task $tid was skipped. Skipping."; return 0; }
  if ! check_dependencies "$tid" "$tdep"; then
    log_warn "Dependencies not met for $tid. Marking as blocked."
    save_state "$tid" "blocked"; return 1
  fi
  print_task_header "$tid" "$tn" "$td" "$tm" "$te" "$tdep" "$tf" "$ttest"
  save_state "$tid" "in-progress"
  echo ""
  echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}║  ACTION REQUIRED                                           ║${NC}"
  echo -e "${YELLOW}║                                                          ║${NC}"
  echo -e "${YELLOW}║  Task: $tid — $tn${NC}"
  echo -e "${YELLOW}║                                                          ║${NC}"
  echo -e "${YELLOW}║  Files to modify:${NC}"
  echo -e "${YELLOW}║    ${tf:-TBD}${NC}"
  echo -e "${YELLOW}║                                                          ║${NC}"
  echo -e "${YELLOW}║  Tests to run:${NC}"
  echo -e "${YELLOW}║    ${ttest:-None specified}${NC}"
  echo -e "${YELLOW}║                                                          ║${NC}"
  echo -e "${YELLOW}║  After completing, run:${NC}"
  echo -e "${YELLOW}║    ./scripts/master-automation.sh --mark-done $tid${NC}"
  echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# DETAILED TASK INSTRUCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

print_task_details() {
  local tid="$1"
  case "$tid" in
    T1)
      echo ""
      log_header "${BOLD}📋 TASK T1 — G10: Commission Logic Enhancement${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Commission calculation exists in lib/orderPayments.ts \(15% default\)."
      echo "    Need to expose commission data in admin routes so the admin dashboard"
      echo "    can display commission earnings."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/adminPayments.ts — Add commission earnings endpoint"
      echo "    • lib/adminOrdersList.ts — Include commission data in order list"
      echo ""
      echo "  STEPS:"
      echo "    1. Read lib/orderPayments.ts to understand existing commission logic"
      echo "    2. Read routes/adminPayments.ts to understand current admin payment routes"
      echo "    3. Add a GET /admin/payments/commissions endpoint that returns:"
      echo "       - Total commission earned \(all time\)"
      echo "       - Commission by period \(daily/weekly/monthly\)"
      echo "       - Per-order commission breakdown"
      echo "    4. Update lib/adminOrdersList.ts to include commission field per order"
      echo "    5. Run tests: npx vitest run lib/orderPayments.test.ts"
      echo "    6. Verify with curl: curl http://localhost:8080/admin/payments/commissions"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Admin can see commission earnings on the payments page"
      echo "    • Commission is calculated correctly \(15% of order total\)"
      echo "    • All existing tests pass"
      echo ""
      echo "  GIT: git add -A && git commit -m '[G10] Add commission earnings to admin dashboard'"
      ;;
    T2)
      echo ""
      log_header "${BOLD}📋 TASK T2 — G11: Auto-Release Escrow Cron Job${NC}"
      echo ""
      echo "  WHAT:"
      echo "    escrowReleaseAt is set to 48h but NO cron job exists to auto-release."
      echo "    Need to create a script that checks escrowReleaseAt <= now\(\) and releases."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • scripts/autoReleaseEscrow.ts — NEW file"
      echo "    • package.json — Add script entry"
      echo "    • server.ts — Optionally start cron on server boot"
      echo ""
      echo "  STEPS:"
      echo "    1. Create scripts/autoReleaseEscrow.ts that:"
      echo "       - Queries orders where escrowReleaseAt <= now\(\) AND status = 'COMPLETED'"
      echo "       - Calls the release function from lib/orderPayments.ts"
      echo "       - Logs each release action"
      echo "       - Can run as a standalone script OR as a recurring cron"
      echo "    2. Add to package.json: \"cron:release-escrow\": \"tsx scripts/autoReleaseEscrow.ts\""
      echo "    3. Optionally add setInterval in server.ts to run every 5 minutes"
      echo "    4. Test manually by setting escrowReleaseAt in the past and running the script"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Script runs without errors"
      echo "    • Orders with past escrowReleaseAt get released"
      echo "    • Released orders have their payment status updated"
      echo ""
      echo "  GIT: git add -A && git commit -m '[G11] Add auto-release escrow cron job'"
      ;;
    T3)
      echo ""
      log_header "${BOLD}📋 TASK T3 — G13: NATS Payment Notification Handlers${NC}"
      echo ""
      echo "  WHAT:"
      echo "    NATS events are published but no subscriber/consumer logic exists."
      echo "    Need to add handlers for payment.captured, escrow.released, payment.refunded."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • lib/orderLifecycleNotifications.ts — Add NATS subscriber handlers"
      echo ""
      echo "  STEPS:"
      echo "    1. Read lib/orderLifecycleNotifications.ts to understand existing NATS setup"
      echo "    2. Read lib/bus.ts to understand event bus patterns"
      echo "    3. Add subscriber handlers for:"
      echo "       - payment.captured → notify customer + provider"
      echo "       - escrow.released → notify provider that funds are available"
      echo "       - payment.refunded → notify customer of refund"
      echo "    4. Each handler should:"
      echo "       - Parse the event payload"
      echo "       - Send appropriate notification \(in-app, email, push\)"
      echo "       - Log the action"
      echo "    5. Run tests: npx vitest run"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • NATS events are consumed and processed"
      echo "    • Notifications are sent for each payment event"
      echo "    • All existing tests pass"
      echo ""
      echo "  GIT: git add -A && git commit -m '[G13] Add NATS payment notification handlers'"
      ;;
    T4)
      echo ""
      log_header "${BOLD}📋 TASK T4 — B3: Description Validation Mismatch${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Fix 10 vs 20 char mismatch in order description validation."
      echo "    One place validates min 10 chars, another expects min 20 chars."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/orders.ts — Find and fix validation logic"
      echo ""
      echo "  STEPS:"
      echo "    1. Search routes/orders.ts for description validation \(minLength\)"
      echo "    2. Check both Zod schema and any manual validation"
      echo "    3. Ensure consistent minimum \(use 10 chars as standard\)"
      echo "    4. Run tests: npx vitest run routes/orders.test.ts"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Description validation is consistent everywhere \(10 chars min\)"
      echo "    • All order tests pass"
      echo ""
      echo "  GIT: git add -A && git commit -m '[B3] Fix description validation mismatch \(10 chars\)'"
      ;;
    T5)
      echo ""
      log_header "${BOLD}📋 TASK T5 — B6: Missing OrderEntryPoint Enum Values${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Migration already exists \(20260526060000_add_order_entry_point_values\)."
      echo "    Need to verify enum values in Prisma schema match the migration."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • prisma/schema.prisma — Verify OrderEntryPoint enum"
      echo ""
      echo "  STEPS:"
      echo "    1. Read the migration file: prisma/migrations/*add_order_entry_point_values*/migration.sql"
      echo "    2. Read prisma/schema.prisma and find the OrderEntryPoint enum"
      echo "    3. Compare enum values — ensure they match"
      echo "    4. If mismatch, update schema.prisma to match migration"
      echo "    5. Run: npx prisma generate"
      echo "    6. Run tests: npx vitest run routes/bookingMode.test.ts"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Prisma schema enum matches migration"
      echo "    • Prisma client generates without errors"
      echo "    • bookingMode tests pass"
      echo ""
      echo "  GIT: git add -A && git commit -m '[B6] Fix OrderEntryPoint enum values in schema'"
      ;;
    T6)
      echo ""
      log_header "${BOLD}📋 TASK T6 — G7: Group Service Session Management${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Migration exists \(20260526090000_add_order_session_model\)."
      echo "    Need to verify implementation and wire up any missing pieces."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • prisma/schema.prisma — Verify OrderSession model"
      echo "    • routes/orders.ts — Wire session management into order creation"
      echo ""
      echo "  STEPS:"
      echo "    1. Read the migration file to understand the OrderSession model"
      echo "    2. Verify prisma/schema.prisma has the OrderSession model"
      echo "    3. Check if routes/orders.ts uses OrderSession anywhere"
      echo "    4. If missing, wire session creation into order flow"
      echo "    5. Run: npx prisma generate"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • OrderSession model exists in schema"
      echo "    • Orders can be grouped into sessions"
      echo "    • Session data is accessible via API"
      echo ""
      echo "  GIT: git add -A && git commit -m '[G7] Wire up OrderSession management'"
      ;;
    T7)
      echo ""
      log_header "${BOLD}📋 TASK T7 — G8: Inventory-Linked Service BOM${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Wire Bill of Materials to orders. Ensure inventory items are"
      echo "    properly linked when an order is created."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/orders.ts — Link BOM items to order"
      echo "    • lib/orderPayments.ts — Calculate BOM costs in order total"
      echo ""
      echo "  STEPS:"
      echo "    1. Read prisma/schema.prisma to understand BOM/inventory models"
      echo "    2. Read routes/orders.ts to understand order creation flow"
      echo "    3. Add BOM item linking when order is created from a package"
      echo "    4. Ensure BOM costs are included in order total calculation"
      echo "    5. Run tests: npx vitest run"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • BOM items are linked to orders on creation"
      echo "    • BOM costs are included in order total"
      echo "    • All existing tests pass"
      echo ""
      echo "  GIT: git add -A && git commit -m '[G8] Wire inventory-linked BOM to orders'"
      ;;
    T8)
      echo ""
      log_header "${BOLD}📋 TASK T8 — G14: Automatic Matching Window Expiry Cron${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Create cron job for matching window expiry. When matching window"
      echo "    expires without a match, trigger fallback logic."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • scripts/matchingWindowExpiry.ts — NEW file"
      echo "    • server.ts — Register cron on startup"
      echo ""
      echo "  STEPS:"
      echo "    1. Create scripts/matchingWindowExpiry.ts that:"
      echo "       - Queries orders where matching window has expired"
      echo "       - Triggers fallback matching or notifies admin"
      echo "       - Logs each expiry action"
      echo "    2. Add to package.json: \"cron:matching-expiry\": \"tsx scripts/matchingWindowExpiry.ts\""
      echo "    3. Register in server.ts with setInterval \(every 5 min\)"
      echo "    4. Test manually"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Script runs without errors"
      echo "    • Expired matching windows trigger fallback"
      echo "    • Admin is notified of unmatched orders"
      echo ""
      echo "  GIT: git add -A && git commit -m '[G14] Add matching window expiry cron job'"
      ;;
    T9)
      echo ""
      log_header "${BOLD}📋 TASK T9 — G16: Provider Accept/Decline Invite Endpoint${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Create endpoint for providers to accept or decline matching invitations."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/quotes.ts — Add accept/decline endpoints"
      echo "    • routes/orders.ts — Update order status on accept/decline"
      echo ""
      echo "  STEPS:"
      echo "    1. Read routes/quotes.ts to understand current quote flow"
      echo "    2. Add POST /quotes/:id/accept endpoint"
      echo "    3. Add POST /quotes/:id/decline endpoint"
      echo "    4. On accept: update order status, notify customer"
      echo "    5. On decline: trigger re-match or notify customer"
      echo "    6. Run tests: npx vitest run routes/quotes.test.ts"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Providers can accept/decline invitations via API"
      echo "    • Order status updates correctly"
      echo "    • Customer is notified of provider response"
      echo "    • All existing tests pass"
      echo ""
      echo "  GIT: git add -A && git commit -m '[G16] Add provider accept/decline invite endpoint'"
      ;;
    T10)
      echo ""
      log_header "${BOLD}📋 TASK T10 — G17: Guest Checkout Flow${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Implement guest checkout flow allowing unauthenticated users to place orders."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/orders.ts — Add guest order creation"
      echo "    • lib/orderLifecycleNotifications.ts — Handle guest notifications"
      echo ""
      echo "  STEPS:"
      echo "    1. Read routes/orders.ts to understand order creation flow"
      echo "    2. Add guest order creation endpoint \(no auth required\)"
      echo "    3. Generate temporary guest token for order tracking"
      echo "    4. Handle guest → registered user migration"
      echo "    5. Run tests: npx vitest run"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Unauthenticated users can place orders"
      echo "    • Guest orders are tracked with temporary tokens"
      echo "    • Guest can convert to registered user and retain order history"
      echo ""
      echo "  GIT: git add -A && git commit -m '[G17] Implement guest checkout flow'"
      ;;
    T11)
      echo ""
      log_header "${BOLD}📋 TASK T11 — G18: Staff Assignment Validation${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Implement validation for staff assignment to orders."
      echo "    Ensure only qualified staff can be assigned."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/orders.ts — Add staff assignment validation"
      echo "    • lib/orderCapacity.ts — Add staff qualification checks"
      echo ""
      echo "  STEPS:"
      echo "    1. Read lib/orderCapacity.ts to understand current capacity logic"
      echo "    2. Add staff qualification validation \(skills, certifications\)"
      echo "    3. Add staff availability check \(not double-booked\)"
      echo "    4. Wire validation into order assignment flow"
      echo "    5. Run tests: npx vitest run"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Only qualified staff can be assigned to orders"
      echo "    • Staff availability is checked before assignment"
      echo "    • Validation errors are returned with clear messages"
      echo ""
      echo "  GIT: git add -A && git commit -m '[G18] Add staff assignment validation'"
      ;;
    T12)
      echo ""
      log_header "${BOLD}📋 TASK T12 — G19: Dispute Resolution Dead-End State${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Implement dispute resolution dead-end state handling."
      echo "    When dispute reaches dead-end, escalate to admin."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/contracts.ts — Add dispute escalation logic"
      echo "    • lib/contractEvents.ts — Add dead-end state handling"
      echo ""
      echo "  STEPS:"
      echo "    1. Read routes/contracts.ts to understand dispute flow"
      echo "    2. Read lib/contractEvents.ts to understand contract events"
      echo "    3. Add dead-end state detection logic"
      echo "    4. Add admin escalation on dead-end"
      echo "    5. Notify admin of escalated disputes"
      echo "    6. Run tests: npx vitest run"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Disputes that reach dead-end are escalated to admin"
      echo "    • Admin is notified of escalated disputes"
      echo "    • All existing tests pass"
      echo ""
      echo "  GIT: git add -A && git commit -m '[G19] Add dispute resolution dead-end state'"
      ;;
    T13)
      echo ""
      log_header "${BOLD}📋 TASK T13 — G20: Phase Missing from API Response${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Add phase field to API response for orders."
      echo "    Ensure phase is serialized in all order endpoints."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/orders.ts — Add phase to response serialization"
      echo "    • lib/orderPhase.ts — Ensure phase calculation is correct"
      echo ""
      echo "  STEPS:"
      echo "    1. Read lib/orderPhase.ts to understand phase calculation"
      echo "    2. Read routes/orders.ts to find response serialization"
      echo "    3. Add phase field to all order response objects"
      echo "    4. Run tests: npx vitest run"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • All order API responses include phase field"
      echo "    • Phase is calculated correctly based on order state"
      echo "    • All existing tests pass"
      echo ""
      echo "  GIT: git add -A && git commit -m '[G20] Add phase to API response'"
      ;;
    T14)
      echo ""
      log_header "${BOLD}📋 TASK T14 — M1: Add phase to Order Model + Serialization${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Ensure phase field is properly added to Order model in Prisma schema"
      echo "    and serialized in all API responses."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • prisma/schema.prisma — Add phase field to Order model"
      echo "    • routes/orders.ts — Serialize phase in responses"
      echo ""
      echo "  STEPS:"
      echo "    1. Add phase field to Order model in prisma/schema.prisma"
      echo "    2. Run: npx prisma generate"
      echo "    3. Update order serialization in routes/orders.ts"
      echo "    4. Run tests: npx vitest run"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Order model has phase field"
      echo "    • Phase is serialized in all API responses"
      echo "    • All tests pass"
      echo ""
      echo "  GIT: git add -A && git commit -m '[M1] Add phase to Order model and serialization'"
      ;;
    T15)
      echo ""
      log_header "${BOLD}📋 TASK T15 — M2: Add OrderEntryPoint to Order Model${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Ensure OrderEntryPoint enum is properly integrated into Order model"
      echo "    and serialized in API responses."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • prisma/schema.prisma — Add OrderEntryPoint to Order model"
      echo "    • routes/orders.ts — Serialize OrderEntryPoint in responses"
      echo ""
      echo "  STEPS:"
      echo "    1. Add orderEntryPoint field to Order model"
      echo "    2. Run: npx prisma generate"
      echo "    3. Update order serialization"
      echo "    4. Run tests: npx vitest run"
      echo ""
      echo "  GIT: git add -A && git commit -m '[M2] Add OrderEntryPoint to Order model'"
      ;;
    T16)
      echo ""
      log_header "${BOLD}📋 TASK T16 — M4: Add BookingMode to Order Model${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Ensure BookingMode enum is properly integrated into Order model"
      echo "    and serialized in API responses."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • prisma/schema.prisma — Add BookingMode to Order model"
      echo "    • routes/orders.ts — Serialize BookingMode in responses"
      echo ""
      echo "  STEPS:"
      echo "    1. Add bookingMode field to Order model"
      echo "    2. Run: npx prisma generate"
      echo "    3. Update order serialization"
      echo "    4. Run tests: npx vitest run"
      echo ""
      echo "  GIT: git add -A && git commit -m '[M4] Add BookingMode to Order model'"
      ;;
    T17)
      echo ""
      log_header "${BOLD}📋 TASK T17 — M5: Add OrderStatus to Order Model${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Ensure OrderStatus enum is properly integrated into Order model"
      echo "    and serialized in API responses."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • prisma/schema.prisma — Add OrderStatus to Order model"
      echo "    • routes/orders.ts — Serialize OrderStatus in responses"
      echo ""
      echo "  STEPS:"
      echo "    1. Add status field to Order model \(if not already present\)"
      echo "    2. Run: npx prisma generate"
      echo "    3. Update order serialization"
      echo "    4. Run tests: npx vitest run"
      echo ""
      echo "  GIT: git add -A && git commit -m '[M5] Add OrderStatus to Order model'"
      ;;
    T18)
      echo ""
      log_header "${BOLD}📋 TASK T18 — F1: Customer Dashboard Live Order Status Polling${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Implement live polling on customer dashboard to show real-time"
      echo "    order status updates."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • frontend/src/pages/customer/Dashboard.tsx — Add polling logic"
      echo "    • frontend/src/services/orderService.ts — Add polling endpoint"
      echo ""
      echo "  STEPS:"
      echo "    1. Read frontend/src/pages/customer/Dashboard.tsx"
      echo "    2. Add setInterval polling \(every 10s\) for order status"
      echo "    3. Show visual indicators for status changes"
      echo "    4. Handle loading and error states"
      echo "    5. Run Playwright tests: npx playwright test"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Customer dashboard polls for order status every 10s"
      echo "    • Status changes are reflected in real-time"
      echo "    • Loading and error states are handled gracefully"
      echo ""
      echo "  GIT: git add -A && git commit -m '[F1] Add live order status polling to customer dashboard'"
      ;;
    T19)
      echo ""
      log_header "${BOLD}📋 TASK T19 — F7: Public Business Page${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Implement public-facing business page with trust layer"
      echo "    \(license, insurance, work experience from KYC\)."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/businessPage.ts — Add public business page endpoint"
      echo "    • frontend/src/pages/BusinessPage.tsx — Create business page UI"
      echo ""
      echo "  STEPS:"
      echo "    1. Read routes/businessPage.ts to understand existing endpoints"
      echo "    2. Add GET /business/:slug public endpoint"
      echo "    3. Include KYC trust data \(license, insurance, experience\)"
      echo "    4. Create BusinessPage.tsx with trust layer display"
      echo "    5. Run Playwright tests: npx playwright test frontend/e2e/business-page.spec.ts"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Public business page is accessible without auth"
      echo "    • Trust layer shows KYC verification data"
      echo "    • All existing tests pass"
      echo ""
      echo "  GIT: git add -A && git commit -m '[F7] Add public business page with trust layer'"
      ;;
    T20)
      echo ""
      log_header "${BOLD}📋 TASK T20 — F8: Staff Identity Display${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Display staff photo + name per service. Required before in-person"
      echo "    service so customer knows who will perform work."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/services.ts — Add staff info to service response"
      echo "    • frontend/src/components/business/StaffCard.tsx — Create staff card UI"
      echo ""
      echo "  STEPS:"
      echo "    1. Read routes/services.ts to understand service response"
      echo "    2. Add staff info \(photo, name, qualifications\) to service endpoint"
      echo "    3. Create StaffCard.tsx component"
      echo "    4. Display staff info on order confirmation page"
      echo "    5. Run Playwright tests"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Customer can see staff photo and name before service"
      echo "    • Staff qualifications are displayed"
      echo "    • UI is responsive and accessible"
      echo ""
      echo "  GIT: git add -A && git commit -m '[F8] Add staff identity display'"
      ;;
    T21)
      echo ""
      log_header "${BOLD}📋 TASK T21 — F11: Payment Gateway Setup Flow${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Implement payment gateway setup flow for providers to connect"
      echo "    their payment accounts."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/orderPayments.ts — Add gateway setup endpoints"
      echo "    • frontend/src/pages/provider/PaymentSetup.tsx — Create setup UI"
      echo ""
      echo "  STEPS:"
      echo "    1. Read routes/orderPayments.ts to understand payment flow"
      echo "    2. Add provider payment account setup endpoint"
      echo "    3. Create PaymentSetup.tsx with onboarding steps"
      echo "    4. Handle gateway connection status"
      echo "    5. Run tests: npx vitest run lib/orderPayments.test.ts"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Providers can set up payment accounts"
      echo "    • Setup flow guides provider through steps"
      echo "    • Connection status is displayed"
      echo ""
      echo "  GIT: git add -A && git commit -m '[F11] Add payment gateway setup flow'"
      ;;
    T22)
      echo ""
      log_header "${BOLD}📋 TASK T22 — F12: Invoice PDF Generation${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Implement PDF invoice generation for completed orders."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • lib/invoiceGenerator.ts — NEW file for PDF generation"
      echo "    • routes/orders.ts — Add invoice download endpoint"
      echo ""
      echo "  STEPS:"
      echo "    1. Create lib/invoiceGenerator.ts using a PDF library"
      echo "    2. Generate invoice with: order details, line items, totals, tax"
      echo "    3. Add GET /orders/:id/invoice endpoint"
      echo "    4. Return PDF as downloadable file"
      echo "    5. Test manually by downloading invoice"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • PDF invoice is generated for completed orders"
      echo "    • Invoice includes all required fields"
      echo "    • Invoice is downloadable via API"
      echo ""
      echo "  GIT: git add -A && git commit -m '[F12] Add invoice PDF generation'"
      ;;
    T23)
      echo ""
      log_header "${BOLD}📋 TASK T23 — M3: Stripe Connect Integration${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Integrate Stripe Connect for marketplace payouts."
      echo "    ⚠️ CHECK AGENTS.md RULE #6 FIRST — Stripe may be out of scope."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/orderPayments.ts — Add Stripe Connect endpoints"
      echo "    • lib/orderPayments.ts — Add Stripe payout logic"
      echo ""
      echo "  STEPS:"
      echo "    1. Verify Stripe is allowed per AGENTS.md rule #6"
      echo "    2. If allowed, add Stripe Connect OAuth flow"
      echo "    3. Add payout endpoint for providers"
      echo "    4. Handle webhooks for payout status"
      echo "    5. Run tests: npx vitest run lib/orderPayments.test.ts"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Providers can connect Stripe accounts"
      echo "    • Payouts are processed through Stripe Connect"
      echo "    • Payout status is tracked"
      echo ""
      echo "  GIT: git add -A && git commit -m '[M3] Add Stripe Connect integration'"
      ;;
    T24)
      echo ""
      log_header "${BOLD}📋 TASK T24 — A1: Admin Commission Dashboard${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Add commission tracking and display to admin dashboard."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • frontend/admin/src/pages/Dashboard.tsx — Add commission widgets"
      echo "    • routes/adminPayments.ts — Add commission data endpoint"
      echo ""
      echo "  STEPS:"
      echo "    1. Read frontend/admin/src/pages/Dashboard.tsx"
      echo "    2. Add commission summary widgets \(total, period, per-order\)"
      echo "    3. Connect to admin payments API"
      echo "    4. Run Playwright tests"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Admin dashboard shows commission earnings"
      echo "    • Commission data is accurate"
      echo "    • UI is responsive"
      echo ""
      echo "  GIT: git add -A && git commit -m '[A1] Add commission dashboard to admin panel'"
      ;;
    T25)
      echo ""
      log_header "${BOLD}📋 TASK T25 — A2: Admin Audit Log Viewer${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Implement audit log viewer in admin panel."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/admin.ts — Add audit log endpoint"
      echo "    • frontend/admin/src/pages/AuditLog.tsx — Create audit log UI"
      echo ""
      echo "  STEPS:"
      echo "    1. Read routes/admin.ts to understand existing admin routes"
      echo "    2. Add GET /admin/audit-log endpoint with pagination"
      echo "    3. Create AuditLog.tsx with filterable table"
      echo "    4. Run Playwright tests"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Admin can view audit log with filters"
      echo "    • Audit log is paginated"
      echo "    • All existing tests pass"
      echo ""
      echo "  GIT: git add -A && git commit -m '[A2] Add audit log viewer to admin panel'"
      ;;
    T26)
      echo ""
      log_header "${BOLD}📋 TASK T26 — A3: Admin Media Audit Dashboard${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Implement media audit dashboard showing video/photo stats."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/adminMedia.ts — Add media stats endpoint"
      echo "    • frontend/admin/src/pages/Media.tsx — Enhance media dashboard"
      echo ""
      echo "  STEPS:"
      echo "    1. Read routes/adminMedia.ts to understand existing media routes"
      echo "    2. Add media statistics endpoint \(uploads, views, storage\)"
      echo "    3. Enhance Media.tsx with stats dashboard"
      echo "    4. Run Playwright tests"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Admin can see media upload statistics"
      echo "    • Storage usage is displayed"
      echo "    • UI is responsive"
      echo ""
      echo "  GIT: git add -A && git commit -m '[A3] Add media audit dashboard to admin panel'"
      ;;
    T27)
      echo ""
      log_header "${BOLD}📋 TASK T27 — A4: Admin Analytics Dashboard${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Implement analytics dashboard with charts and metrics."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/admin.ts — Add analytics endpoints"
      echo "    • frontend/admin/src/pages/Analytics.tsx — Create analytics UI"
      echo ""
      echo "  STEPS:"
      echo "    1. Add analytics endpoints \(users, orders, revenue, growth\)"
      echo "    2. Create Analytics.tsx with charts \(recharts\)"
      echo "    3. Add date range filtering"
      echo "    4. Run Playwright tests"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Admin can view analytics charts"
      echo "    • Data can be filtered by date range"
      echo "    • Charts are responsive"
      echo ""
      echo "  GIT: git add -A && git commit -m '[A4] Add analytics dashboard to admin panel'"
      ;;
    T28)
      echo ""
      log_header "${BOLD}📋 TASK T28 — A5: Admin Home Content Management${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Implement admin UI for managing home content \(news, media,"
      echo "    external API integration\)."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/adminHomeContent.ts — Add content management endpoints"
      echo "    • frontend/admin/src/pages/HomeContent.tsx — Create content manager UI"
      echo ""
      echo "  STEPS:"
      echo "    1. Read routes/adminHomeContent.ts to understand existing routes"
      echo "    2. Add CRUD endpoints for home content items"
      echo "    3. Create HomeContent.tsx with content editor"
      echo "    4. Add preview functionality"
      echo "    5. Run Playwright tests"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Admin can create/edit/delete home content"
      echo "    • Content preview is available"
      echo "    • Changes are reflected on the home page"
      echo ""
      echo "  GIT: git add -A && git commit -m '[A5] Add home content management to admin panel'"
      ;;
    T29)
      echo ""
      log_header "${BOLD}📋 TASK T29 — A6: Admin Local Insights Configuration${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Implement admin UI for configuring aggregate data display"
      echo "    and privacy boundaries."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/admin.ts — Add insights config endpoints"
      echo "    • frontend/admin/src/pages/Settings.tsx — Add insights config UI"
      echo ""
      echo "  STEPS:"
      echo "    1. Add insights configuration endpoints"
      echo "    2. Create configuration UI in Settings.tsx"
      echo "    3. Add privacy boundary controls"
      echo "    4. Run Playwright tests"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Admin can configure which insights are displayed"
      echo "    • Privacy boundaries are configurable"
      echo "    • Changes take effect immediately"
      echo ""
      echo "  GIT: git add -A && git commit -m '[A6] Add local insights configuration to admin panel'"
      ;;
    T30)
      echo ""
      log_header "${BOLD}📋 TASK T30 — S2: Security Input Validation Audit${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Audit all API endpoints for proper input validation using Zod schemas."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/*.ts — Add/improve Zod validation schemas"
      echo ""
      echo "  STEPS:"
      echo "    1. Audit all route files for Zod schema usage"
      echo "    2. Add Zod schemas where missing"
      echo "    3. Ensure all req.body access goes through .parse\(\)"
      echo "    4. Run tests: npx vitest run"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • All endpoints have Zod validation"
      echo "    • No raw req.body access without .parse\(\)"
      echo "    • All tests pass"
      echo ""
      echo "  GIT: git add -A && git commit -m '[S2] Add input validation audit'"
      ;;
    T31)
      echo ""
      log_header "${BOLD}📋 TASK T31 — S5: Security Rate Limiting${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Implement rate limiting on auth and order endpoints."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • server.ts — Add rate limiting middleware"
      echo "    • routes/auth.ts — Add rate limits to auth endpoints"
      echo ""
      echo "  STEPS:"
      echo "    1. Add express-rate-limit package \(if not present\)"
      echo "    2. Configure rate limits for auth endpoints \(5 req/min\)"
      echo "    3. Configure rate limits for order endpoints \(30 req/min\)"
      echo "    4. Test manually with curl"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Auth endpoints are rate limited"
      echo "    • Order endpoints are rate limited"
      echo "    • Rate limit headers are returned"
      echo ""
      echo "  GIT: git add -A && git commit -m '[S5] Add rate limiting'"
      ;;
    T32)
      echo ""
      log_header "${BOLD}📋 TASK T32 — S6: Security PII Masking Audit${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Audit all API responses to ensure PII is properly masked"
      echo "    before contract approval."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • lib/privacyThreshold.ts — Update PII masking rules"
      echo "    • routes/orders.ts — Apply PII masking in responses"
      echo ""
      echo "  STEPS:"
      echo "    1. Read lib/privacyThreshold.ts to understand current masking"
      echo "    2. Audit all order-related endpoints for PII exposure"
      echo "    3. Apply masking where PII is exposed before contract approval"
      echo "    4. Run tests: npx vitest run"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • PII is masked before contract approval"
      echo "    • Phone numbers, emails, addresses are properly masked"
      echo "    • All tests pass"
      echo ""
      echo "  GIT: git add -A && git commit -m '[S6] Add PII masking audit'"
      ;;
    T33)
      echo ""
      log_header "${BOLD}📋 TASK T33 — F2: Frontend Order Wizard Polish${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Polish the order wizard UI for better UX."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • frontend/src/pages/customer/OrderWizard.tsx"
      echo ""
      echo "  STEPS:"
      echo "    1. Read OrderWizard.tsx to understand current flow"
      echo "    2. Improve step indicators and navigation"
      echo "    3. Add loading states and error handling"
      echo "    4. Improve mobile responsiveness"
      echo "    5. Run Playwright tests"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Order wizard has clear step indicators"
      echo "    • Loading and error states are handled"
      echo "    • Mobile responsive"
      echo ""
      echo "  GIT: git add -A && git commit -m '[F2] Polish order wizard UI'"
      ;;
    T34)
      echo ""
      log_header "${BOLD}📋 TASK T34 — F3: Frontend Business Dashboard Polish${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Polish the business dashboard UI."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • frontend/src/pages/business/Dashboard.tsx"
      echo ""
      echo "  STEPS:"
      echo "    1. Read Dashboard.tsx to understand current layout"
      echo "    2. Improve data visualization \(charts, metrics\)"
      echo "    3. Add quick action buttons"
      echo "    4. Improve mobile responsiveness"
      echo "    5. Run Playwright tests"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Business dashboard has clear metrics"
      echo "    • Quick actions are available"
      echo "    • Mobile responsive"
      echo ""
      echo "  GIT: git add -A && git commit -m '[F3] Polish business dashboard UI'"
      ;;
    T35)
      echo ""
      log_header "${BOLD}📋 TASK T35 — F4: Frontend Provider Workspace Polish${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Polish the provider workspace UI."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • frontend/src/pages/provider/Workspace.tsx"
      echo ""
      echo "  STEPS:"
      echo "    1. Read Workspace.tsx to understand current layout"
      echo "    2. Improve order management views"
      echo "    3. Add schedule/calendar view"
      echo "    4. Improve mobile responsiveness"
      echo "    5. Run Playwright tests"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Provider workspace has clear order management"
      echo "    • Schedule view is available"
      echo "    • Mobile responsive"
      echo ""
      echo "  GIT: git add -A && git commit -m '[F4] Polish provider workspace UI'"
      ;;
    T36)
      echo ""
      log_header "${BOLD}📋 TASK T36 — F5: Frontend Notification Center${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Implement notification center UI."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • frontend/src/pages/Notifications.tsx — Create notification center"
      echo "    • routes/notifications.ts — Add notification endpoints"
      echo ""
      echo "  STEPS:"
      echo "    1. Read routes/notifications.ts to understand notification data"
      echo "    2. Create Notifications.tsx with list view"
      echo "    3. Add mark-as-read functionality"
      echo "    4. Add notification badges"
      echo "    5. Run Playwright tests"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Users can view notifications"
      echo "    • Notifications can be marked as read"
      echo "    • Badge shows unread count"
      echo ""
      echo "  GIT: git add -A && git commit -m '[F5] Add notification center'"
      ;;
    T37)
      echo ""
      log_header "${BOLD}📋 TASK T37 — F6: Frontend Mobile Responsiveness${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Ensure all pages are mobile-responsive."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • frontend/src/**/*.tsx — Various components"
      echo ""
      echo "  STEPS:"
      echo "    1. Audit all pages for mobile responsiveness"
      echo "    2. Add responsive breakpoints \(sm, md, lg\)"
      echo "    3. Fix overflow and layout issues"
      echo "    4. Test with Playwright mobile viewport \(375x812\)"
      echo "    5. Take mobile screenshots"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • All pages render correctly on mobile viewport"
      echo "    • No horizontal scroll on mobile"
      echo "    • Touch targets are adequately sized"
      echo ""
      echo "  GIT: git add -A && git commit -m '[F6] Improve mobile responsiveness'"
      ;;
    T38)
      echo ""
      log_header "${BOLD}📋 TASK T38 — F10: Frontend Accessibility Audit${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Audit and fix accessibility issues \(ARIA labels, keyboard"
      echo "    navigation, contrast\)."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • frontend/src/**/*.tsx — Various components"
      echo ""
      echo "  STEPS:"
      echo "    1. Run axe-core or Lighthouse accessibility audit"
      echo "    2. Fix ARIA label issues"
      echo "    3. Ensure keyboard navigation works"
      echo "    4. Fix color contrast issues"
      echo "    5. Run Playwright tests"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • No accessibility violations"
      echo "    • Keyboard navigation works on all pages"
      echo "    • Color contrast meets WCAG AA standards"
      echo "    • All tests pass"
      echo ""
      echo "  GIT: git add -A && git commit -m '[F10] Fix accessibility issues'"
      ;;
    T39)
      echo ""
      log_header "${BOLD}📋 TASK T39 — T3: Integration Tests for Order Flow${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Write integration tests for the complete order flow."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • routes/orders.test.ts — Add order flow integration tests"
      echo "    • routes/quotes.test.ts — Add quote flow integration tests"
      echo ""
      echo "  STEPS:"
      echo "    1. Read existing test files to understand patterns"
      echo "    2. Write tests for: order creation, status transitions,"
      echo "       payment flow, dispute flow, completion flow"
      echo "    3. Write tests for: quote creation, acceptance, decline"
      echo "    4. Run: npx vitest run"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • All order flow paths are tested"
      echo "    • Coverage >= 70% for new code"
      echo "    • All tests pass"
      echo ""
      echo "  GIT: git add -A && git commit -m '[T3] Add integration tests for order flow'"
      ;;
    T40)
      echo ""
      log_header "${BOLD}📋 TASK T40 — T4: E2E Tests for Admin Panel${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Write end-to-end tests for admin panel features."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • frontend/e2e/admin-*.spec.ts — Create E2E tests"
      echo ""
      echo "  STEPS:"
      echo "    1. Read existing E2E tests for patterns"
      echo "    2. Write tests for: login, dashboard, users, KYC,"
      echo "       orders, contracts, payments, media, settings"
      echo "    3. Each test should: load page, verify elements,"
      echo "       interact, take screenshot"
      echo "    4. Run: npx playwright test"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • All admin pages have E2E tests"
      echo "    • Screenshots are saved for each page"
      echo "    • All tests pass"
      echo ""
      echo "  GIT: git add -A && git commit -m '[T4] Add E2E tests for admin panel'"
      ;;
    T41)
      echo ""
      log_header "${BOLD}📋 TASK T41 — T5: Load Testing for Matching Engine${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Write load tests for the matching engine."
      echo ""
      echo "  FILES TO MODIFY:"
      echo "    • scripts/loadTestMatching.ts — NEW file"
      echo ""
      echo "  STEPS:"
      echo "    1. Create scripts/loadTestMatching.ts that:"
      echo "       - Simulates multiple concurrent order submissions"
      echo "       - Measures matching engine response time"
      echo "       - Reports throughput and latency"
      echo "    2. Run: npx tsx scripts/loadTestMatching.ts"
      echo "    3. Document performance baseline"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • Load test runs without errors"
      echo "    • Performance metrics are reported"
      echo "    • Baseline is documented"
      echo ""
      echo "  GIT: git add -A && git commit -m '[T5] Add load testing for matching engine'"
      ;;
    T42)
      echo ""
      log_header "${BOLD}📋 TASK T42 — LAUNCH: Start All Services + UI Verification${NC}"
      echo ""
      echo "  WHAT:"
      echo "    Start all services, run Playwright UI tests on all ports,"
      echo "    verify everything works together."
      echo ""
      echo "  ⚠️  THIS TASK DEPENDS ON ALL PREVIOUS TASKS BEING COMPLETE"
      echo ""
      echo "  STEPS:"
      echo "    1. Kill any existing services"
      echo "    2. Start PostgreSQL \(docker compose up -d postgres\)"
      echo "    3. Start backend: npx tsx server.ts &"
      echo "    4. Wait for backend health: curl http://localhost:8080/api/health"
      echo "    5. Build admin SPA: cd frontend && npm run build:admin"
      echo "    6. Build client SPA: cd frontend && npm run build"
      echo "    7. Start frontend dev: cd frontend && npm run dev -- --port 5173 &"
      echo "    8. Start Flutter web: cd flutter_project && flutter run -d web-server --web-port 7357 &"
      echo "    9. Verify all ports:"
      echo "       - http://localhost:8080/api/health → 200"
      echo "       - http://localhost:5173 → 200"
      echo "       - http://localhost:9090 → 200 \(redirects to /login\)"
      echo "       - http://localhost:7357 → 200"
      echo "   10. Run Playwright UI verification on all ports"
      echo "   11. Take screenshots of each service"
      echo "   12. Verify no console errors"
      echo ""
      echo "  PLAYWRIGHT VERIFICATION \(per port\):"
      echo "    For each URL, follow the UI Verification Protocol:"
      echo "    1. Open the real browser URL"
      echo "    2. Wait for page to fully load"
      echo "    3. Take full-page screenshot → screenshots/launch-<port>-01-initial.png"
      echo "    4. Verify all expected elements are visible"
      echo "    5. Interact with the UI \(click buttons, fill forms\)"
      echo "    6. Take post-interaction screenshot"
      echo "    7. Assert expected outcomes"
      echo "    8. Test error states"
      echo "    9. Test mobile viewport \(375x812\)"
      echo "   10. Take mobile screenshot"
      echo "   11. Verify no console errors"
      echo "   12. Save all screenshots with descriptive filenames"
      echo ""
      echo "  ACCEPTANCE:"
      echo "    • All services are running"
      echo "    • All ports respond correctly"
      echo "    • All Playwright tests pass"
      echo "    • Screenshots are saved for all pages"
      echo "    • No console errors"
      echo ""
      echo "  GIT: git add -A && git commit -m '[LAUNCH] All services verified and running'"
      echo "  TAG: git tag -a v1.0.0 -m 'Phase 2 + Phase 3 complete'"
      echo "  PUSH: git push && git push --tags"
      ;;
    *)
      echo ""
      log_warn "Unknown task: $tid"
      echo "  Available tasks: T1-T42"
      ;;
  esac
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

main() {
  echo ""
  echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${CYAN}║  NEIGHBORLY — Master Automation Script v${SCRIPT_VERSION}         ║${NC}"
  echo -e "${BOLD}${CYAN}║  ${SCRIPT_DATE}                                                ║${NC}"
  echo -e "${BOLD}${CYAN}║  42 tasks · ~40-60 hours estimated                           ║${NC}"
  echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  local mode="${1:-interactive}"

  case "$mode" in
    --status|-s)
      print_progress
      exit 0
      ;;
    --mark-done|-d)
      save_state "$2" "done"
      log_ok "Task $2 marked as done."
      print_progress
      exit 0
      ;;
    --mark-failed|-f)
      save_state "$2" "failed"
      log_ok "Task $2 marked as failed."
      print_progress
      exit 0
      ;;
    --mark-skipped|-k)
      save_state "$2" "skipped"
      log_ok "Task $2 marked as skipped."
      print_progress
      exit 0
      ;;
    --details|-dt)
      print_task_details "$2"
      exit 0
      ;;
    --run|-r)
      local target="$2"
      for task in "${TASKS[@]}"; do
        local tid="${task%%|*}"
        if [ "$tid" = "$target" ]; then
          print_task_details "$tid"
          run_task "$task"
          exit 0
        fi
      done
      log_error "Task $target not found."
      exit 1
      ;;
    --run-range|-rr)
      local range="$2"
      local start="${range%%-*}"
      local end="${range#*-}"
      local run=false
      for task in "${TASKS[@]}"; do
        local tid="${task%%|*}"
        local num="${tid#T}"
        if [ "$num" = "$start" ]; then run=true; fi
        if [ "$run" = true ]; then
          print_task_details "$tid"
          run_task "$task"
        fi
        if [ "$num" = "$end" ]; then break; fi
      done
      exit 0
      ;;
    --skip-checks|-sc)
      log_info "Skipping prerequisite checks."
      ;;
    --help|-h)
      echo "Usage:"
      echo "  ./scripts/master-automation.sh                    # Interactive mode"
      echo "  ./scripts/master-automation.sh --status           # Show progress"
      echo "  ./scripts/master-automation.sh --mark-done T1     # Mark task done"
      echo "  ./scripts/master-automation.sh --mark-failed T1   # Mark task failed"
      echo "  ./scripts/master-automation.sh --details T1       # Show task details"
      echo "  ./scripts/master-automation.sh --run T1           # Run specific task"
      echo "  ./scripts/master-automation.sh --run-range T1-T5  # Run task range"
      echo "  ./scripts/master-automation.sh --skip-checks      # Skip prereq checks"
      exit 0
      ;;
  esac

  # ── Interactive Mode ──────────────────────────────────────────────────────
  check_prerequisites
  verify_all_ports
  print_progress

  echo ""
  echo -e "${BOLD}${CYAN}📋 TASK LIST${NC}"
  echo ""
  printf "${BOLD}%-6s %-45s %-8s %-10s${NC}\n" "ID" "NAME" "EST(H)" "STATUS"
  log_divider
  for task in "${TASKS[@]}"; do
    local tid="${task%%|*}"
    local rest="${task#*|}"
    local tn="${rest%%|*}"
    local rest2="${rest#*|}"
    local rest3="${rest2#*|}"
    local rest4="${rest3#*|}"
    local te="${rest4%%|*}"
    local st="$(get_state "$tid")"
    local st_icon=""
    case "$st" in
      done)        st_icon="${GREEN}✅ Done${NC}" ;;
      in-progress) st_icon="${YELLOW}🔄 In Prog${NC}" ;;
      failed)      st_icon="${RED}❌ Failed${NC}" ;;
      skipped)     st_icon="${CYAN}⏭️ Skip${NC}" ;;
      blocked)     st_icon="${MAGENTA}🚫 Block${NC}" ;;
      *)           st_icon="⏳ Pending" ;;
    esac
    printf "%-6s %-45s %-8s %b\n" "$tid" "$tn" "${te}h" "$st_icon"
  done
  log_divider

  echo ""
  echo -e "${YELLOW}Starting execution from first pending task...${NC}"
  echo ""

  for task in "${TASKS[@]}"; do
    local tid="${task%%|*}"
    local st="$(get_state "$tid")"
    [ "$st" = "done" ] || [ "$st" = "skipped" ] && continue
    run_task "$task"
    echo ""
    echo -e "${YELLOW}⏸️  PAUSED: Task $tid is ready for execution.${NC}"
    echo -e "${YELLOW}   Run './scripts/master-automation.sh --mark-done $tid' when complete.${NC}"
    echo -e "${YELLOW}   Or './scripts/master-automation.sh --mark-failed $tid' if it failed.${NC}"
    echo ""
    exit 0  # Exit after presenting one task — user runs script again to continue
  done

  # ── All tasks complete ─────────────────────────────────────────────────────
  echo ""
  echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║                                                          ║${NC}"
  echo -e "${GREEN}${BOLD}║  🎉 ALL TASKS COMPLETE                                    ║${NC}"
  echo -e "${GREEN}${BOLD}║                                                          ║${NC}"
  echo -e "${GREEN}${BOLD}║  Project is ready for launch!                             ║${NC}"
  echo -e "${GREEN}${BOLD}║                                                          ║${NC}"
  echo -e "${GREEN}${BOLD}║  Next steps:                                              ║${NC}"
  echo -e "${GREEN}${BOLD}║  1. Run full test suite: npx vitest run                   ║${NC}"
  echo -e "${GREEN}${BOLD}║  2. Run Playwright tests: npx playwright test             ║${NC}"
  echo -e "${GREEN}${BOLD}║  3. Build for production: npm run build                   ║${NC}"
  echo -e "${GREEN}${BOLD}║  4. Deploy: docker compose up -d --build                  ║${NC}"
  echo -e "${GREEN}${BOLD}║  5. Push to git: git push                                 ║${NC}"
  echo -e "${GREEN}${BOLD}║                                                          ║${NC}"
  echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

main "$@"
