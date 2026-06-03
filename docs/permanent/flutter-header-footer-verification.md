# Flutter Header/Footer Verification

> Created: 2026-06-02T23:17:55.792Z
> Total tasks: 6

---

## TASK 1: Clean hung terminals and kill stale processes

Kill all hung terminal processes, clear background jobs, free up ports 7357, 5173, 8080, 9090. Use `pkill -f` and `kill %N` to clean up.

---

## TASK 2: Start Flutter web server on port 7357

Run `cd /home/amir/version04/flutter_project && flutter run -d web-server --web-port 7357` in background. Wait for it to start and verify with curl http://localhost:7357 returns 200.

---

## TASK 3: Test Flutter /order/new page with Playwright

Use Playwright MCP to navigate to http://localhost:7357/#/order/new. Take screenshot. Verify header shows 'New Order' title and back button. Verify footer/back button exists. Take screenshot for evidence.

---

## TASK 4: Test Flutter /auth page with Playwright

Use Playwright MCP to navigate to http://localhost:7357/#/auth. Take screenshot. Verify header shows 'Sign In' title and back button.

---

## TASK 5: Test Flutter /home page with Playwright

Use Playwright MCP to navigate to http://localhost:7357/#/home. Take screenshot. Verify BottomNav is visible with Home/Explorer/Activity tabs.

---

## TASK 6: Verify all screenshots and report

Take all screenshots, verify header/footer presence in each, report results.

---

