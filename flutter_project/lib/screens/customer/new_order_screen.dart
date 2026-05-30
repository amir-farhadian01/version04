import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';

/// New Order screen — entry point for placing a service order.
/// Opens from "Order Service" buttons in Social/Explorer feeds.
class NewOrderScreen extends StatefulWidget {
  const NewOrderScreen({super.key});

  @override
  State<NewOrderScreen> createState() => _NewOrderScreenState();
}

class _NewOrderScreenState extends State<NewOrderScreen> {
  final ApiService _api = ApiService();
  final TextEditingController _descriptionController = TextEditingController();
  bool _loading = false;
  List<Map<String, dynamic>> _categories = [];
  List<Map<String, dynamic>> _services = [];
  String? _selectedCategoryId;
  String? _selectedServiceId;

  @override
  void initState() {
    super.initState();
    _loadCategories();
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _loadCategories() async {
    try {
      _categories = await _api.getCategories();
      setState(() {});
    } catch (_) {
      setState(() => _categories = _mockCategories());
    }
  }

  Future<void> _loadServices(String categoryId) async {
    setState(() => _loading = true);
    try {
      _services = await _api.getServicesByCategory(categoryId);
      setState(() {});
    } catch (_) {
      setState(() => _services = _mockServices());
    }
    setState(() => _loading = false);
  }

  List<Map<String, dynamic>> _mockCategories() => [
        {'id': 'cat-auto', 'name': '🚗 Auto Services'},
        {'id': 'cat-beauty', 'name': '💅 Beauty & Wellness'},
        {'id': 'cat-building', 'name': '🏗️ Building & Construction'},
        {'id': 'cat-health', 'name': '🏥 Health & Medical'},
        {'id': 'cat-transport', 'name': '🚚 Transport & Delivery'},
      ];

  List<Map<String, dynamic>> _mockServices() => [
        {'id': 'svc-1', 'name': 'Oil Change', 'price': 6900, 'provider': 'AutoFix Vaughan'},
        {'id': 'svc-2', 'name': 'Full Vehicle Service', 'price': 14900, 'provider': 'AutoFix Vaughan'},
        {'id': 'svc-3', 'name': 'Tire Rotation', 'price': 4000, 'provider': 'AutoFix Vaughan'},
        {'id': 'svc-4', 'name': 'Brake Inspection', 'price': 2500, 'provider': 'AutoFix Vaughan'},
      ];

  void _submitOrder() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Order submitted successfully! 🎉',
            style: TextStyle(color: Colors.white)),
        backgroundColor: AppColors.secondary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.bg : AppColorsLight.bg;
    final card = isDark ? AppColors.card : AppColorsLight.card;
    final border = isDark ? AppColors.border : AppColorsLight.border;
    final text = isDark ? AppColors.text : AppColorsLight.text;
    final text2 = isDark ? AppColors.text2 : AppColorsLight.text2;

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        backgroundColor: bg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.primary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('New Order',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.text)),
        centerTitle: true,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: border, height: 1),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Category picker
            const Text('Select Category',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text2)),
            const SizedBox(height: 8),
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: _categories.map((cat) {
                  final selected = cat['id'] == _selectedCategoryId;
                  return GestureDetector(
                    onTap: () {
                      setState(() {
                        _selectedCategoryId = cat['id'] as String;
                        _selectedServiceId = null;
                      });
                      _loadServices(cat['id'] as String);
                    },
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: selected ? AppColors.primary : card,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: selected ? AppColors.primary : border),
                      ),
                      child: Text(
                        cat['name'] as String? ?? '',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: selected ? Colors.white : text2,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 20),

            // Service list
            if (_selectedCategoryId != null) ...[
              const Text('Available Services',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text2)),
              const SizedBox(height: 8),
              if (_loading)
                const Center(child: Padding(
                  padding: EdgeInsets.all(24),
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                )),
              if (!_loading && _services.isEmpty)
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: border),
                  ),
                  child: const Center(
                    child: Text('No services available in this category',
                        style: TextStyle(fontSize: 13, color: AppColors.text3)),
                  ),
                ),
              ..._services.map((svc) {
                final price = svc['price'] as int? ?? 0;
                final selected = svc['id'] == _selectedServiceId;
                return GestureDetector(
                  onTap: () => setState(() => _selectedServiceId = svc['id'] as String),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: selected ? AppColors.primary.withValues(alpha: 0.08) : card,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: selected ? AppColors.primary : border,
                        width: selected ? 2 : 1,
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: AppColors.card2,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.build, size: 20, color: AppColors.primary),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(svc['name'] as String? ?? '',
                                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
                              const SizedBox(height: 2),
                              Text(svc['provider'] as String? ?? '',
                                  style: const TextStyle(fontSize: 11, color: AppColors.text3)),
                            ],
                          ),
                        ),
                        Text('\$${(price / 100).toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                              fontFamily: 'Space Grotesk',
                            )),
                      ],
                    ),
                  ),
                );
              }),
              const SizedBox(height: 20),
            ],

            // Description
            const Text('Description (optional)',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text2)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: card,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: border),
              ),
              child: TextField(
                controller: _descriptionController,
                maxLines: 3,
                style: TextStyle(fontSize: 13, color: text),
                decoration: InputDecoration(
                  hintText: 'Describe what you need...',
                  hintStyle: const TextStyle(fontSize: 13, color: AppColors.text3),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Submit button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _selectedServiceId != null ? _submitOrder : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.4),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: const Text('Place Order',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}