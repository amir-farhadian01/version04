import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../theme/app_theme.dart';
import '../widgets/status_bar.dart';
import '../widgets/bottom_nav.dart';
import '../widgets/service_search_delegate.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';

/// Phone 2: Home Screen
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _notifOpen = false;
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
            _locationLoading = false;
          });
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        setState(() {
          _currentLocation = 'Location denied';
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
      setState(() {
        _currentLocation = 'Unknown';
        _locationLoading = false;
      });
    }
  }

  static const _categories = [
    ('🏗️', 'Building'),
    ('🚗', 'Auto'),
    ('💅', 'Beauty'),
    ('🚚', 'Transport'),
    ('🏥', 'Health'),
  ];

  static const _services = [
    '🏦 TD Bank',
    '🏦 RBC',
    '📊 Credit Score',
    '🛡️ Insurance',
    '🏛️ ServiceOntario',
    '🏥 OHIP',
  ];

  static const _news = [
    ('Construction rates up 12% this week in Vaughan', AppColors.primary, '2h'),
    ('Police alert: Traffic delay on Major Mackenzie Dr', AppColors.warn, '45m'),
    ('Music Festival announced at Vaughan Mills — May 14', AppColors.secondary, '5h'),
    ('Auto Expo: New dealerships joining Vaughan corridor', AppColors.purple, '1d'),
  ];

  static const _events = [
    ('Craft Festival', 'May 10 · Vaughan Mills', [Color(0x550FC98A), Color(0xFF001105)]),
    ('Concert Night', 'May 14 · Club district', [Color(0x55FF7A2B), Color(0xFF210A00)]),
    ('Auto Expo', 'May 18 · Convention Ctr', [Color(0x552B6EFF), Color(0xFF000A21)]),
  ];

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Column(
          children: [
            StatusBar(
              title: '9:41',
              onNotifTap: () => setState(() => _notifOpen = !_notifOpen),
              showNotifDot: true,
            ),
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    _buildHeader(),
                    _buildWeekCard(),
                    _buildSearchSection(),
                    _buildServicesSection(),
                    _buildNewsSection(),
                    _buildEventsSection(),
                    _buildScoreCard(),
                    const SizedBox(height: 80), // space for floating nav
                  ],
                ),
              ),
            ),
          ],
        ),
        if (_notifOpen) _buildNotifPanel(),
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
              BottomNavItem(id: 'home', label: 'Home', icon: Icons.home, active: true),
              BottomNavItem(id: 'social', label: 'Social', icon: Icons.people),
              BottomNavItem(id: 'activity', label: 'Activity', icon: Icons.auto_awesome_motion),
              BottomNavItem(id: 'biz', label: 'Business', icon: Icons.business, isBiz: true),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 14),
      decoration: const BoxDecoration(
        color: AppColors.bg,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.location_on, size: 12, color: AppColors.primary),
                  const SizedBox(width: 5),
                  Text(
                    _locationLoading
                        ? 'Detecting...'
                        : (_neighbourhoodLocation.isNotEmpty ? _neighbourhoodLocation : _currentLocation),
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.primary),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              const Text('Good morning, Amir 👋',
                  style: TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w700,
                      color: AppColors.text,
                      fontFamily: 'Space Grotesk')),
            ],
          ),
          GestureDetector(
            onTap: () => Navigator.pushNamed(context, '/profile'),
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: AppColors.primaryDim,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.primary, width: 2),
              ),
              child: const Center(
                child: Text('A',
                    style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary, fontSize: 15)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWeekCard() {
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 14, 14, 0),
      height: 140,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: const LinearGradient(colors: [Color(0xFF1A3580), Color(0xFF0A1228)]),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.camera_alt, size: 11, color: Color(0xFFC8D8FF)),
                  SizedBox(width: 5),
                  Text('Photo of the Week',
                      style: TextStyle(fontSize: 11, color: Color(0xFFC8D8FF))),
                ],
              ),
            ),
            const SizedBox(height: 8),
            const Text('Central Park Vaughan',
                style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    fontFamily: 'Space Grotesk')),
            const SizedBox(height: 10),
            Row(
              children: [
                _buildPill(Icons.access_time, '13°C · Sunny', Colors.white.withValues(alpha: 0.1)),
                const SizedBox(width: 8),
                _buildPill(Icons.warning_amber, 'Police Alert', const Color(0x26FFB800)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPill(IconData icon, String text, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: const Color(0xFFD0E0FF)),
          const SizedBox(width: 4),
          Text(text, style: const TextStyle(fontSize: 11, color: Color(0xFFD0E0FF))),
        ],
      ),
    );
  }

  Widget _buildSearchSection() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
          GestureDetector(
            onTap: () {
              showSearch(
                context: context,
                delegate: ServiceSearchDelegate(),
              );
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.bg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Row(
                children: [
                  Icon(Icons.search, size: 16, color: AppColors.text3),
                  SizedBox(width: 10),
                  Text('Search services in your area...',
                      style: TextStyle(fontSize: 14, color: AppColors.text3)),
                ],
              ),
            ),
          ),
            const SizedBox(height: 14),
            Row(
              children: _categories.map((cat) {
                return Expanded(
                  child: Column(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.card2,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Center(child: Text(cat.$1, style: const TextStyle(fontSize: 20))),
                      ),
                      const SizedBox(height: 6),
                      Text(cat.$2, style: const TextStyle(fontSize: 10, color: AppColors.text2)),
                    ],
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildServicesSection() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.home, size: 14, color: AppColors.text2),
              const SizedBox(width: 6),
              const Text('Public & Government Services',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text2)),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 36,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: _services.map((s) {
                return Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    border: Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(s, style: const TextStyle(fontSize: 12, color: AppColors.text2)),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNewsSection() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.article, size: 14, color: AppColors.text2),
              const SizedBox(width: 6),
              const Text('Local News',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text2)),
            ],
          ),
          const SizedBox(height: 10),
          ..._news.map((item) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: item.$2,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(item.$1,
                          style: const TextStyle(fontSize: 12, color: AppColors.text, height: 1.5)),
                    ),
                    const SizedBox(width: 8),
                    Text(item.$3,
                        style: const TextStyle(fontSize: 10, color: AppColors.text3)),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildEventsSection() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.calendar_today, size: 14, color: AppColors.text2),
              const SizedBox(width: 6),
              const Text('Local Events',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text2)),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 100,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: _events.map((event) {
                return Container(
                  width: 150,
                  margin: const EdgeInsets.only(right: 10),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    gradient: LinearGradient(
                      colors: [event.$3[0], event.$3[1]],
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text(event.$1,
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                                fontFamily: 'Space Grotesk')),
                        const SizedBox(height: 4),
                        Text(event.$2,
                            style: const TextStyle(fontSize: 11, color: Color(0xB3FFFFFF))),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScoreCard() {
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Your Interaction Score',
                      style: TextStyle(fontSize: 11, color: AppColors.text2)),
                  const SizedBox(height: 4),
                  const Text('2,840 pts',
                      style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w700,
                          color: AppColors.secondary,
                          fontFamily: 'Space Grotesk')),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.primaryDim,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Column(
                  children: [
                    Text('3.2 km',
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                            fontFamily: 'Space Grotesk')),
                    Text('Your Reach',
                        style: TextStyle(fontSize: 10, color: AppColors.text2)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: Container(
              height: 6,
              color: AppColors.bg,
              child: FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: 0.56,
                child: Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [AppColors.secondary, AppColors.primary],
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          const Text('Keep engaging to expand your neighborhood radius!',
              style: TextStyle(fontSize: 11, color: AppColors.text2)),
        ],
      ),
    );
  }

  Widget _buildNotifPanel() {
    return Positioned(
      top: 48,
      left: 0,
      right: 0,
      child: Container(
        constraints: const BoxConstraints(maxHeight: 360),
        decoration: const BoxDecoration(
          color: AppColors.bg2,
          border: Border(bottom: BorderSide(color: AppColors.border2)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: AppColors.border)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Notifications',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text)),
                  Text('Mark all read',
                      style: TextStyle(fontSize: 11, color: AppColors.primary)),
                ],
              ),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  _notifItem('New offer from AutoFix Vaughan', 'Oil change package – \$69 · 5 min ago', true),
                  _notifItem('Police alert: Road closure on Major Mackenzie', 'Vaughan, ON · 22 min ago', true),
                  _notifItem('Craft Festival starts tomorrow!', 'Vaughan Mills · May 10 · 10:00 AM', false),
                  _notifItem('BeautyStudio reviewed your order', '5 stars · 2 days ago', false),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _notifItem(String title, String subtitle, bool unread) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: unread ? const Color(0x0A2B6EFF) : Colors.transparent,
        border: const Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(child: Text(unread ? '🔔' : '📅', style: const TextStyle(fontSize: 16))),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(fontSize: 12, color: AppColors.text, fontWeight: FontWeight.w500, height: 1.5)),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(fontSize: 11, color: AppColors.text3)),
              ],
            ),
          ),
          if (unread)
            Container(
              width: 7,
              height: 7,
              margin: const EdgeInsets.only(top: 5),
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
            ),
        ],
      ),
    );
  }
}
