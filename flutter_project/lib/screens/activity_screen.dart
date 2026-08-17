import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/status_bar.dart';
import '../widgets/bottom_nav.dart';
import '../services/auth_service.dart';

/// Activity screen showing recent user activity
class ActivityScreen extends StatefulWidget {
  const ActivityScreen({super.key});

  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  bool _showBizTab = false;

  static const _activities = [
    ('Your order was confirmed', 'Mike\'s Plumbing', Icons.check_circle, AppColors.secondary, '2 min ago'),
    ('New provider in your area', 'CleanPro Services joined NeighborHub', Icons.person_add, AppColors.primary, '15 min ago'),
    ('Service request accepted', 'Sarah M. accepted your Electrical Repair request', Icons.handshake, AppColors.accent, '1 hour ago'),
    ('Payment received', '\$149.00 for Deep Cleaning service', Icons.payment, AppColors.secondary, '3 hours ago'),
    ('Review reminder', 'Rate your experience with FixIt Co.', Icons.rate_review, AppColors.warn, '5 hours ago'),
    ('Appointment rescheduled', 'AC Service moved to Jun 15 at 2:00 PM', Icons.schedule, AppColors.primary, '1 day ago'),
  ];

  @override
  void initState() {
    super.initState();
    _checkRole();
  }

  Future<void> _checkRole() async {
    final role = await AuthService().getUserRole();
    if (role != null && (role.toLowerCase() == 'provider' || role.toLowerCase() == 'owner' || role.toLowerCase() == 'platform_admin')) {
      setState(() => _showBizTab = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Column(
          children: [
            const StatusBar(title: '9:41', showNotifDot: true),
            // Header
            Container(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
              decoration: const BoxDecoration(
                color: AppColors.bg,
                border: Border(bottom: BorderSide(color: AppColors.border)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.auto_awesome_motion, size: 20, color: AppColors.primary),
                  SizedBox(width: 10),
                  Text('Activity',
                      style: TextStyle(
                          fontFamily: 'Space Grotesk',
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppColors.text)),
                ],
              ),
            ),
            // Activity list
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
                children: _activities.map((act) => _buildActivityItem(act)).toList(),
              ),
            ),
          ],
        ),
        // Floating bottom nav
        Positioned(
          left: 0,
          right: 0,
          bottom: 24,
          child: BottomNav(
            showBizTab: _showBizTab,
            onItemTap: (id) {
              if (id == 'home') Navigator.pushReplacementNamed(context, '/home');
              if (id == 'social') Navigator.pushReplacementNamed(context, '/feed');
              if (id == 'activity') Navigator.pushReplacementNamed(context, '/activity');
              if (id == 'biz') Navigator.pushReplacementNamed(context, '/dashboard');
            },
            items: const [
              BottomNavItem(id: 'home', label: 'Home', icon: Icons.home),
              BottomNavItem(id: 'social', label: 'Social', icon: Icons.people),
              BottomNavItem(id: 'activity', label: 'Activity', icon: Icons.auto_awesome_motion, active: true),
              BottomNavItem(id: 'biz', label: 'Business', icon: Icons.business, isBiz: true),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildActivityItem(dynamic act) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: (act.$4 as Color).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(act.$3 as IconData, size: 18, color: act.$4 as Color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(act.$1 as String,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text)),
                const SizedBox(height: 2),
                Text(act.$2 as String,
                    style: const TextStyle(fontSize: 11, color: AppColors.text2)),
                const SizedBox(height: 4),
                Text(act.$5 as String,
                    style: const TextStyle(fontSize: 10, color: AppColors.text3)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
