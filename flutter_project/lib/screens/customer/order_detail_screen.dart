import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';

/// Order detail screen with Details, Contract, and Chat tabs.
class CustomerOrderDetailScreen extends StatefulWidget {
  final String orderId;
  const CustomerOrderDetailScreen({super.key, required this.orderId});

  @override
  State<CustomerOrderDetailScreen> createState() =>
      _CustomerOrderDetailScreenState();
}

class _CustomerOrderDetailScreenState
    extends State<CustomerOrderDetailScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final ApiService _api = ApiService();
  bool _loading = true;
  Map<String, dynamic>? _order;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadOrder();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadOrder() async {
    setState(() => _loading = true);
    try {
      final result = await _api.getOrderDetail(widget.orderId);
      setState(() {
        _order = result['data'] as Map<String, dynamic>? ?? result;
      });
    } catch (_) {
      setState(() {
        _order = _mockOrder();
      });
    }
    setState(() => _loading = false);
  }

  Map<String, dynamic> _mockOrder() => {
        'id': widget.orderId,
        'serviceName': 'Oil Change',
        'providerName': 'AutoFix Vaughan',
        'status': 'active',
        'total': 6900,
        'description': 'Full synthetic oil change with filter replacement and 21-point inspection.',
        'scheduledDate': '2026-06-01',
        'providerPhone': '+1-647-555-0147',
        'providerEmail': 'contact@autofix.ca',
      };

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
                Expanded(
                  child: Text(
                    _order?['serviceName'] as String? ?? 'Order Detail',
                    style: TextStyle(
                        fontFamily: 'Space Grotesk',
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: text),
                  ),
                ),
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
              Tab(text: 'Details'),
              Tab(text: 'Contract'),
              Tab(text: 'Chat'),
            ],
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _buildDetailsTab(),
                      _buildContractTab(),
                      _buildChatTab(),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailsTab() {
    if (_order == null) return const SizedBox();
    final o = _order!;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Status badge
          _statusBadge(o['status'] as String? ?? 'pending'),
          const SizedBox(height: 16),
          // Service info
          _infoRow('Service', o['serviceName']?.toString() ?? '—'),
          _infoRow('Provider', o['providerName']?.toString() ?? '—'),
          _infoRow('Status', (o['status'] as String? ?? '').toUpperCase()),
          _infoRow('Total',
              '\$${((o['total'] ?? 0) as num).toStringAsFixed(0)}'),
          if (o['scheduledDate'] != null) ...[
            _infoRow('Scheduled', o['scheduledDate'].toString()),
          ],
          const SizedBox(height: 12),
          const Text('Description',
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.text2)),
          const SizedBox(height: 6),
          Text(o['description']?.toString() ?? 'No description',
              style: const TextStyle(
                  fontSize: 13, color: AppColors.text, height: 1.6)),
          const SizedBox(height: 16),
          // Contact
          const Text('Contact Provider',
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.text2)),
          const SizedBox(height: 8),
          if (o['providerPhone'] != null)
            _contactTile(
                Icons.phone, o['providerPhone'].toString(), 'Call'),
          if (o['providerEmail'] != null)
            _contactTile(
                Icons.email, o['providerEmail'].toString(), 'Email'),
        ],
      ),
    );
  }

  Widget _buildContractTab() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.description, size: 48, color: AppColors.text3),
          const SizedBox(height: 12),
          const Text('Contract Details',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.text,
                  fontFamily: 'Space Grotesk')),
          const SizedBox(height: 6),
          const Text('Contract will be available once the order is confirmed.',
              style: TextStyle(fontSize: 12, color: AppColors.text3),
              textAlign: TextAlign.center),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pushNamed(context, '/customer/contract-chat',
                  arguments: widget.orderId);
            },
            icon: const Icon(Icons.chat, size: 16),
            label: const Text('Open Contract Chat'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChatTab() {
    return Column(
      children: [
        Expanded(
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.chat_bubble_outline,
                    size: 48, color: AppColors.text3),
                const SizedBox(height: 12),
                const Text('Messages',
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppColors.text)),
                const SizedBox(height: 4),
                const Text(
                    'Chat securely with your provider.\nPersonal info is blocked.',
                    style: TextStyle(
                        fontSize: 12, color: AppColors.text3),
                    textAlign: TextAlign.center),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pushNamed(
                        context, '/customer/contract-chat',
                        arguments: widget.orderId);
                  },
                  icon: const Icon(Icons.chat, size: 16),
                  label: const Text('Open Chat'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _statusBadge(String status) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: status == 'completed' || status == 'done'
            ? AppColors.secondary.withValues(alpha: 0.15)
            : AppColors.primary.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(status.toUpperCase(),
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: status == 'completed' || status == 'done'
                ? AppColors.secondary
                : AppColors.primary,
          )),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(
            width: 80,
            child: Text(label,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.text3)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: AppColors.text)),
          ),
        ],
      ),
    );
  }

  Widget _contactTile(IconData icon, String value, String action) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Text(value,
                style: const TextStyle(
                    fontSize: 13, color: AppColors.text)),
          ),
          Text(action,
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary)),
        ],
      ),
    );
  }
}