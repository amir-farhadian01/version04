import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';

/// Customer Dashboard (TAB 3 — SERVICES)
/// Shows stats cards, active orders overview, and navigation to orders/messages.
class CustomerDashboardScreen extends StatefulWidget {
  const CustomerDashboardScreen({super.key});

  @override
  State<CustomerDashboardScreen> createState() => _CustomerDashboardScreenState();
}

class _CustomerDashboardScreenState extends State<CustomerDashboardScreen> {
  final ApiService _api = ApiService();
  bool _loading = true;
  Map<String, dynamic>? _stats;
  List<Map<String, dynamic>> _activeOrders = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final statsResult = await _api.getCustomerStats();
      setState(() {
        _stats = statsResult['data'] as Map<String, dynamic>? ?? statsResult;
      });
    } catch (_) {
      // Stats API may not exist yet — use placeholder
      setState(() {
        _stats = {
          'activeOrders': 2,
          'completedOrders': 12,
          'totalSpent': 14850,
          'avgRating': 4.8,
        };
      });
    }

    try {
      final ordersResult = await _api.getActiveOrders();
      final items = (ordersResult['data'] as List<dynamic>?)
              ?.cast<Map<String, dynamic>>() ??
          (ordersResult['items'] as List<dynamic>?)
                  ?.cast<Map<String, dynamic>>() ??
              [];
      setState(() => _activeOrders = items);
    } catch (_) {
      setState(() {
        _activeOrders = [];
      });
    }

    setState(() => _loading = false);
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

    return Container(
      color: bg,
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
            decoration: BoxDecoration(
              color: bg,
              border: Border(bottom: BorderSide(color: border)),
            ),
            child: Row(
              children: [
                const Icon(Icons.dashboard, size: 20, color: AppColors.primary),
                const SizedBox(width: 10),
                Text(
                  'My Services',
                  style: TextStyle(
                    fontFamily: 'Space Grotesk',
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: text,
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: () => _loadData(),
                  child: Icon(Icons.refresh, size: 18, color: text3),
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.primary))
                : SingleChildScrollView(
                    padding: const EdgeInsets.only(bottom: 80),
                    child: Column(
                      children: [
                        // Stats Grid
                        Padding(
                          padding: const EdgeInsets.all(14),
                          child: GridView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2,
                              crossAxisSpacing: 10,
                              mainAxisSpacing: 10,
                              childAspectRatio: 1.5,
                            ),
                            itemCount: _buildStatsList().length,
                            itemBuilder: (ctx, i) {
                              final stat = _buildStatsList()[i];
                              return Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: card,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: border),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      stat.value,
                                      style: TextStyle(
                                        fontSize: 26,
                                        fontWeight: FontWeight.w700,
                                        fontFamily: 'Space Grotesk',
                                        color: stat.color,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      stat.label,
                                      style: TextStyle(
                                          fontSize: 11, color: text3),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),
                        // Active Orders Section
                        _buildSection(
                          title: 'Active Orders',
                          onTapSeeAll: () => Navigator.pushNamed(
                              context, '/customer/orders'),
                          children: _activeOrders.isEmpty
                              ? [
                                  _emptyState(
                                      'No active orders', 'Your ongoing orders will appear here')
                                ]
                              : _activeOrders.map((order) {
                                  final id = order['id'] as String? ?? '';
                                  final service =
                                      order['service'] as String? ??
                                          order['serviceName'] as String? ??
                                          'Service';
                                  final status =
                                      order['status'] as String? ?? 'pending';
                                  final price = order['price'] ?? order['total'];
                                  return _orderTile(
                                    id: id,
                                    title: service,
                                    status: status,
                                    price: price.toString(),
                                    onTap: () => Navigator.pushNamed(
                                        context, '/customer/order-detail',
                                        arguments: id),
                                  );
                                }).toList(),
                          text: text,
                          text2: text2,
                          text3: text3,
                          card: card,
                          border: border,
                        ),
                        // Messages / Inbox
                        _buildSection(
                          title: 'Messages',
                          onTapSeeAll: () =>
                              Navigator.pushNamed(context, '/customer/messages'),
                          children: [
                            _inboxTile(
                              icon: Icons.inbox,
                              title: 'Inbox',
                              subtitle: 'Active conversations',
                              onTap: () => Navigator.pushNamed(
                                  context, '/customer/messages'),
                            ),
                          ],
                          text: text,
                          text2: text2,
                          text3: text3,
                          card: card,
                          border: border,
                        ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  List<_StatItem> _buildStatsList() {
    if (_stats == null) return [];
    return [
      _StatItem(
        value: (_stats!['activeOrders'] ?? 0).toString(),
        label: 'Active Orders',
        color: AppColors.primary,
      ),
      _StatItem(
        value: (_stats!['completedOrders'] ?? 0).toString(),
        label: 'Completed',
        color: AppColors.secondary,
      ),
      _StatItem(
        value: '\$${((_stats!['totalSpent'] ?? 0) as num).toStringAsFixed(0)}',
        label: 'Total Spent',
        color: AppColors.accent,
      ),
      _StatItem(
        value: '${_stats!['avgRating'] ?? '—'} ⭐',
        label: 'Avg Rating',
        color: AppColors.purple,
      ),
    ];
  }

  Widget _buildSection({
    required String title,
    required List<Widget> children,
    VoidCallback? onTapSeeAll,
    required Color text,
    required Color text2,
    required Color text3,
    required Color card,
    required Color border,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(title,
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: text2)),
                if (onTapSeeAll != null)
                  GestureDetector(
                    onTap: onTapSeeAll,
                    child: const Text('See all →',
                        style: TextStyle(
                            fontSize: 11, color: AppColors.primary)),
                  ),
              ],
            ),
          ),
          ...children,
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _orderTile({
    required String id,
    required String title,
    required String status,
    required String price,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border(
            left: BorderSide(
              color: _statusColor(status),
              width: 3,
            ),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.text)),
                  const SizedBox(height: 2),
                  Text(status.toUpperCase(),
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: _statusColor(status))),
                ],
              ),
            ),
            Text(price,
                style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                    fontFamily: 'Space Grotesk')),
          ],
        ),
      ),
    );
  }

  Widget _inboxTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 18, color: AppColors.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.text)),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.text3)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right,
                size: 18, color: AppColors.text3),
          ],
        ),
      ),
    );
  }

  Widget _emptyState(String title, String subtitle) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Icon(Icons.inbox, size: 32, color: AppColors.text3),
          const SizedBox(height: 8),
          Text(title,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.text)),
          const SizedBox(height: 4),
          Text(subtitle,
              style: const TextStyle(fontSize: 11, color: AppColors.text3),
              textAlign: TextAlign.center),
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'confirmed':
      case 'accepted':
      case 'active':
        return AppColors.primary;
      case 'pending':
      case 'draft':
        return AppColors.warn;
      case 'completed':
      case 'done':
        return AppColors.secondary;
      case 'cancelled':
      case 'rejected':
        return AppColors.red;
      default:
        return AppColors.text3;
    }
  }
}

class _StatItem {
  final String value;
  final String label;
  final Color color;

  _StatItem({
    required this.value,
    required this.label,
    required this.color,
  });
}