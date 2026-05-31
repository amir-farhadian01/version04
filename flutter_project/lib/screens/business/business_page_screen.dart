import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';

/// Public business profile page showing trust badges, services, and reviews.
class BusinessPageScreen extends StatefulWidget {
  final String businessId;
  const BusinessPageScreen({super.key, required this.businessId});

  @override
  State<BusinessPageScreen> createState() => _BusinessPageScreenState();
}

class _BusinessPageScreenState extends State<BusinessPageScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final ApiService _api = ApiService();
  bool _loading = true;
  Map<String, dynamic>? _profile;
  List<Map<String, dynamic>> _services = [];
  List<Map<String, dynamic>> _reviews = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadProfile();
    _loadServices();
    _loadReviews();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    try {
      final result = await _api.getBusinessProfile(widget.businessId);
      _profile = result['data'] as Map<String, dynamic>? ?? result;
    } catch (_) {
      _profile = _mockProfile();
    }
    setState(() => _loading = false);
  }

  Future<void> _loadServices() async {
    try {
      _services = await _api.getBusinessServices(widget.businessId);
    } catch (_) {
      _services = _mockServices();
    }
    if (mounted) setState(() {});
  }

  Future<void> _loadReviews() async {
    try {
      _reviews = await _api.getBusinessReviews(widget.businessId);
    } catch (_) {
      _reviews = _mockReviews();
    }
    if (mounted) setState(() {});
  }

  Map<String, dynamic> _mockProfile() => {
        'name': 'AutoFix Vaughan',
        'username': '@autofix_vaughan',
        'category': 'Auto Repair & Service',
        'rating': 4.9,
        'reviewCount': 184,
        'yearsActive': 12,
        'location': 'Vaughan, ON',
        'verified': true,
        'insured': true,
        'warranty': true,
        'license': 'ON-7823-AUTO',
      };

  List<Map<String, dynamic>> _mockServices() => [
        {'name': 'Standard Oil Change', 'price': 6900, 'tag': 'Best Seller', 'desc': 'Oil + filter + 21-point check'},
        {'name': 'Full Vehicle Service', 'price': 14900, 'tag': 'Recommended', 'desc': 'Brake, fluid, tire rotation'},
        {'name': 'Winter Prep Package', 'price': 19900, 'tag': 'Seasonal', 'desc': 'Tires, battery, antifreeze'},
      ];

  List<Map<String, dynamic>> _mockReviews() => [
        {'userName': 'Sarah J.', 'rating': 5, 'text': 'Great service, fast and professional!', 'time': '2 weeks ago'},
        {'userName': 'Mike L.', 'rating': 4, 'text': 'Good work, fair pricing.', 'time': '1 month ago'},
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
      child: Column(children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(color: bg, border: Border(bottom: BorderSide(color: border))),
          child: Row(children: [
            GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Icon(Icons.arrow_back, size: 20, color: text3),
            ),
            const SizedBox(width: 12),
            Expanded(child: Text('Business Profile',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: text))),
          ]),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : SingleChildScrollView(
                  child: Column(children: [
                    _buildCoverAndLogo(),
                    const SizedBox(height: 36),
                    _buildBusinessInfo(),
                    // Trust Badges
                    _buildTrustBadges(),
                    // Tabs
                    Container(
                      decoration: BoxDecoration(
                        color: bg,
                        border: Border(bottom: BorderSide(color: border)),
                      ),
                      child: TabBar(
                        controller: _tabController,
                        indicator: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(8)),
                        indicatorSize: TabBarIndicatorSize.tab,
                        labelColor: Colors.white,
                        unselectedLabelColor: text3,
                        labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                        dividerColor: Colors.transparent,
                        tabs: const [
                          Tab(text: 'Services'),
                          Tab(text: 'Reviews'),
                          Tab(text: 'About'),
                        ],
                      ),
                    ),
                    SizedBox(
                      height: 400,
                      child: TabBarView(
                        controller: _tabController,
                        children: [
                          _buildServicesTab(),
                          _buildReviewsTab(),
                          _buildAboutTab(),
                        ],
                      ),
                    ),
                    const SizedBox(height: 80),
                  ]),
                ),
        ),
      ]),
    );
  }

  Widget _buildCoverAndLogo() {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(height: 110, decoration: const BoxDecoration(
          gradient: LinearGradient(colors: [Color(0xFFAC2B1A), Color(0xFF280A00)]),
        )),
        Positioned(
          bottom: -28, left: 18,
          child: Container(
            width: 56, height: 56,
            decoration: BoxDecoration(
              color: AppColors.accent,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.bg2, width: 3),
            ),
            child: const Center(child: Text('A',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700,
                    color: Colors.white, fontFamily: 'Space Grotesk'))),
          ),
        ),
        if (_profile?['verified'] == true)
          Positioned(bottom: -28, left: 82, child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(8)),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.check, size: 12, color: Colors.white),
              SizedBox(width: 4),
              Text('Verified', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white)),
            ]),
          )),
      ],
    );
  }

  Widget _buildBusinessInfo() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(_profile?['name'] as String? ?? '',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700,
                color: AppColors.text, fontFamily: 'Space Grotesk')),
        const SizedBox(height: 4),
        Text('${_profile?['username'] ?? ''} \u00b7 ${_profile?['category'] ?? ''}',
            style: const TextStyle(fontSize: 12, color: AppColors.text3)),
        const SizedBox(height: 8),
        Wrap(spacing: 6, runSpacing: 6, children: [
          _chip('\u2b50 ${_profile?['rating'] ?? '—'} (${_profile?['reviewCount'] ?? 0} reviews)'),
          _chip('\ud83c\udfc6 ${_profile?['yearsActive'] ?? 0} yrs active'),
          _chip('\ud83d\udccd ${_profile?['location'] ?? ''}'),
        ]),
      ]),
    );
  }

  Widget _buildTrustBadges() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 12),
      child: Wrap(spacing: 6, runSpacing: 6, children: [
        if (_profile?['insured'] == true)
          _chip('\ud83d\udee1\ufe0f Insured', color: AppColors.secondary, borderColor: AppColors.secondary.withValues(alpha: 0.3)),
        if (_profile?['warranty'] == true)
          _chip('\u2705 Warranty', color: AppColors.warn, borderColor: AppColors.warn.withValues(alpha: 0.3)),
        if (_profile?['license'] != null)
          _chip('\ud83d\udccb Lic: ${_profile!['license']}'),
      ]),
    );
  }

  Widget _buildServicesTab() {
    if (_services.isEmpty) {
      return const Center(child: Text('No services listed', style: TextStyle(color: AppColors.text3)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(14),
      itemCount: _services.length,
      itemBuilder: (ctx, i) {
        final s = _services[i];
        return _serviceCard(s);
      },
    );
  }

  Widget _serviceCard(Map<String, dynamic> s) {
    final price = (s['price'] as num?) ?? 0;
    final tag = s['tag'] as String?;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Stack(children: [
        if (tag != null)
          Positioned(top: 0, right: 0, child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
            decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)),
            child: Text(tag, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primary)),
          )),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(s['name'] as String? ?? '',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
          if (s['desc'] != null) ...[
            const SizedBox(height: 4),
            Text(s['desc'].toString(), style: const TextStyle(fontSize: 11, color: AppColors.text3)),
          ],
          const SizedBox(height: 8),
          Row(children: [
            Text('\$${(price / 100).toStringAsFixed(0)}',
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700,
                    fontFamily: 'Space Grotesk', color: AppColors.primary)),
            const Spacer(),
            GestureDetector(
              onTap: () => _onBookNow(s),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(8)),
                child: const Text('Book Now', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
              ),
            ),
          ]),
        ]),
      ]),
    );
  }

  /// Handle "Book Now" tap — navigate to NewOrderScreen with pre-filled service data
  void _onBookNow(Map<String, dynamic> service) {
    final args = <String, dynamic>{
      'serviceCatalogId': service['id'] as String? ?? service['serviceCatalogId'] as String? ?? '',
      'packageId': service['packageId'] as String?,
      'providerId': widget.businessId,
      'prefill': <String, dynamic>{
        'name': service['name'],
        'desc': service['desc'],
        'price': service['price'],
      },
    };
    Navigator.pushNamed(context, '/order/new', arguments: args);
  }

  Widget _buildReviewsTab() {
    if (_reviews.isEmpty) {
      return const Center(child: Text('No reviews yet', style: TextStyle(color: AppColors.text3)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(14),
      itemCount: _reviews.length,
      itemBuilder: (ctx, i) {
        final r = _reviews[i];
        return _reviewCard(r);
      },
    );
  }

  Widget _reviewCard(Map<String, dynamic> r) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(color: AppColors.primaryDim, borderRadius: BorderRadius.circular(8)),
            child: Center(child: Text(
              ((r['userName'] as String? ?? 'U')[0]).toUpperCase(),
              style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary, fontSize: 14),
            )),
          ),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(r['userName'] as String? ?? '',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text)),
            _starRow((r['rating'] as num?)?.toInt() ?? 0),
          ])),
          Text(r['time'] as String? ?? '',
              style: const TextStyle(fontSize: 10, color: AppColors.text3)),
        ]),
        if (r['text'] != null) ...[
          const SizedBox(height: 8),
          Text(r['text'].toString(),
              style: const TextStyle(fontSize: 12, color: AppColors.text2, height: 1.5)),
        ],
      ]),
    );
  }

  Widget _buildAboutTab() {
    return Padding(
      padding: const EdgeInsets.all(18),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _aboutRow('Location', _profile?['location']?.toString() ?? '—'),
        _aboutRow('Category', _profile?['category']?.toString() ?? '—'),
        _aboutRow('Years Active', '${_profile?['yearsActive'] ?? 0} years'),
        _aboutRow('Rating', '${_profile?['rating'] ?? '—'} \u2b50 (${_profile?['reviewCount'] ?? 0} reviews)'),
        _aboutRow('License', _profile?['license']?.toString() ?? '—'),
        _aboutRow('Insured', _profile?['insured'] == true ? 'Yes \ud83d\udee1\ufe0f' : 'No'),
        _aboutRow('Warranty', _profile?['warranty'] == true ? 'Yes \u2705' : 'No'),
      ]),
    );
  }

  Widget _aboutRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        SizedBox(width: 100, child: Text(label, style: const TextStyle(fontSize: 12, color: AppColors.text3))),
        Expanded(child: Text(value, style: const TextStyle(fontSize: 13, color: AppColors.text))),
      ]),
    );
  }

  Widget _starRow(int rating) {
    return Row(
      children: List.generate(5, (i) {
        return Icon(
          i < rating ? Icons.star : Icons.star_border,
          size: 12,
          color: i < rating ? AppColors.warn : AppColors.text3,
        );
      }),
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
      child: Text(text, style: TextStyle(fontSize: 11, color: color ?? AppColors.text2)),
    );
  }
}