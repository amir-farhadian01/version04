import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';

/// New Order screen — entry point for placing a service order.
/// Opens from "Book Now" buttons on BusinessPageScreen, Order Service buttons in Social/Explorer feeds.
///
/// Accepts optional arguments via ModalRoute.of(context)?.settings.arguments:
///   { 'serviceCatalogId': String, 'packageId': String?, 'providerId': String?, 'prefill': Map? }
///
/// Flow (per ORDER_FLOW.md Phase 1-2):
///   1. User selects service/category and fills description
///   2. POST /orders/draft → creates draft order
///   3. Navigate to review screen where user can submit via POST /orders/:id/submit-draft
class NewOrderScreen extends StatefulWidget {
  const NewOrderScreen({super.key});

  @override
  State<NewOrderScreen> createState() => _NewOrderScreenState();
}

class _NewOrderScreenState extends State<NewOrderScreen> {
  final ApiService _api = ApiService();
  final TextEditingController _descriptionController = TextEditingController();
  bool _loading = false;
  bool _submitting = false;
  List<Map<String, dynamic>> _categories = [];
  List<Map<String, dynamic>> _services = [];
  String? _selectedCategoryId;
  String? _selectedServiceId;

  // Pre-filled from business page "Book Now" arguments
  String? _prefillServiceCatalogId;
  String? _prefillPackageId;
  String? _prefillProviderId;
  Map<String, dynamic>? _prefillData;

  @override
  void initState() {
    super.initState();
    _parseArguments();
    _loadCategories();
  }

  void _parseArguments() {
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is Map<String, dynamic>) {
      _prefillServiceCatalogId = args['serviceCatalogId'] as String?;
      _prefillPackageId = args['packageId'] as String?;
      _prefillProviderId = args['providerId'] as String?;
      _prefillData = args['prefill'] as Map<String, dynamic>?;
    }
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

  /// Phase 1: Create draft order → then navigate to review/confirmation screen
  Future<void> _submitOrder() async {
    // Validate required fields
    final serviceId = _prefillServiceCatalogId ?? _selectedServiceId;
    if (serviceId == null) {
      _showError('Please select a service first.');
      return;
    }
    final description = _descriptionController.text.trim();
    if (description.length < 20) {
      _showError('Please describe your job in more detail (at least 20 characters).');
      return;
    }
    if (description.length > 2000) {
      _showError('Description is too long (max 2000 characters).');
      return;
    }

    setState(() => _submitting = true);
    try {
      final body = <String, dynamic>{
        'serviceCatalogId': serviceId,
        'entryPoint': _prefillProviderId != null ? 'direct' : 'explorer',
      };

      if (description.isNotEmpty) {
        body['description'] = description;
      }

      // Include prefill data from business page (service name, description, price, packageId)
      final mergedPrefill = <String, dynamic>{
        if (_prefillPackageId != null) 'packageId': _prefillPackageId,
        ...?_prefillData,
      };
      if (mergedPrefill.isNotEmpty) {
        body['prefill'] = mergedPrefill;
      }

      final result = await _api.createDraftOrder(body);
      final orderId = (result['id'] ?? result['orderId'] ?? result['offerId']) as String?;

      if (!mounted) return;
      setState(() => _submitting = false);

      if (orderId != null) {
        _showSuccess('Draft created! Review and submit to find providers.');
        // Navigate to order detail/review screen
        Navigator.pushReplacementNamed(context, '/customer/order-detail', arguments: orderId);
      } else {
        _showError('Order created but no ID returned.');
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      if (e.statusCode == 401) {
        _showError('Please log in to place an order.');
        Navigator.pushReplacementNamed(context, '/auth');
      } else {
        _showError(e.message);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      _showError('Failed to create order. Please try again.');
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(color: Colors.white)),
        backgroundColor: Colors.red.shade700,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(color: Colors.white)),
        backgroundColor: AppColors.secondary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.bg : AppColorsLight.bg;
    final card = isDark ? AppColors.card : AppColorsLight.card;
    final border = isDark ? AppColors.border : AppColorsLight.border;
    final text = isDark ? AppColors.text : AppColorsLight.text;
    final text2 = isDark ? AppColors.text2 : AppColorsLight.text2;

    // If pre-filled from business page, show a simplified direct-booking UI
    final isDirectBooking = _prefillServiceCatalogId != null;

    return SingleChildScrollView(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Pre-filled service info card (when coming from business page)
            if (isDirectBooking && _prefillData != null) ...[
              _buildPrefillCard(card, border),
              const SizedBox(height: 20),
            ],

            // Category picker (hidden for direct bookings)
            if (!isDirectBooking) ...[
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
            ],

            // Description field
            const Text('Describe what you need',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text2)),
            const SizedBox(height: 4),
            Text(
              'Minimum 20 characters — be specific about scope, timing, and location',
              style: TextStyle(fontSize: 11, color: text2.withValues(alpha: 0.7)),
            ),
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
                maxLines: 4,
                style: TextStyle(fontSize: 13, color: text),
                decoration: InputDecoration(
                  hintText: isDirectBooking
                      ? 'Describe the job details, preferred date/time, and location...'
                      : 'Describe what you need...',
                  hintStyle: const TextStyle(fontSize: 13, color: AppColors.text3),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Text(
                  '${_descriptionController.text.length}/2000',
                  style: TextStyle(
                    fontSize: 11,
                    color: _descriptionController.text.length < 20
                        ? Colors.orange.shade400
                        : text2.withValues(alpha: 0.5),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Commission breakdown (visible when price is known)
            if (_selectedServiceId != null) ...[
              const SizedBox(height: 16),
              _buildCommissionBreakdown(),
            ],

            // Submit button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _submitting
                    ? null
                    : (isDirectBooking || _selectedServiceId != null ? _submitOrder : null),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.4),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Place Order',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
            const SizedBox(height: 12),

            // Flow explanation
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.15)),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, size: 16, color: AppColors.primary.withValues(alpha: 0.7)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'After placing your order, you\'ll be able to review details and submit it to find the best providers.',
                      style: TextStyle(
                        fontSize: 11,
                        color: text2.withValues(alpha: 0.8),
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      );
  }

  // ── Commission Breakdown ──
  static const double _commissionRate = 0.125; // 12.5% platform commission

  Widget _buildCommissionBreakdown() {
    // Get price from selected service or prefill
    int? priceInCents;
    if (_prefillData?['price'] != null) {
      priceInCents = (_prefillData!['price'] as num).toInt();
    } else if (_selectedServiceId != null) {
      final svc = _services.cast<Map<String, dynamic>?>().firstWhere(
        (s) => s!['id'] == _selectedServiceId,
        orElse: () => null,
      );
      priceInCents = svc?['price'] as int?;
    }
    if (priceInCents == null) return const SizedBox.shrink();

    final price = priceInCents / 100.0;
    final commission = price * _commissionRate;
    final providerReceives = price - commission;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.receipt_long_outlined, size: 18, color: AppColors.text2),
              SizedBox(width: 8),
              Text(
                'Payment Breakdown',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.text,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _commissionRow('Service price', '\$${price.toStringAsFixed(2)}', AppColors.text, false),
          _commissionRow('Platform fee (${(_commissionRate * 100).toStringAsFixed(1)}%)',
              '-\$${commission.toStringAsFixed(2)}', AppColors.text3, false),
          const Divider(color: AppColors.border, height: 20),
          _commissionRow('You pay', '\$${price.toStringAsFixed(2)}', AppColors.primary, true),
          const SizedBox(height: 4),
          Text(
            'Provider receives \$${providerReceives.toStringAsFixed(2)} after platform fee',
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.text3,
              fontStyle: FontStyle.italic,
            ),
          ),
        ],
      ),
    );
  }

  Widget _commissionRow(String label, String value, Color valueColor, bool bold) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: AppColors.text2),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: bold ? 15 : 13,
              fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
              color: valueColor,
              fontFamily: bold ? 'Space Grotesk' : null,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPrefillCard(Color card, Color border) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.verified, size: 18, color: AppColors.primary),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  _prefillData?['name'] as String? ?? 'Selected Service',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.text,
                  ),
                ),
              ),
            ],
          ),
          if (_prefillData?['desc'] != null) ...[
            const SizedBox(height: 6),
            Text(
              _prefillData!['desc'].toString(),
              style: const TextStyle(fontSize: 12, color: AppColors.text3),
            ),
          ],
          if (_prefillData?['price'] != null) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Text(
                  '\$${((_prefillData!['price'] as num) / 100).toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                    fontFamily: 'Space Grotesk',
                  ),
                ),
                const SizedBox(width: 4),
                const Text('CAD', style: TextStyle(fontSize: 11, color: AppColors.text3)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}