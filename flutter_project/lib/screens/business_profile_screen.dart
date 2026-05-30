import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/status_bar.dart';
import '../widgets/bottom_nav.dart';

/// Phone 4: Business Profile screen — AutoFix Vaughan
class BusinessProfileScreen extends StatefulWidget {
  const BusinessProfileScreen({super.key});

  @override
  State<BusinessProfileScreen> createState() => _BusinessProfileScreenState();
}

class _BusinessProfileScreenState extends State<BusinessProfileScreen> {
  int _pkgTab = 0;

  static const _packages = [
    ('Standard Oil Change', '\$69', '/service', AppColors.accent, 'Best Seller', 'Includes oil + filter + 21-point check'),
    ('Full Vehicle Service', '\$149', '/service', AppColors.primary, 'Recommended', 'Brake inspection, fluid top-up, tire rotation'),
    ('Winter Prep Package', '\$199', '/service', AppColors.secondary, 'New', 'Tires, battery, antifreeze, wipers'),
  ];

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Column(
          children: [
            const StatusBar(title: '9:41', showNotifDot: true),
            // Back + Share header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: const BoxDecoration(
                color: AppColors.bg,
                border: Border(bottom: BorderSide(color: AppColors.border)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.arrow_back, size: 20, color: AppColors.text2),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text('Business Profile',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
                  ),
                  Icon(Icons.share, size: 20, color: AppColors.text2),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    // Cover + Logo
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Container(
                          height: 110,
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(colors: [Color(0xFFAC2B1A), Color(0xFF280A00)]),
                          ),
                        ),
                        Positioned(
                          bottom: -28,
                          left: 18,
                          child: Container(
                            width: 56,
                            height: 56,
                            decoration: BoxDecoration(
                              color: AppColors.accent,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: AppColors.bg2, width: 3),
                            ),
                            child: const Center(
                              child: Text('A',
                                  style: TextStyle(
                                      fontSize: 22,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white,
                                      fontFamily: 'Space Grotesk')),
                            ),
                          ),
                        ),
                        Positioned(
                          bottom: -28,
                          left: 82,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.check, size: 12, color: Colors.white),
                                SizedBox(width: 4),
                                Text('Verified',
                                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 36),
                    // Business Info
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 0, 18, 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('AutoFix Vaughan',
                              style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.text,
                                  fontFamily: 'Space Grotesk')),
                          const SizedBox(height: 4),
                          const Text('@autofix_vaughan · Auto Repair & Service',
                              style: TextStyle(fontSize: 12, color: AppColors.text3)),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              _chip('⭐ 4.9 (184 reviews)'),
                              _chip('🏆 12 yrs active'),
                              _chip('📍 Vaughan, ON'),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              _chip('🛡️ Insured', color: AppColors.secondary, borderColor: const Color(0x4D0FC98A)),
                              _chip('✅ Warranty', color: AppColors.warn, borderColor: const Color(0x4DFFB800)),
                              _chip('📋 Lic: ON-7823-AUTO'),
                            ],
                          ),
                        ],
                      ),
                    ),
                    // Package Tabs
                    Container(
                      decoration: const BoxDecoration(
                        color: AppColors.bg,
                        border: Border(bottom: BorderSide(color: AppColors.border)),
                      ),
                      child: Row(
                        children: ['Packages', 'Inventory', 'Reviews', 'About'].asMap().entries.map((e) {
                          final active = e.key == _pkgTab;
                          return Expanded(
                            child: GestureDetector(
                              onTap: () => setState(() => _pkgTab = e.key),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 13),
                                decoration: BoxDecoration(
                                  border: Border(
                                    bottom: BorderSide(
                                      color: active ? AppColors.primary : Colors.transparent,
                                      width: 2,
                                    ),
                                  ),
                                ),
                                child: Text(
                                  e.value,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                    color: active ? AppColors.primary : AppColors.text3,
                                  ),
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                    // Package Cards
                    ..._packages.map((pkg) => _buildPackageCard(pkg)),
                    // Custom Builder
                    _buildCustomBuilder(),
                    const SizedBox(height: 80), // space for floating nav
                  ],
                ),
              ),
            ),
          ],
        ),
        // Floating bottom nav
        Positioned(
          left: 0,
          right: 0,
          bottom: 24,
          child: const BottomNav(
            showBizTab: true,
            items: [
              BottomNavItem(id: 'home', label: 'Home', icon: Icons.home),
              BottomNavItem(id: 'social', label: 'Social', icon: Icons.people),
              BottomNavItem(id: 'account', label: 'Account', icon: Icons.person),
              BottomNavItem(id: 'biz', label: 'Business', icon: Icons.business, isBiz: true, active: true),
            ],
          ),
        ),
      ],
    );
  }

  Widget _chip(String text, {Color? color, Color? borderColor}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.bg3,
        border: Border.all(color: borderColor ?? AppColors.border),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(text,
          style: TextStyle(fontSize: 11, color: color ?? AppColors.text2)),
    );
  }

  Widget _buildPackageCard(dynamic pkg) {
    final accent = pkg.$4 as Color;
    final tag = pkg.$5 as String?;
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 12, 14, 0),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Stack(
        children: [
          Positioned(
            left: 0,
            top: 0,
            bottom: 0,
            child: Container(
              width: 4,
              decoration: BoxDecoration(
                color: accent,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(14),
                  bottomLeft: Radius.circular(14),
                ),
              ),
            ),
          ),
          if (tag != null)
            Positioned(
              top: 12,
              right: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(tag,
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: accent)),
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 60),
                  child: Text(pkg.$1 as String,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
                ),
                const SizedBox(height: 4),
                Text(pkg.$6 as String,
                    style: const TextStyle(fontSize: 11, color: AppColors.text3)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Text(pkg.$2 as String,
                        style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                            fontFamily: 'Space Grotesk',
                            color: accent)),
                    Text(pkg.$3 as String,
                        style: const TextStyle(fontSize: 12, color: AppColors.text3)),
                  ],
                ),
              ],
            ),
          ),
          Positioned(
            bottom: 14,
            right: 0,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text('Add to Cart',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCustomBuilder() {
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 12, 14, 0),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bg3,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.build, size: 20, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Build Custom Package',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary)),
                SizedBox(height: 2),
                Text('Choose your own oil, filters & parts',
                    style: TextStyle(fontSize: 11, color: AppColors.text2)),
              ],
            ),
          ),
          const Text('›', style: TextStyle(fontSize: 20, color: AppColors.primary)),
        ],
      ),
    );
  }
}
