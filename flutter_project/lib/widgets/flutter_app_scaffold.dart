import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'bottom_nav.dart';
import 'responsive_scaffold.dart';

/// FlutterAppScaffold — Consistent app wrapper for ALL screens.
///
/// Provides:
/// - ResponsiveScaffold outer shell (phone-card on desktop, full-width on mobile)
/// - Optional PageHeader (back button + title bar)
/// - Scrollable child content area
/// - Optional BottomNav (floating, only shown on main tabs)
///
/// This replaces ad-hoc AppBars scattered across individual screens,
/// ensuring every page has consistent chrome.
class FlutterAppScaffold extends StatelessWidget {
  final Widget child;
  final String? title;
  final bool showBack;
  final VoidCallback? onBack;
  final bool showBottomNav;
  final String? currentTab;
  final bool showBizTab;
  final bool expandOnDesktop;
  final List<Widget>? actions;
  final Widget? bottomWidget;

  const FlutterAppScaffold({
    super.key,
    required this.child,
    this.title,
    this.showBack = false,
    this.onBack,
    this.showBottomNav = false,
    this.currentTab,
    this.showBizTab = false,
    this.expandOnDesktop = false,
    this.actions,
    this.bottomWidget,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? AppColors.bg : AppColorsLight.bg;
    final borderColor = isDark ? AppColors.border : AppColorsLight.border;
    final textColor = isDark ? AppColors.text : AppColorsLight.text;

    final effectiveActions = actions ?? <Widget>[];
    final hasActions = effectiveActions.isNotEmpty;
    final hasHeader = title != null || showBack || hasActions;

    // Build the inner column (header + body + optional footer)
    Widget inner = Column(
      children: [
        // ── Header ──
        if (hasHeader)
          Container(
            decoration: BoxDecoration(
              color: bgColor,
              border: Border(
                bottom: BorderSide(
                  color: borderColor.withValues(alpha: 0.3),
                  width: 1,
                ),
              ),
            ),
            child: SafeArea(
              bottom: false,
              child: SizedBox(
                height: 44,
                child: Row(
                  children: [
                    // Leading: back button or spacer
                    if (showBack)
                      SizedBox(
                        width: 48,
                        child: IconButton(
                          icon: const Icon(Icons.arrow_back, size: 22),
                          onPressed: onBack ?? () => Navigator.of(context).maybePop(),
                          tooltip: 'Back',
                          padding: EdgeInsets.zero,
                        ),
                      )
                    else
                      const SizedBox(width: 48),

                    // Title
                    Expanded(
                      child: title != null
                          ? Text(
                              title!,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: textColor,
                              ),
                              overflow: TextOverflow.ellipsis,
                            )
                          : const SizedBox.shrink(),
                    ),

                    // Trailing: actions or spacer
                    if (hasActions)
                      SizedBox(
                        width: 48.0 * effectiveActions.length.clamp(0, 2),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: effectiveActions.map((a) => SizedBox(width: 48, child: a)).toList(),
                        ),
                      )
                    else
                      const SizedBox(width: 48),
                  ],
                ),
              ),
            ),
          ),

        // ── Content ──
        Expanded(child: child),

        // ── Footer widget (optional, for custom bottom elements) ──
        if (bottomWidget != null) bottomWidget!,
      ],
    );

    // If bottom nav is enabled, wrap in a Stack with floating nav
    if (showBottomNav) {
      final tabs = <BottomNavItem>[
        BottomNavItem(
          id: 'home',
          label: 'Home',
          icon: Icons.home_rounded,
          active: currentTab == 'home',
        ),
        BottomNavItem(
          id: 'explorer',
          label: 'Explorer',
          icon: Icons.explore_rounded,
          active: currentTab == 'explorer',
        ),
        BottomNavItem(
          id: 'activity',
          label: 'Activity',
          icon: Icons.notifications_none_rounded,
          active: currentTab == 'activity',
        ),
        if (showBizTab)
          BottomNavItem(
            id: 'biz',
            label: 'Business',
            icon: Icons.business_rounded,
            active: currentTab == 'biz',
            isBiz: true,
          ),
      ];

      inner = Stack(
        children: [
          inner,
          BottomNavWrapper(
            child: BottomNav(
              items: tabs,
              showBizTab: showBizTab,
            ),
          ),
        ],
      );
    }

    return ResponsiveScaffold(
      expandOnDesktop: expandOnDesktop,
      child: inner,
    );
  }
}