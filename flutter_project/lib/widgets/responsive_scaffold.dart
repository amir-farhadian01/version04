import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// A responsive scaffold that adapts layout based on screen width.
///
/// - **Mobile** (< 600px): full-width, no side margins
/// - **Tablet** (600–1024px): centered with max-width 540px
/// - **Desktop** (> 1024px): centered with max-width 480px (phone-like card)
///   OR full-width for admin/business dashboards
class ResponsiveScaffold extends StatelessWidget {
  final Widget child;
  /// If true, on desktop the child gets full width (e.g. admin/dashboard views)
  final bool expandOnDesktop;
  /// Maximum width when not expanded on desktop
  final double maxWidth;

  const ResponsiveScaffold({
    super.key,
    required this.child,
    this.expandOnDesktop = false,
    this.maxWidth = 480,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isMobile = constraints.maxWidth < 600;
        final isTablet = constraints.maxWidth >= 600 && constraints.maxWidth < 1024;
        final isDesktop = constraints.maxWidth >= 1024;

        if (isMobile) {
          // Full width on mobile
          return Scaffold(
            backgroundColor: Theme.of(context).brightness == Brightness.dark
                ? AppColors.bg
                : AppColorsLight.bg,
            body: SafeArea(child: child),
          );
        }

        // Tablet or Desktop
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final outerBg = isDark ? AppColors.bg2 : AppColorsLight.bg2;
        final containerBg = isDark ? AppColors.bg : AppColorsLight.bg;

        if (expandOnDesktop && isDesktop) {
          // Full-width layout for dashboards on desktop
          return Scaffold(
            backgroundColor: containerBg,
            body: SafeArea(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1200),
                  child: child,
                ),
              ),
            ),
          );
        }

        // Phone-like card on tablet/desktop
        final cardWidth = isTablet ? 540.0 : maxWidth;
        return Scaffold(
          backgroundColor: outerBg,
          body: SafeArea(
            child: Center(
              child: Container(
                width: cardWidth,
                decoration: BoxDecoration(
                  color: containerBg,
                  borderRadius: BorderRadius.circular(isTablet ? 16 : 24),
                  border: Border.all(
                    color: isDark ? AppColors.border2 : AppColorsLight.border2,
                    width: 1.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.3),
                      blurRadius: isDesktop ? 80 : 40,
                      offset: const Offset(0, 32),
                    ),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: child,
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Shared responsive padding that adapts to screen width
class ResponsivePadding extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? mobilePadding;
  final EdgeInsetsGeometry? tabletPadding;
  final EdgeInsetsGeometry? desktopPadding;

  const ResponsivePadding({
    super.key,
    required this.child,
    this.mobilePadding,
    this.tabletPadding,
    this.desktopPadding,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        EdgeInsetsGeometry padding;
        if (constraints.maxWidth < 600) {
          padding = mobilePadding ?? const EdgeInsets.all(14);
        } else if (constraints.maxWidth < 1024) {
          padding = tabletPadding ?? const EdgeInsets.symmetric(horizontal: 20, vertical: 16);
        } else {
          padding = desktopPadding ?? const EdgeInsets.symmetric(horizontal: 24, vertical: 20);
        }
        return Padding(padding: padding, child: child);
      },
    );
  }
}

/// Responsive grid that switches column count based on screen width
class ResponsiveGrid extends StatelessWidget {
  final int itemCount;
  final Widget Function(BuildContext, int) itemBuilder;
  final double childAspectRatio;
  final double crossAxisSpacing;
  final double mainAxisSpacing;

  const ResponsiveGrid({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
    this.childAspectRatio = 1.6,
    this.crossAxisSpacing = 10,
    this.mainAxisSpacing = 10,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        int crossAxisCount;
        if (constraints.maxWidth < 400) {
          crossAxisCount = 2;
        } else if (constraints.maxWidth < 600) {
          crossAxisCount = 2;
        } else if (constraints.maxWidth < 900) {
          crossAxisCount = 3;
        } else {
          crossAxisCount = 4;
        }
        // Never exceed itemCount
        if (crossAxisCount > itemCount && itemCount > 0) {
          crossAxisCount = itemCount;
        }
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            crossAxisSpacing: crossAxisSpacing,
            mainAxisSpacing: mainAxisSpacing,
            childAspectRatio: childAspectRatio,
          ),
          itemCount: itemCount,
          itemBuilder: itemBuilder,
        );
      },
    );
  }
}