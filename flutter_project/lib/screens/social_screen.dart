import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../theme/app_theme.dart';
import '../widgets/status_bar.dart';
import '../widgets/bottom_nav.dart';
import '../widgets/service_search_delegate.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';

/// Phone 3: Social Explorer screen
class SocialScreen extends StatefulWidget {
  const SocialScreen({super.key});

  @override
  State<SocialScreen> createState() => _SocialScreenState();
}

class _SocialScreenState extends State<SocialScreen> {
  int _tabIndex = 0;
  bool _showBizTab = false;
  final ApiService _api = ApiService();

  /// Current user location — fetched from browser geolocation + reverse geocode.
  String _currentLocation = 'Detecting...';
  String _neighbourhoodLocation = '';
  bool _locationLoading = true;

  @override
  void initState() {
    super.initState();
    _checkRole();
    _fetchCurrentLocation();
  }

  Future<void> _checkRole() async {
    final role = await AuthService().getUserRole();
    if (role != null && role.toLowerCase() == 'provider') {
      setState(() => _showBizTab = true);
    }
  }

  /// Use browser geolocation to get the user's current position,
  /// then reverse-geocode via the backend to get a short location string.
  Future<void> _fetchCurrentLocation() async {
    try {
      // First try to get the user's saved location from profile
      try {
        final saved = await _api.getMyLocation();
        if (saved.isNotEmpty) {
          setState(() {
            _currentLocation = saved;
            _neighbourhoodLocation = saved;
            _locationLoading = false;
          });
          return;
        }
      } catch (_) {
        // ignore — fall through to geolocation
      }

      // Try browser geolocation
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() {
          _currentLocation = 'Location off';
          _neighbourhoodLocation = '';
          _locationLoading = false;
        });
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          setState(() {
            _currentLocation = 'Location denied';
            _neighbourhoodLocation = '';
            _locationLoading = false;
          });
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        setState(() {
          _currentLocation = 'Location denied';
          _neighbourhoodLocation = '';
          _locationLoading = false;
        });
        return;
      }

      // Get current position
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.low,
          timeLimit: Duration(seconds: 10),
        ),
      );

      // Reverse-geocode via backend
      final locationData = await _api.getCurrentLocation(
        position.latitude,
        position.longitude,
      );

      final shortLocation = locationData['shortLocation'] as String? ?? '';
      final neighbourhoodLocation = locationData['neighbourhoodLocation'] as String? ?? '';

      if (shortLocation.isNotEmpty) {
        setState(() {
          _currentLocation = shortLocation;
          _neighbourhoodLocation = neighbourhoodLocation.isNotEmpty
              ? neighbourhoodLocation
              : shortLocation;
          _locationLoading = false;
        });

        // Save to profile for future use
        try {
          await _api.saveMyLocation(shortLocation);
        } catch (_) {
          // non-fatal
        }
      } else {
        setState(() {
          _currentLocation = 'Unknown';
          _neighbourhoodLocation = '';
          _locationLoading = false;
        });
      }
    } catch (e) {
      // Fallback to saved location or default
      setState(() {
        _currentLocation = 'Unknown';
        _neighbourhoodLocation = '';
        _locationLoading = false;
      });
    }
  }

  static const _stories = [
    ('A', 'AutoFix', false, AppColors.accent),
    ('B', 'BeautyX', false, AppColors.accent),
    ('G', 'GreenBuild', false, AppColors.secondary),
    ('F', 'FoodHub', true, AppColors.purple),
    ('T', 'TaxPros', true, AppColors.text3),
  ];

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Column(
          children: [
            const StatusBar(title: '9:41', showNotifDot: true),
            // Tabs
            Container(
              decoration: const BoxDecoration(
                color: AppColors.bg,
                border: Border(bottom: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                children: ['Explorer', 'Business Hub'].asMap().entries.map((e) {
                  final active = e.key == _tabIndex;
                  return Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _tabIndex = e.key),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          border: Border(
                            bottom: BorderSide(
                              color: active ? AppColors.primary : Colors.transparent,
                              width: 2.5,
                            ),
                          ),
                        ),
                        child: Text(
                          e.value,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 14,
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
            // Location bar (pin icon + neighbourhood name)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 0),
              child: Row(
                children: [
                  const Icon(Icons.location_on, size: 16, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Text(
                    _locationLoading ? 'Detecting...' : _neighbourhoodLocation,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    _locationLoading ? '' : _currentLocation,
                    style: const TextStyle(fontSize: 11, color: AppColors.text3),
                  ),
                ],
              ),
            ),
            // Search
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 0),
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () {
                        showSearch(
                          context: context,
                          delegate: ServiceSearchDelegate(),
                        );
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: AppColors.card,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.search, size: 14, color: AppColors.text3),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _locationLoading
                                    ? 'Detecting location...'
                                    : 'Search in $_currentLocation...',
                                style: const TextStyle(fontSize: 13, color: AppColors.text3),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: const Icon(Icons.filter_list, size: 16, color: AppColors.text2),
                  ),
                ],
              ),
            ),
            // Stories
            SizedBox(
              height: 90,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
                children: _stories.map((s) {
                  final isSeen = s.$3;
                  final letterColor = s.$4;
                  return Container(
                    width: 64,
                    margin: const EdgeInsets.only(right: 12),
                    child: Column(
                      children: [
                        Container(
                          width: 58,
                          height: 58,
                          padding: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: isSeen
                                ? null
                                : const LinearGradient(colors: [AppColors.primary, AppColors.accent]),
                            color: isSeen ? AppColors.border2 : null,
                          ),
                          child: Container(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppColors.card,
                              border: Border.all(color: AppColors.bg2, width: 2),
                            ),
                            child: Center(
                              child: Text(s.$1,
                                  style: TextStyle(
                                      fontSize: 20,
                                      fontWeight: FontWeight.w700,
                                      color: letterColor,
                                      fontFamily: 'Space Grotesk')),
                            ),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(s.$2,
                            style: const TextStyle(fontSize: 10, color: AppColors.text2),
                            overflow: TextOverflow.ellipsis),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
            // Posts
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  _buildPost1(),
                  _buildPost2(),
                ],
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
              if (id == 'social') Navigator.pushReplacementNamed(context, '/social');
              if (id == 'activity') Navigator.pushReplacementNamed(context, '/activity');
              if (id == 'biz') Navigator.pushReplacementNamed(context, '/dashboard');
            },
            items: const [
              BottomNavItem(id: 'home', label: 'Home', icon: Icons.home),
              BottomNavItem(id: 'social', label: 'Social', icon: Icons.people, active: true),
              BottomNavItem(id: 'activity', label: 'Activity', icon: Icons.auto_awesome_motion),
              BottomNavItem(id: 'biz', label: 'Business', icon: Icons.business, isBiz: true),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPost1() {
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 14, 14, 0),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Center(
                    child: Text('A',
                        style: TextStyle(
                            fontWeight: FontWeight.w700, color: Colors.white, fontSize: 16, fontFamily: 'Space Grotesk')),
                  ),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('@autofix_vaughan',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text)),
                      Text('Auto Repair · 2 hrs ago',
                          style: TextStyle(fontSize: 11, color: AppColors.text3)),
                    ],
                  ),
                ),
                const Text('···', style: TextStyle(fontSize: 20, color: AppColors.text3)),
              ],
            ),
          ),
          // Image
          Container(
            height: 160,
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [Color(0xFF1A2A4A), Color(0xFF0A1020)]),
            ),
            child: Stack(
              children: [
                const Center(child: Text('🚗', style: TextStyle(fontSize: 40))),
                Positioned(
                  left: 14,
                  bottom: 14,
                  right: 14,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Full Service Package – \$69',
                          style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                              fontFamily: 'Space Grotesk')),
                      const SizedBox(height: 4),
                      const Text('Oil change + Air filter + 21-point inspection',
                          style: TextStyle(fontSize: 12, color: Color(0xB3FFFFFF))),
                    ],
                  ),
                ),
                Positioned(
                  bottom: 14,
                  right: 14,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text('🛒 Order Now',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
                  ),
                ),
              ],
            ),
          ),
          // Body
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Serving Vaughan for 12 years. Certified technicians, insured and guaranteed. Book online or drop by — we\'re at 123 Main St, Vaughan.',
                  style: TextStyle(fontSize: 13, color: AppColors.text, height: 1.6),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.only(top: 10),
                  decoration: const BoxDecoration(
                    border: Border(top: BorderSide(color: AppColors.border)),
                  ),
                  child: Row(
                    children: [
                      _actionItem(Icons.favorite_border, '47'),
                      const SizedBox(width: 16),
                      _actionItem(Icons.chat_bubble_outline, '12'),
                      const SizedBox(width: 16),
                      _actionItem(Icons.share, 'Share'),
                      const Spacer(),
                      GestureDetector(
                        onTap: () => Navigator.pushNamed(context, '/order/new'),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Row(children: [
                            Icon(Icons.shopping_bag, size: 12, color: Colors.white),
                            SizedBox(width: 4),
                            Text('Order Service',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
                          ]),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPost2() {
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.purple,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Center(
                    child: Text('B',
                        style: TextStyle(
                            fontWeight: FontWeight.w700, color: Colors.white, fontSize: 16, fontFamily: 'Space Grotesk')),
                  ),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('@beautystudio_vg',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text)),
                      Text('Beauty & Wellness · 5 hrs ago',
                          style: TextStyle(fontSize: 11, color: AppColors.text3)),
                    ],
                  ),
                ),
                const Text('···', style: TextStyle(fontSize: 20, color: AppColors.text3)),
              ],
            ),
          ),
          // Body
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '✨ Special Keratin Package this week only — 30% OFF for Vaughan residents! Book now and get a complimentary deep conditioning treatment. Limited slots available.',
                  style: TextStyle(fontSize: 13, color: AppColors.text, height: 1.6),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    _tag('💅 Keratin', AppColors.purple),
                    _tag('30% OFF', AppColors.warn),
                    _tag('✅ Insured', AppColors.secondary),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.only(top: 10),
                  decoration: const BoxDecoration(
                    border: Border(top: BorderSide(color: AppColors.border)),
                  ),
                  child: Row(
                    children: [
                      _actionItem(Icons.favorite_border, '93'),
                      const SizedBox(width: 16),
                      _actionItem(Icons.chat_bubble_outline, '28'),
                      const SizedBox(width: 16),
                      _actionItem(Icons.share, '41'),
                      const Spacer(),
                      GestureDetector(
                        onTap: () => Navigator.pushNamed(context, '/order/new'),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Row(children: [
                            Icon(Icons.shopping_bag, size: 12, color: Colors.white),
                            SizedBox(width: 4),
                            Text('Order Service',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
                          ]),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _tag(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(text,
          style: TextStyle(fontSize: 11, color: color)),
    );
  }

  Widget _actionItem(IconData icon, String count) {
    return Row(
      children: [
        Icon(icon, size: 14, color: AppColors.text3),
        const SizedBox(width: 5),
        Text(count, style: const TextStyle(fontSize: 12, color: AppColors.text3)),
      ],
    );
  }
}
