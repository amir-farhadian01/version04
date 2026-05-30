import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';
import '../../widgets/service_search_delegate.dart';

/// Home screen (TAB 1) with Home and My Posts sub-tabs.
/// Displays neighbourhood banner, utility icons, search, news feed.
class FlutterHomeScreen extends StatefulWidget {
  const FlutterHomeScreen({super.key});

  @override
  State<FlutterHomeScreen> createState() => _FlutterHomeScreenState();
}

class _FlutterHomeScreenState extends State<FlutterHomeScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final ApiService _api = ApiService();
  bool _loading = true;
  Map<String, dynamic>? _banner;
  List<Map<String, dynamic>> _news = [];
  List<Map<String, dynamic>> _utilities = [];
  final String _currentLocation = 'Vaughan, ON';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadHomeData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadHomeData() async {
    setState(() => _loading = true);
    try {
      final bannerResult = await _api.getHomeBanner();
      _banner = bannerResult['data'] as Map<String, dynamic>? ?? bannerResult;
    } catch (_) {
      _banner = {'title': 'Central Park Vaughan', 'temp': '13°C', 'condition': 'Sunny', 'alert': 'Police Alert'};
    }
    try {
      _news = await _api.getHomeNews();
    } catch (_) {
      _news = _mockNews();
    }
    try {
      _utilities = await _api.getUtilityLinks('general');
    } catch (_) {
      _utilities = _mockUtilities();
    }
    setState(() => _loading = false);
  }

  List<Map<String, dynamic>> _mockNews() => [
        {'title': 'Construction rates up 12%', 'time': '2h', 'color': 'primary'},
        {'title': 'Traffic delay on Major Mackenzie Dr', 'time': '45m', 'color': 'warn'},
        {'title': 'Music Festival at Vaughan Mills', 'time': '5h', 'color': 'secondary'},
      ];

  List<Map<String, dynamic>> _mockUtilities() => [
        {'label': '🏦 TD Bank', 'id': 'bank-td'},
        {'label': '🏦 RBC', 'id': 'bank-rbc'},
        {'label': '📊 Credit', 'id': 'credit'},
        {'label': '🛡️ Insurance', 'id': 'insurance'},
        {'label': '🏛️ ServiceON', 'id': 'serviceon'},
      ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.bg : AppColorsLight.bg;
    final text = isDark ? AppColors.text : AppColorsLight.text;
    final text2 = isDark ? AppColors.text2 : AppColorsLight.text2;
    final border = isDark ? AppColors.border : AppColorsLight.border;

    return Container(
      color: bg,
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 14),
            decoration: BoxDecoration(color: bg, border: Border(bottom: BorderSide(color: border))),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    const Icon(Icons.location_on, size: 12, color: AppColors.primary),
                    const SizedBox(width: 5),
                    Text(_currentLocation,
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.primary)),
                  ]),
                  const SizedBox(height: 2),
                  Text('Good morning 👋',
                      style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: text,
                          fontFamily: 'Space Grotesk')),
                ]),
                GestureDetector(
                  onTap: () => Navigator.pushNamed(context, '/profile'),
                  child: Container(
                    width: 38, height: 38,
                    decoration: BoxDecoration(
                      color: AppColors.primaryDim,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.primary, width: 2),
                    ),
                    child: const Center(child: Text('A',
                        style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary, fontSize: 15))),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : SingleChildScrollView(
                    child: Column(children: [
                      // Neighbourhood Banner
                      _buildBanner(),
                      // Search box
                      _buildSearchBox(),
                      // Utility Icons
                      _buildUtilityIcons(),
                      // News
                      _buildSection('Local News', _news.map((n) => _newsTile(n)).toList(), text2),
                      // Events
                      _buildSection('Local Events', _buildEventCards(), text2),
                      const SizedBox(height: 80),
                    ]),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildBanner() {
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 14, 14, 0),
      height: 140,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: const LinearGradient(colors: [Color(0xFF1A3580), Color(0xFF0A1228)]),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.camera_alt, size: 11, color: Color(0xFFC8D8FF)),
              SizedBox(width: 5),
              Text('Photo of the Week', style: TextStyle(fontSize: 11, color: Color(0xFFC8D8FF))),
            ]),
          ),
          const SizedBox(height: 8),
          Text(_banner?['title'] as String? ?? 'Neighbourhood',
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white,
                  fontFamily: 'Space Grotesk')),
          const SizedBox(height: 10),
          Row(children: [
            _bannerPill(Icons.access_time, '${_banner?['temp'] ?? '??'} · ${_banner?['condition'] ?? ''}',
                Colors.white.withValues(alpha: 0.1)),
            const SizedBox(width: 8),
            if (_banner?['alert'] != null)
              _bannerPill(Icons.warning_amber, _banner!['alert'].toString(), const Color(0x26FFB800)),
          ]),
        ]),
      ),
    );
  }

  Widget _bannerPill(IconData icon, String text, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(20)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 11, color: const Color(0xFFD0E0FF)),
        const SizedBox(width: 4),
        Text(text, style: const TextStyle(fontSize: 11, color: Color(0xFFD0E0FF))),
      ]),
    );
  }

  Widget _buildSearchBox() {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Use a maximum width to keep the search bar from looking too wide
        final maxWidth = constraints.maxWidth > 480 ? 480.0 : constraints.maxWidth;
        return Padding(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
          child: Center(
            child: SizedBox(
              width: maxWidth,
              child: GestureDetector(
                onTap: () {
                  showSearch(
                    context: context,
                    delegate: ServiceSearchDelegate(),
                  );
                },
                child: Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: constraints.maxWidth < 360 ? 10 : 14,
                    vertical: constraints.maxWidth < 360 ? 8 : 10,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(children: [
                    const Icon(Icons.search, size: 16, color: AppColors.text3),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Search services in your area...',
                        style: TextStyle(
                          fontSize: constraints.maxWidth < 360 ? 13 : 14,
                          color: AppColors.text3,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildUtilityIcons() {
    if (_utilities.isEmpty) return const SizedBox(height: 14);
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 14, 14, 0),
      child: SizedBox(
        height: 72,
        child: ListView(
          scrollDirection: Axis.horizontal,
          children: _utilities.map((u) {
            return GestureDetector(
              onTap: () => _api.trackUtilityClick(u['id'] as String? ?? ''),
              child: Container(
                width: 64,
                margin: const EdgeInsets.only(right: 10),
                child: Column(children: [
                  Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.card2,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Center(child: Text(u['label'] as String? ?? '', style: const TextStyle(fontSize: 18))),
                  ),
                  const SizedBox(height: 6),
                  Text(u['label'] as String? ?? '',
                      style: const TextStyle(fontSize: 10, color: AppColors.text2), overflow: TextOverflow.ellipsis),
                ]),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildSection(String title, List<Widget> children, Color text2) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.article, size: 14, color: AppColors.text2),
          const SizedBox(width: 6),
          Text(title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: text2)),
        ]),
        const SizedBox(height: 10),
        ...children,
      ]),
    );
  }

  Widget _newsTile(Map<String, dynamic> item) {
    final c = item['color'] as String? ?? 'primary';
    final colorVal = c == 'warn' ? AppColors.warn : c == 'secondary' ? AppColors.secondary : AppColors.primary;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: colorVal, shape: BoxShape.circle)),
        const SizedBox(width: 12),
        Expanded(child: Text(item['title'] as String? ?? '',
            style: const TextStyle(fontSize: 12, color: AppColors.text, height: 1.5))),
        const SizedBox(width: 8),
        Text(item['time'] as String? ?? '',
            style: const TextStyle(fontSize: 10, color: AppColors.text3)),
      ]),
    );
  }

  List<Widget> _buildEventCards() {
    final events = [
      ('Craft Festival', 'May 10 · Vaughan Mills', [const Color(0x550FC98A), const Color(0xFF001105)]),
      ('Concert Night', 'May 14 · Club District', [const Color(0x55FF7A2B), const Color(0xFF210A00)]),
    ];
    return [
      SizedBox(
        height: 100,
        child: ListView(
          scrollDirection: Axis.horizontal,
          children: events.map((e) {
            return Container(
              width: 150,
              margin: const EdgeInsets.only(right: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                gradient: LinearGradient(colors: [e.$3[0], e.$3[1]]),
              ),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.end, children: [
                  Text(e.$1, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
                      color: Colors.white, fontFamily: 'Space Grotesk')),
                  const SizedBox(height: 4),
                  Text(e.$2, style: const TextStyle(fontSize: 11, color: Color(0xB3FFFFFF))),
                ]),
              ),
            );
          }).toList(),
        ),
      ),
    ];
  }
}