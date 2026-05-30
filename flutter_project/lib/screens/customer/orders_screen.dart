import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';

/// Orders screen with Active and Completed tabs.
class CustomerOrdersScreen extends StatefulWidget {
  const CustomerOrdersScreen({super.key});

  @override
  State<CustomerOrdersScreen> createState() => _CustomerOrdersScreenState();
}

class _CustomerOrdersScreenState extends State<CustomerOrdersScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final ApiService _api = ApiService();
  bool _loading = true;
  List<Map<String, dynamic>> _activeOrders = [];
  List<Map<String, dynamic>> _completedOrders = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadOrders();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadOrders() async {
    setState(() => _loading = true);
    try {
      final active = await _api.getActiveOrders();
      _activeOrders = _extractList(active);
    } catch (_) {
      _activeOrders = _mockActive();
    }
    try {
      final completed = await _api.getCompletedOrders();
      _completedOrders = _extractList(completed);
    } catch (_) {
      _completedOrders = _mockCompleted();
    }
    setState(() => _loading = false);
  }

  List<Map<String, dynamic>> _extractList(Map<String, dynamic> result) {
    return (result['data'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ??
        (result['items'] as List<dynamic>?)
                ?.cast<Map<String, dynamic>>() ??
            [];
  }

  List<Map<String, dynamic>> _mockActive() => [
        {
          'id': 'ord-1',
          'serviceName': 'Oil Change',
          'providerName': 'AutoFix Vaughan',
          'status': 'active',
          'total': 6900,
          'scheduledDate': '2026-06-01',
        },
        {
          'id': 'ord-2',
          'serviceName': 'Deep Cleaning',
          'providerName': 'CleanPro Services',
          'status': 'pending',
          'total': 14900,
          'scheduledDate': '2026-06-03',
        },
      ];

  List<Map<String, dynamic>> _mockCompleted() => [
        {
          'id': 'ord-3',
          'serviceName': 'Haircut',
          'providerName': 'BeautyStudio',
          'status': 'completed',
          'total': 4500,
        },
        {
          'id': 'ord-4',
          'serviceName': 'Electrical Repair',
          'providerName': 'FixIt Co.',
          'status': 'completed',
          'total': 12000,
        },
      ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.bg : AppColorsLight.bg;
    final text = isDark ? AppColors.text : AppColorsLight.text;
    final text3 = isDark ? AppColors.text3 : AppColorsLight.text3;
    final border = isDark ? AppColors.border : AppColorsLight.border;

    return Container(
      color: bg,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: bg,
              border: Border(bottom: BorderSide(color: border)),
            ),
            child: Row(
              children: [
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Icon(Icons.arrow_back, size: 20, color: text3),
                ),
                const SizedBox(width: 12),
                Text('Orders',
                    style: TextStyle(
                        fontFamily: 'Space Grotesk',
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: text)),
              ],
            ),
          ),
          TabBar(
            controller: _tabController,
            indicator: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(8),
            ),
            indicatorSize: TabBarIndicatorSize.tab,
            labelColor: Colors.white,
            unselectedLabelColor: text3,
            labelStyle: const TextStyle(
                fontSize: 12, fontWeight: FontWeight.w600),
            unselectedLabelStyle:
                const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
            dividerColor: Colors.transparent,
            tabs: const [
              Tab(text: 'Active'),
              Tab(text: 'Completed'),
            ],
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _buildOrderList(_activeOrders, 'No active orders'),
                      _buildOrderList(_completedOrders, 'No completed orders'),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderList(List<Map<String, dynamic>> orders, String emptyMsg) {
    if (orders.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.receipt_long, size: 48, color: AppColors.text3),
            const SizedBox(height: 12),
            Text(emptyMsg,
                style: const TextStyle(
                    fontSize: 13, color: AppColors.text3)),
          ],
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(14),
      itemCount: orders.length,
      itemBuilder: (ctx, i) {
        final o = orders[i];
        return _orderCard(o);
      },
    );
  }

  Widget _orderCard(Map<String, dynamic> order) {
    final id = order['id'] as String? ?? '';
    final service = order['serviceName'] as String? ?? 'Service';
    final provider = order['providerName'] as String? ?? '';
    final status = order['status'] as String? ?? 'pending';
    final total = order['total'] ?? order['price'] ?? 0;
    final date = order['scheduledDate'] as String?;

    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/customer/order-detail',
          arguments: id),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: _statusBg(status),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(_statusIcon(status),
                  size: 20, color: _statusColor(status)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(service,
                      style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.text)),
                  if (provider.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(provider,
                        style: const TextStyle(
                            fontSize: 11, color: AppColors.text3)),
                  ],
                  if (date != null) ...[
                    const SizedBox(height: 2),
                    Text(date,
                        style: const TextStyle(
                            fontSize: 10, color: AppColors.text3)),
                  ],
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('\$${(total as num).toStringAsFixed(0)}',
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                        fontFamily: 'Space Grotesk')),
                const SizedBox(height: 4),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _statusBg(status),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(status.toUpperCase(),
                      style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: _statusColor(status))),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'active':
      case 'confirmed':
        return AppColors.primary;
      case 'pending':
      case 'draft':
        return AppColors.warn;
      case 'completed':
      case 'done':
        return AppColors.secondary;
      default:
        return AppColors.text3;
    }
  }

  Color _statusBg(String s) {
    switch (s) {
      case 'active':
      case 'confirmed':
        return AppColors.primary.withValues(alpha: 0.15);
      case 'pending':
      case 'draft':
        return AppColors.warn.withValues(alpha: 0.15);
      case 'completed':
      case 'done':
        return AppColors.secondary.withValues(alpha: 0.15);
      default:
        return AppColors.bg3;
    }
  }

  IconData _statusIcon(String s) {
    switch (s) {
      case 'active':
        return Icons.play_arrow;
      case 'confirmed':
        return Icons.check_circle;
      case 'pending':
        return Icons.hourglass_empty;
      case 'completed':
      case 'done':
        return Icons.task_alt;
      default:
        return Icons.circle;
    }
  }
}