import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class StatusBar extends StatelessWidget {
  final String title;
  final VoidCallback? onNotifTap;
  final bool showNotifDot;

  const StatusBar({
    super.key,
    this.title = '9:41',
    this.onNotifTap,
    this.showNotifDot = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(22, 14, 22, 8),
      height: 48,
      decoration: const BoxDecoration(
        color: AppColors.bg,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontFamily: 'Space Grotesk',
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.text,
            ),
          ),
          Row(
            children: [
              _WifiIcon(),
              const SizedBox(width: 6),
              _BatteryIcon(),
              if (onNotifTap != null) ...[
                const SizedBox(width: 6),
                GestureDetector(
                  onTap: onNotifTap,
                  child: Stack(
                    children: [
                      const Icon(Icons.notifications_outlined,
                          size: 18, color: AppColors.text2),
                      if (showNotifDot)
                        Positioned(
                          top: -2,
                          right: -2,
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: AppColors.red,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _WifiIcon extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return const Icon(Icons.wifi, size: 14, color: AppColors.text);
  }
}

class _BatteryIcon extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return const Icon(Icons.battery_full, size: 14, color: AppColors.text);
  }
}
