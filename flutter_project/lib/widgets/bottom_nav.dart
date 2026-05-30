import 'dart:ui';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class BottomNavItem {
  final String id;
  final String label;
  final IconData icon;
  final bool active;
  final bool isBiz;

  const BottomNavItem({
    required this.id,
    required this.label,
    required this.icon,
    this.active = false,
    this.isBiz = false,
  });
}

/// Floating glassmorphic bottom navigation bar.
/// Rendered as a positioned widget — wrap your screen in a Stack and place
/// this at the bottom with [BottomNavWrapper].
class BottomNav extends StatelessWidget {
  final List<BottomNavItem> items;
  final ValueChanged<String>? onItemTap;
  final bool showBizTab;

  const BottomNav({
    super.key,
    required this.items,
    this.onItemTap,
    this.showBizTab = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Filter items: only show Business tab if showBizTab is true
    final filteredItems = showBizTab
        ? items
        : items.where((item) => !item.isBiz).toList();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 40),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            height: 64,
            decoration: BoxDecoration(
              color: (isDark ? AppColors.card : AppColorsLight.card)
                  .withValues(alpha: 0.75),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(
                color: (isDark ? AppColors.border : AppColorsLight.border)
                    .withValues(alpha: 0.3),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.15),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Row(
              children: filteredItems.map((item) {
                final color = item.active
                    ? (isDark ? AppColors.primary : AppColorsLight.primary)
                    : item.isBiz
                        ? (isDark ? AppColors.accent : AppColorsLight.accent)
                        : (isDark ? AppColors.text3 : AppColorsLight.text3);
                return Expanded(
                  child: GestureDetector(
                    onTap: () => onItemTap?.call(item.id),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(item.icon, size: 22, color: color),
                        const SizedBox(height: 3),
                        Text(
                          item.label,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w500,
                            color: color,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ),
      ),
    );
  }
}

/// Wraps the BottomNav in a positioned container at the bottom of a Stack.
/// Use this in screens that need the floating nav.
class BottomNavWrapper extends StatelessWidget {
  final BottomNav child;

  const BottomNavWrapper({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 0,
      right: 0,
      bottom: 24,
      child: child,
    );
  }
}
