import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/status_bar.dart';
import '../widgets/bottom_nav.dart';
import '../widgets/responsive_scaffold.dart';
import '../services/auth_service.dart';

/// Phone 5: Business Dashboard screen — AutoFix Vaughan
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _menuOpen = false;
  bool _showBizTab = false;

  @override
  void initState() {
    super.initState();
    _checkRole();
  }

  Future<void> _checkRole() async {
    final role = await AuthService().getUserRole();
    if (role != null &&
        (role.toLowerCase() == 'provider' ||
            role.toLowerCase() == 'owner' ||
            role.toLowerCase() == 'platform_admin')) {
      setState(() => _showBizTab = true);
    }
  }

  static const _stats = [
    ('5', "Today's Appointments", '↑ +2 vs yesterday', AppColors.primary),
    ('2', 'Pending Requests', 'Awaiting your reply', AppColors.warn),
    ('\$1,240', 'Revenue This Week', '↑ 18% vs last week', AppColors.secondary),
    ('4.9 ⭐', 'Avg Rating (184)', '↑ 0.1 this month', AppColors.purple),
  ];

  static const _appointments = [
    ('9:00\nAM', 'John M.', 'Standard Oil Change · \$69', 'confirmed'),
    ('10:30\nAM', 'Sarah K.', 'Full Vehicle Service · \$149', 'pending'),
    ('8:00\nAM', 'Mike L.', 'Tire Rotation · \$40', 'done'),
  ];

  static const _orders = [
    ('Oil Change · Custom Package', 'Mobil 1 Synthetic + K&N Filter', '\$89',
        'New offer', AppColors.secondary),
    ('Winter Prep Package', 'Scheduled for May 12', '\$199', 'Confirmed',
        AppColors.primary),
  ];

  static const _menuItems = [
    ('My Business', Icons.business, true),
    ('Users & Roles', Icons.people, false),
    ('Services', Icons.build, false),
    ('Calendar & Appointments', Icons.calendar_today, false),
    ('Page, Blog & Inventory', Icons.description, false),
    ('My Clients', Icons.person, false),
    ('Offers, Orders & Jobs', Icons.work, false),
    ('Payment Settings', Icons.payment, false),
    ('Invoices', Icons.receipt, false),
  ];

  Color _statusColor(String status) {
    switch (status) {
      case 'confirmed':
        return AppColors.primary;
      case 'pending':
        return AppColors.warn;
      case 'done':
        return AppColors.secondary;
      default:
        return AppColors.text3;
    }
  }

  Color _statusBg(String status) {
    switch (status) {
      case 'confirmed':
        return const Color(0x262B6EFF);
      case 'pending':
        return const Color(0x26FFB800);
      case 'done':
        return const Color(0x260FC98A);
      default:
        return AppColors.border;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'confirmed':
        return 'Confirmed';
      case 'pending':
        return 'Pending';
      case 'done':
        return 'Done';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.bg : AppColorsLight.bg;
    final card = isDark ? AppColors.card : AppColorsLight.card;
    final text = isDark ? AppColors.text : AppColorsLight.text;
    final text2 = isDark ? AppColors.text2 : AppColorsLight.text2;
    final text3 = isDark ? AppColors.text3 : AppColorsLight.text3;
    final border = isDark ? AppColors.border : AppColorsLight.border;

    return Stack(
      children: [
        Column(
          children: [
            const StatusBar(title: '9:41', showNotifDot: true),
            // Dashboard Header
            Container(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
              decoration: BoxDecoration(
                color: bg,
                border: Border(bottom: BorderSide(color: border)),
              ),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => setState(() => _menuOpen = true),
                    child: Icon(Icons.menu, size: 22, color: text),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('My Business',
                            style: TextStyle(
                                fontFamily: 'Space Grotesk',
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: text)),
                        const SizedBox(height: 2),
                        Text('AutoFix Vaughan · Dashboard',
                            style: TextStyle(fontSize: 12, color: text3)),
                      ],
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.secondary.withValues(alpha: 0.1),
                      border: Border.all(
                          color: AppColors.secondary.withValues(alpha: 0.3)),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.circle,
                            size: 8, color: AppColors.secondary),
                        SizedBox(width: 4),
                        Text('● Live',
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppColors.secondary)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final isWide = constraints.maxWidth >= 600;
                  return SingleChildScrollView(
                    child: Column(
                      children: [
                        // Stats Grid - responsive columns
                        Padding(
                          padding: EdgeInsets.all(isWide ? 20 : 14),
                          child: ResponsiveGrid(
                            itemCount: _stats.length,
                            childAspectRatio: isWide ? 2.0 : 1.6,
                            itemBuilder: (context, index) {
                              final stat = _stats[index];
                              final accent = stat.$4;
                              return Container(
                                padding: EdgeInsets.all(isWide ? 18 : 14),
                                decoration: BoxDecoration(
                                  color: card,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: border),
                                ),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(stat.$1,
                                        style: TextStyle(
                                            fontSize: 26,
                                            fontWeight: FontWeight.w700,
                                            fontFamily: 'Space Grotesk',
                                            color: accent)),
                                    const SizedBox(height: 4),
                                    Text(stat.$2,
                                        style: TextStyle(
                                            fontSize: 11, color: text3)),
                                    const SizedBox(height: 6),
                                    Text(stat.$3,
                                        style: TextStyle(
                                            fontSize: 11,
                                            color: stat.$3.startsWith('↑')
                                                ? AppColors.secondary
                                                : text3)),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),
                        // Appointments
                        _buildSection("Today's Appointments", text, text2,
                            text3, card, border, [
                          ..._appointments.map((apt) => Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: card,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border(
                                    left: BorderSide(
                                      color: _statusColor(apt.$4),
                                      width: 3,
                                    ),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    SizedBox(
                                      width: 40,
                                      child: Text(apt.$1,
                                          style: TextStyle(
                                              fontSize: 11,
                                              color: text3,
                                              height: 1.3)),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(apt.$2,
                                              style: TextStyle(
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.w600,
                                                  color: text)),
                                          const SizedBox(height: 2),
                                          Text(apt.$3,
                                              style: TextStyle(
                                                  fontSize: 11,
                                                  color: text2)),
                                        ],
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: _statusBg(apt.$4),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        _statusLabel(apt.$4),
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                          color: _statusColor(apt.$4),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              )),
                        ]),
                        // Recent Offers & Orders
                        _buildSection('Recent Offers & Orders', text, text2,
                            text3, card, border, [
                          ..._orders.map((order) => Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: card,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: border),
                                ),
                                child: Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(order.$1,
                                              style: TextStyle(
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.w600,
                                                  color: text)),
                                          const SizedBox(height: 2),
                                          Text(order.$2,
                                              style: TextStyle(
                                                  fontSize: 11,
                                                  color: text3)),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        Text(order.$3,
                                            style: TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.w700,
                                                color: order.$5)),
                                        const SizedBox(height: 2),
                                        Text(order.$4,
                                            style: TextStyle(
                                                fontSize: 10,
                                                color: order.$5)),
                                      ],
                                    ),
                                  ],
                                ),
                              )),
                        ]),
                        // Wide-layout: side-by-side sections
                        if (isWide)
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                    child: _buildSection(
                                        'Clients', text, text2, text3, card,
                                        border, [
                                  _emptyState(
                                      'No clients yet', 'Add clients here'),
                                ])),
                                const SizedBox(width: 16),
                                Expanded(
                                    child: _buildSection(
                                        'Activity Feed', text, text2, text3,
                                        card, border, [
                                  _emptyState('No activity',
                                      'Recent activity appears here'),
                                ])),
                              ],
                            ),
                          ),
                        SizedBox(
                            height: isWide ? 40 : 80), // space for nav/bottom
                      ],
                    ),
                  );
                },
              ),
            ),
            if (MediaQuery.of(context).size.width < 600)
              const SizedBox(height: 80), // extra for floating nav on mobile
          ],
        ),
        // Floating bottom nav - only on mobile
        if (MediaQuery.of(context).size.width < 600)
          Positioned(
            left: 0,
            right: 0,
            bottom: 24,
            child: BottomNav(
              showBizTab: _showBizTab,
              onItemTap: (id) {
                if (id == 'home')
                  Navigator.pushReplacementNamed(context, '/home');
                if (id == 'social')
                  Navigator.pushReplacementNamed(context, '/social');
                if (id == 'activity')
                  Navigator.pushReplacementNamed(context, '/activity');
                if (id == 'biz')
                  Navigator.pushReplacementNamed(context, '/dashboard');
              },
              items: const [
                BottomNavItem(id: 'home', label: 'Home', icon: Icons.home),
                BottomNavItem(
                    id: 'social', label: 'Social', icon: Icons.people),
                BottomNavItem(
                    id: 'activity',
                    label: 'Activity',
                    icon: Icons.auto_awesome_motion),
                BottomNavItem(
                    id: 'biz',
                    label: 'Business',
                    icon: Icons.business,
                    isBiz: true,
                    active: true),
              ],
            ),
          ),
        // Menu Sidebar
        if (_menuOpen)
          GestureDetector(
            onTap: () => setState(() => _menuOpen = false),
            child: Container(color: Colors.black.withValues(alpha: 0.6)),
          ),
        if (_menuOpen)
          Align(
            alignment: Alignment.centerLeft,
            child: Container(
              width: 260,
              color: bg,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.fromLTRB(18, 52, 18, 20),
                    decoration: BoxDecoration(
                      border: Border(
                          bottom: BorderSide(color: border)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: AppColors.accent,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Center(
                            child: Text('A',
                                style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                    fontFamily: 'Space Grotesk')),
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Text('AutoFix Vaughan',
                            style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: AppColors.text,
                                fontFamily: 'Space Grotesk')),
                        const SizedBox(height: 2),
                        const Text('@autofix_vaughan',
                            style: TextStyle(
                                fontSize: 11, color: AppColors.text3)),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color:
                                AppColors.secondary.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.circle,
                                  size: 8, color: AppColors.secondary),
                              SizedBox(width: 4),
                              Text('Active',
                                  style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.secondary)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  ..._menuItems.map((item) => Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 18, vertical: 13),
                        decoration: BoxDecoration(
                          color: item.$3
                              ? AppColors.primary.withValues(alpha: 0.08)
                              : Colors.transparent,
                          border: Border(
                            left: BorderSide(
                              color: item.$3
                                  ? AppColors.primary
                                  : Colors.transparent,
                              width: 3,
                            ),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(item.$2,
                                size: 18,
                                color: item.$3
                                    ? AppColors.primary
                                    : AppColors.text2),
                            const SizedBox(width: 12),
                            Text(item.$1,
                                style: TextStyle(
                                    fontSize: 14,
                                    color: item.$3
                                        ? AppColors.primary
                                        : AppColors.text2)),
                          ],
                        ),
                      )),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 18, vertical: 13),
                    child: const Row(
                      children: [
                        Icon(Icons.settings,
                            size: 18, color: AppColors.text2),
                        SizedBox(width: 12),
                        Text('Settings',
                            style: TextStyle(
                                fontSize: 14, color: AppColors.text2)),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 18, vertical: 13),
                    child: const Row(
                      children: [
                        Icon(Icons.logout, size: 18, color: AppColors.red),
                        SizedBox(width: 12),
                        Text('Logout',
                            style: TextStyle(
                                fontSize: 14, color: AppColors.red)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _emptyState(String title, String subtitle) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          const Icon(Icons.inbox, size: 32, color: AppColors.text3),
          const SizedBox(height: 8),
          Text(title,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.text)),
          const SizedBox(height: 4),
          Text(subtitle,
              style:
                  const TextStyle(fontSize: 11, color: AppColors.text3),
              textAlign: TextAlign.center),
        ],
      ),
    );
  }

  Widget _buildSection(
      String title,
      Color text,
      Color text2,
      Color text3,
      Color card,
      Color border,
      List<Widget> children) {
    return ResponsivePadding(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(title,
                    style:
                        TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: text2)),
                const Text('See all →',
                    style: TextStyle(fontSize: 11, color: AppColors.primary)),
              ],
            ),
          ),
          ...children,
        ],
      ),
    );
  }
}