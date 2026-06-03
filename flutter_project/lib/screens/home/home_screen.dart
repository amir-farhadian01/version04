import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';
import '../../widgets/service_search_delegate.dart';

/// Home screen (TAB 1) with Home and My Posts sub-tabs.
/// Matches the React frontend's HomePage.tsx design exactly:
///   - Greeting header "Good morning, X 👋"
///   - HOME | MY POSTS sub-tab bar
///   - Neighbourhood Banner (weather + alerts, collapsible)
///   - Utility Icons Row (horizontal scroll, expandable per category)
///   - Search Box
///   - Local News & Events (category tabbed, from /api/home/news)
///   - My Posts tab (Posts / Stories / Saved inner tabs, list/grid toggle)
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

  // Data from API
  Map<String, dynamic>? _homeBanner;
  List<Map<String, dynamic>> _news = [];
  List<Map<String, dynamic>> _utilities = [];
  Map<String, dynamic>? _weather;
  List<Map<String, dynamic>> _alerts = [];

  // Utility expand state
  String? _activeUtilityCategory;
  List<Map<String, dynamic>> _filteredUtilityLinks = [];

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
    final results = await Future.wait([
      _api.getHomeBanner().then((r) => r).catchError((_) => <String, dynamic>{}),
      _api.getHomeNews().then((r) => r).catchError((_) => <Map<String, dynamic>>[]),
      _api.getUtilityLinks('general').then((r) => r).catchError((_) => <Map<String, dynamic>>[]),
      _api.getWeather().then((r) => r).catchError((_) => <String, dynamic>{}),
      _api.getActiveAlerts().then((r) => r).catchError((_) => <Map<String, dynamic>>[]),
    ]);

    // getHomeBanner returns { data: {...} }
    final bannerResult = results[0] as Map<String, dynamic>;
    _homeBanner = (bannerResult['data'] as Map<String, dynamic>?) ?? bannerResult;

    // getHomeNews returns list of maps from the array response
    _news = (results[1] as List<dynamic>).cast<Map<String, dynamic>>();

    // getUtilityLinks returns array from { data: [...] }
    _utilities = (results[2] as List<dynamic>).cast<Map<String, dynamic>>();

    // getWeather returns { data: {...} }
    final weatherResult = results[3] as Map<String, dynamic>;
    _weather = (weatherResult['data'] as Map<String, dynamic>?) ?? weatherResult;

    // getActiveAlerts returns { data: [...] }
    _alerts = (results[4] as List<dynamic>?)?.cast<Map<String, dynamic>>() ??
        <Map<String, dynamic>>[];

    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadFilteredUtilityLinks(String category) async {
    try {
      final links = await _api.getUtilityLinks(category);
      if (mounted) setState(() => _filteredUtilityLinks = links);
    } catch (_) {
      if (mounted) setState(() => _filteredUtilityLinks = []);
    }
  }

  // ── Weather emoji map matching React NeighbourhoodBanner ──
  static const _weatherIconMap = <String, String>{
    'sunny': '☀️',
    'clear': '☀️',
    'partly_cloudy': '⛅',
    'cloudy': '☁️',
    'overcast': '☁️',
    'rain': '🌧️',
    'light_rain': '🌦️',
    'heavy_rain': '🌧️',
    'thunderstorm': '⛈️',
    'snow': '🌨️',
    'fog': '🌫️',
    'wind': '💨',
  };

  String _getWeatherEmoji(String condition) {
    final lower = condition.toLowerCase().replaceAll(RegExp(r'\s+'), '_');
    for (final entry in _weatherIconMap.entries) {
      if (lower.contains(entry.key)) return entry.value;
    }
    return '🌤️';
  }

  // ── Utility category definitions (matching React) ──
  static const _utilityCategories = <_UtilityCat>[
    _UtilityCat('banks', 'Banks', '🏦'),
    _UtilityCat('insurance', 'Insurance', '🛡️'),
    _UtilityCat('fuel', 'Fuel', '⛽'),
    _UtilityCat('government', 'Government', '🏛️'),
    _UtilityCat('health', 'Health', '🏥'),
    _UtilityCat('transit', 'Transit', '🚌'),
  ];

  // ── News category tabs (matching React NewsFeed) ──
  static const _newsCategories = <_NewsCat>[
    _NewsCat('all', 'All', null, null),
    _NewsCat('sports', 'Sports', '⚽', Color(0x26256beb)),
    _NewsCat('community', 'Community', '🤝', Color(0x260fc98a)),
    _NewsCat('events', 'Events', '🎉', Color(0x268b5cf6)),
    _NewsCat('city', 'City', '🏙️', Color(0x26ffb800)),
    _NewsCat('promotions', 'Promotions', '💸', Color(0x26ff4d4d)),
  ];
  String _activeNewsCategory = 'all';

  String _formatTimeAgo(String? dateStr) {
    if (dateStr == null) return '';
    final date = DateTime.tryParse(dateStr);
    if (date == null) return '';
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return '${date.day}/${date.month > 9 ? '${date.month}' : '0${date.month}'}/${date.year}';
  }

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
          // ── Greeting header (matching React) ──
          Container(
            decoration: BoxDecoration(
              color: bg.withValues(alpha: 0.9),
              border: Border(bottom: BorderSide(color: border)),
            ),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Good morning, Neighbour 👋',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: text,
                            fontFamily: 'Space Grotesk',
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Your neighbourhood, your community',
                          style: TextStyle(
                            fontSize: 11,
                            color: text2,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                // Sub-tabs: HOME | MY POSTS
                Padding(
                  padding: const EdgeInsets.only(left: 16),
                  child: TabBar(
                    controller: _tabController,
                    isScrollable: true,
                    tabAlignment: TabAlignment.start,
                    indicatorSize: TabBarIndicatorSize.label,
                    indicatorColor: AppColors.primary,
                    labelColor: AppColors.primary,
                    unselectedLabelColor: text2,
                    labelStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      fontFamily: 'Space Grotesk',
                    ),
                    unselectedLabelStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                    labelPadding: const EdgeInsets.only(right: 24),
                    dividerHeight: 0,
                    tabs: const [
                      Tab(text: 'HOME'),
                      Tab(text: 'MY POSTS'),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // ── Tab content ──
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _buildHomeTab(text, text2, isDark),
                      const MyPostsTab(),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildHomeTab(Color text, Color text2, bool isDark) {
    final border = isDark ? AppColors.border : AppColorsLight.border;
    final filteredNews = _activeNewsCategory == 'all'
        ? _news
        : _news.where((n) => n['category'] == _activeNewsCategory).toList();

    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
        child: Column(
          children: [
            // ── 1. Neighbourhood Banner ──
            _buildBanner(text2),
            const SizedBox(height: 16),

            // ── 2. Utility Icons Row ──
            _buildUtilityIcons(text, text2, border, isDark),
            const SizedBox(height: 16),

            // ── 3. Search Box ──
            _buildSearchBox(),
            const SizedBox(height: 16),

            // ── 4. Local News & Events ──
            Row(
              children: [
                Text(
                  'Local News & Events',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: text,
                    fontFamily: 'Space Grotesk',
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '· swipe to explore',
                  style: TextStyle(
                    fontSize: 10,
                    color: text2,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Category tabs
            _buildNewsTabs(text2, isDark),
            const SizedBox(height: 12),

            // News articles
            _buildNewsList(filteredNews, text, text2, isDark),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NEIGHBOURHOOD BANNER (matching React NeighbourhoodBanner.tsx)
  // ═══════════════════════════════════════════════════════════════════════════
  final _bannerExpandedNotifier = ValueNotifier<bool>(false);

  Widget _buildBanner(Color text2) {
    final w = _weather;
    final temp = w?['temp'];
    final condition = w?['condition'] as String? ?? 'Unavailable';
    final emoji = _getWeatherEmoji(condition);
    final activeAlerts = _alerts.where((a) => (a['isActive'] as bool?) == true).toList();
    final criticalAlerts = activeAlerts.where((a) => a['severity'] == 'critical').toList();
    final warningAlerts = activeAlerts.where((a) => a['severity'] != 'critical').toList();

    return ValueListenableBuilder<bool>(
      valueListenable: _bannerExpandedNotifier,
      builder: (_, expanded, __) {
        return GestureDetector(
          onTap: () {
            _bannerExpandedNotifier.value = !_bannerExpandedNotifier.value;
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            height: expanded ? null : 180,
            constraints: BoxConstraints(minHeight: expanded ? 0 : 180),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: const LinearGradient(
                colors: [Color(0xFF1A3580), Color(0xFF0A1228)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Column(
              children: [
                // Collapsed content
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      // Top row: neighbourhood label + alert badges
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Your Neighbourhood',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                    color: Color(0xB3FFFFFF),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      temp != null ? '$temp°' : '--°',
                                      style: const TextStyle(
                                        fontSize: 30,
                                        fontWeight: FontWeight.w900,
                                        color: Colors.white,
                                        fontFamily: 'Space Grotesk',
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      emoji,
                                      style: const TextStyle(fontSize: 22),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  condition,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Color(0x99FFFFFF),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          // Alert badges
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: criticalAlerts.take(2).map((a) {
                              return Container(
                                margin: const EdgeInsets.only(bottom: 6),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.red.withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                      color: Colors.red.withValues(alpha: 0.3)),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Text('!',
                                        style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w700,
                                            color: Colors.red)),
                                    const SizedBox(width: 4),
                                    ConstrainedBox(
                                      constraints:
                                          const BoxConstraints(maxWidth: 100),
                                      child: Text(
                                        a['title'] as String? ?? '',
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.red,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }).toList(),
                          ),
                        ],
                      ),
                      // Warning alert chips
                      if (warningAlerts.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        SizedBox(
                          height: 22,
                          child: ListView(
                            scrollDirection: Axis.horizontal,
                            children: warningAlerts.take(4).map((a) {
                              return Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 2),
                                margin: const EdgeInsets.only(right: 6),
                                decoration: BoxDecoration(
                                  color: Colors.amber.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                      color: Colors.amber.withValues(alpha: 0.3)),
                                ),
                                child: Text(
                                  (a['location'] ?? a['title'] ?? '') as String,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w500,
                                    color: Colors.amber,
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ],
                      // Weather forecast mini-strip
                      const SizedBox(height: 8),
                      _forecastStrip(temp),
                      // Tap hint
                      const SizedBox(height: 4),
                      const Center(
                        child: Text(
                          'tap for details',
                          style: TextStyle(
                            fontSize: 10,
                            color: Color(0x66FFFFFF),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                // Expanded detail view
                if (expanded) ...[
                  Container(
                    height: 1,
                    color: const Color(0x1AFFFFFF),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Weather & Alerts · Your Neighbourhood',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                            fontFamily: 'Space Grotesk',
                          ),
                        ),
                        const SizedBox(height: 12),
                        // Weather detail grid
                        Row(
                          children: [
                            _weatherDetailCard(emoji,
                                temp != null ? '$temp°' : '--°', condition),
                            const SizedBox(width: 12),
                            _weatherDetailCard('💧',
                                w?['humidity'] != null ? '${w!['humidity']}%' : '--%', 'Humidity'),
                            const SizedBox(width: 12),
                            _weatherDetailCard('💨',
                                w?['windSpeed'] != null ? '${w!['windSpeed']} km/h' : '--', 'Wind'),
                          ],
                        ),
                        // All alerts
                        if (activeAlerts.isNotEmpty) ...[
                          const SizedBox(height: 16),
                          Text(
                            'ACTIVE ALERTS',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: text2,
                            ),
                          ),
                          const SizedBox(height: 8),
                          ...activeAlerts.map((a) => _alertTile(a)),
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _forecastStrip(dynamic currentTemp) {
    final t = currentTemp is int ? currentTemp : (currentTemp is double ? currentTemp.toInt() : 25);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: [
        _forecastItem('Now', '🌤️', '$t°'),
        _forecastItem('+1h', '🌤️', '${t + 1}°'),
        _forecastItem('+2h', '⛅', '$t°'),
        _forecastItem('+3h', '☁️', '${t - 1}°'),
      ],
    );
  }

  Widget _forecastItem(String time, String icon, String temp) {
    return Column(
      children: [
        Text(time, style: const TextStyle(fontSize: 10, color: Color(0x80FFFFFF))),
        const SizedBox(height: 2),
        Text(icon, style: const TextStyle(fontSize: 14)),
        const SizedBox(height: 2),
        Text(temp,
            style: const TextStyle(fontSize: 10, color: Color(0xB3FFFFFF), fontWeight: FontWeight.w500)),
      ],
    );
  }

  Widget _weatherDetailCard(String icon, String value, String label) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(icon, style: const TextStyle(fontSize: 22)),
            const SizedBox(height: 4),
            Text(value,
                style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    fontFamily: 'Space Grotesk')),
            const SizedBox(height: 2),
            Text(label,
                style: const TextStyle(fontSize: 10, color: Color(0x99FFFFFF))),
          ],
        ),
      ),
    );
  }

  Widget _alertTile(Map<String, dynamic> alert) {
    final sev = alert['severity'] as String? ?? 'info';
    final Color sevColor = sev == 'critical'
        ? Colors.red
        : sev == 'warning'
            ? Colors.amber
            : AppColors.primary;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: sevColor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: sevColor.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                sev.toUpperCase(),
                style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: sevColor),
              ),
              if (alert['location'] != null) ...[
                const SizedBox(width: 8),
                Text(
                  '· ${alert['location']}',
                  style: TextStyle(fontSize: 10, color: sevColor.withValues(alpha: 0.6)),
                ),
              ],
            ],
          ),
          const SizedBox(height: 4),
          Text(
            alert['title'] as String? ?? '',
            style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.white),
          ),
          if (alert['description'] != null) ...[
            const SizedBox(height: 4),
            Text(
              alert['description'] as String,
              style: const TextStyle(fontSize: 11, color: Color(0x99FFFFFF)),
            ),
          ],
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY ICONS ROW (matching React UtilityIconsRow.tsx)
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildUtilityIcons(Color text, Color text2, Color border, bool isDark) {
    return Column(
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: _utilityCategories.map((cat) {
              final isActive = _activeUtilityCategory == cat.key;
              return GestureDetector(
                onTap: () {
                  if (_activeUtilityCategory == cat.key) {
                    setState(() {
                      _activeUtilityCategory = null;
                      _filteredUtilityLinks = [];
                    });
                  } else {
                    setState(() => _activeUtilityCategory = cat.key);
                    _loadFilteredUtilityLinks(cat.key);
                  }
                },
                child: Container(
                  margin: const EdgeInsets.only(right: 12),
                  child: Column(
                    children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: isActive
                              ? AppColors.primary
                              : (isDark ? AppColors.card : AppColorsLight.card),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isActive
                                ? AppColors.primary
                                : border,
                          ),
                        ),
                        child: Center(
                          child: Text(
                            cat.icon,
                            style: const TextStyle(fontSize: 20),
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        cat.label,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w500,
                          color: isActive ? AppColors.primary : text2,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        // Expanded filtered utility links
        if (_activeUtilityCategory != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark ? AppColors.card : AppColorsLight.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${_utilityCategories.firstWhere((c) => c.key == _activeUtilityCategory).label} Links',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: text,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => setState(() {
                        _activeUtilityCategory = null;
                        _filteredUtilityLinks = [];
                      }),
                      child: Text(
                        'Close',
                        style: TextStyle(fontSize: 10, color: text2),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (_filteredUtilityLinks.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Center(
                      child: Text(
                        'No links available for this category yet.',
                        style: TextStyle(fontSize: 12, color: text2),
                      ),
                    ),
                  )
                else
                  ..._filteredUtilityLinks.map((link) => _utilityLinkTile(
                      link, isDark, border)),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _utilityLinkTile(
      Map<String, dynamic> link, bool isDark, Color border) {
    return GestureDetector(
      onTap: () {
        _api.trackUtilityClick(link['id'] as String? ?? '');
        // Open URL
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: isDark ? AppColors.bg3 : AppColorsLight.bg3,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Center(
                child: Text(
                  _activeUtilityCategory != null
                      ? (_utilityCategories
                              .firstWhere((c) => c.key == _activeUtilityCategory)
                              .icon)
                      : '🔗',
                  style: const TextStyle(fontSize: 12),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    link['title'] as String? ?? '',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: isDark ? AppColors.text : AppColorsLight.text,
                    ),
                  ),
                  if (link['description'] != null)
                    Text(
                      link['description'] as String,
                      style: TextStyle(
                          fontSize: 10,
                          color: isDark
                              ? AppColors.text2
                              : AppColorsLight.text2),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
            Icon(Icons.arrow_outward,
                size: 14, color: isDark ? AppColors.text3 : AppColorsLight.text3),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH BOX
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildSearchBox() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxWidth =
            constraints.maxWidth > 480 ? 480.0 : constraints.maxWidth;
        return Center(
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
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: Theme.of(context).brightness == Brightness.dark
                      ? AppColors.card
                      : AppColorsLight.card,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? AppColors.border
                        : AppColorsLight.border,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(Icons.search,
                        size: 16,
                        color: Theme.of(context).brightness == Brightness.dark
                            ? AppColors.text3
                            : AppColorsLight.text3),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Search services, businesses, skills near you...',
                        style: TextStyle(
                          fontSize: 14,
                          color: Theme.of(context).brightness == Brightness.dark
                              ? AppColors.text3
                              : AppColorsLight.text3,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NEWS TABS + LIST (matching React NewsFeed.tsx)
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildNewsTabs(Color text2, bool isDark) {
    final card = isDark ? AppColors.card : AppColorsLight.card;
    final border = isDark ? AppColors.border : AppColorsLight.border;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _newsCategories.map((cat) {
          final isActive = _activeNewsCategory == cat.key;
          return GestureDetector(
            onTap: () => setState(() => _activeNewsCategory = cat.key),
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: isActive
                    ? AppColors.primary
                    : card,
                borderRadius: BorderRadius.circular(20),
                border: isActive
                    ? null
                    : Border.all(color: border),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (cat.icon != null) ...[
                    Text(cat.icon!, style: const TextStyle(fontSize: 12)),
                    const SizedBox(width: 6),
                  ],
                  Text(
                    cat.label,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: isActive ? Colors.white : text2,
                    ),
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildNewsList(
      List<Map<String, dynamic>> articles, Color text, Color text2, bool isDark) {
    final card = isDark ? AppColors.card : AppColorsLight.card;
    final border = isDark ? AppColors.border : AppColorsLight.border;

    if (articles.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: border),
        ),
        child: Column(
          children: [
            const Text('📰', style: TextStyle(fontSize: 32)),
            const SizedBox(height: 12),
            Text(
              'No news articles yet',
              style: TextStyle(fontSize: 14, color: text2),
            ),
            const SizedBox(height: 4),
            Text(
              'Check back later for local updates',
              style: TextStyle(
                  fontSize: 11,
                  color: Theme.of(context).brightness == Brightness.dark
                      ? AppColors.text3
                      : AppColorsLight.text3),
            ),
          ],
        ),
      );
    }

    return Column(
      children: articles.map((article) {
        final catInfo = _newsCategories.firstWhere(
            (c) => c.key == (article['category'] ?? ''),
            orElse: () => _newsCategories[0]);
        final hasImage = article['imageUrl'] != null;
        return GestureDetector(
          onTap: () {
            final id = article['id'] as String? ?? '';
            // Navigate to news detail could be added here
          },
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: border),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (hasImage)
                  SizedBox(
                    height: 128,
                    width: double.infinity,
                    child: Image.network(
                      article['imageUrl'] as String,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) =>
                          const SizedBox(height: 128),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: catInfo.catColor ??
                                  (isDark ? AppColors.bg3 : AppColorsLight.bg3),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (catInfo.icon != null) ...[
                                  Text(catInfo.icon!,
                                      style: const TextStyle(fontSize: 10)),
                                  const SizedBox(width: 4),
                                ],
                                Text(
                                  catInfo.label,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w500,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (article['isFeatured'] == true) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                'Featured',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.primary,
                                ),
                              ),
                            ),
                          ],
                          const Spacer(),
                          Text(
                            _formatTimeAgo(
                                article['publishedAt'] as String?),
                            style: TextStyle(
                              fontSize: 10,
                              color: isDark
                                  ? AppColors.text3
                                  : AppColorsLight.text3,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        article['title'] as String? ?? '',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: text,
                          fontFamily: 'Space Grotesk',
                          height: 1.3,
                        ),
                      ),
                      if (article['summary'] != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          article['summary'] as String,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            color: text2,
                            height: 1.5,
                          ),
                        ),
                      ],
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.only(top: 12),
                        decoration: BoxDecoration(
                          border: Border(top: BorderSide(color: border)),
                        ),
                        child: Row(
                          children: [
                            Text(
                              'Tap to read more',
                              style: TextStyle(
                                fontSize: 10,
                                color: isDark
                                    ? AppColors.text3
                                    : AppColorsLight.text3,
                              ),
                            ),
                            const Spacer(),
                            Icon(
                              Icons.chevron_right,
                              size: 14,
                              color: isDark
                                  ? AppColors.text3
                                  : AppColorsLight.text3,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA CLASSES
// ═══════════════════════════════════════════════════════════════════════════

class _UtilityCat {
  final String key;
  final String label;
  final String icon;
  const _UtilityCat(this.key, this.label, this.icon);
}

class _NewsCat {
  final String key;
  final String label;
  final String? icon;
  final Color? catColor;
  const _NewsCat(this.key, this.label, this.icon, this.catColor);
}

// ═══════════════════════════════════════════════════════════════════════════
// MY POSTS TAB — inner sub-tabs: Posts | Stories | Saved
// ═══════════════════════════════════════════════════════════════════════════

class MyPostsTab extends StatefulWidget {
  const MyPostsTab({super.key});

  @override
  State<MyPostsTab> createState() => _MyPostsTabState();
}

class _MyPostsTabState extends State<MyPostsTab>
    with SingleTickerProviderStateMixin {
  late final TabController _innerTabController;
  final ApiService _api = ApiService();

  bool _loadingPosts = true;
  bool _loadingStories = true;
  bool _loadingSaved = true;

  List<Map<String, dynamic>> _myPosts = [];
  List<Map<String, dynamic>> _stories = [];
  List<Map<String, dynamic>> _savedPosts = [];

  bool _gridView = false;

  @override
  void initState() {
    super.initState();
    _innerTabController = TabController(length: 3, vsync: this);
    _loadAllData();
  }

  @override
  void dispose() {
    _innerTabController.dispose();
    super.dispose();
  }

  Future<void> _loadAllData() async {
    await Future.wait([
      _loadMyPosts(),
      _loadStories(),
      _loadSavedPosts(),
    ]);
  }

  Future<void> _loadMyPosts() async {
    try {
      final result = await _api.getMyPosts();
      final data = result['data'] as List<dynamic>?;
      _myPosts = data?.cast<Map<String, dynamic>>() ?? [];
    } catch (_) {
      _myPosts = [];
    }
    if (mounted) setState(() => _loadingPosts = false);
  }

  Future<void> _loadStories() async {
    try {
      final result = await _api.getStories();
      final data = result['data'] as List<dynamic>?;
      _stories = data?.cast<Map<String, dynamic>>() ?? [];
    } catch (_) {
      _stories = [];
    }
    if (mounted) setState(() => _loadingStories = false);
  }

  Future<void> _loadSavedPosts() async {
    try {
      final result = await _api.getSavedPosts();
      final data = result['data'] as List<dynamic>?;
      _savedPosts = data?.cast<Map<String, dynamic>>() ?? [];
    } catch (_) {
      _savedPosts = [];
    }
    if (mounted) setState(() => _loadingSaved = false);
  }

  String _formatTimeAgo(String dateStr) {
    if (dateStr.isEmpty) return '';
    try {
      final dt = DateTime.parse(dateStr);
      final diff = DateTime.now().difference(dt);
      if (diff.inDays > 7) {
        final months = diff.inDays ~/ 30;
        return months > 0 ? '${months}mo' : '${diff.inDays}d';
      }
      if (diff.inDays > 0) return '${diff.inDays}d';
      if (diff.inHours > 0) return '${diff.inHours}h';
      if (diff.inMinutes > 0) return '${diff.inMinutes}m';
      return 'now';
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.bg : AppColorsLight.bg;
    final text2 = isDark ? AppColors.text2 : AppColorsLight.text2;
    final border = isDark ? AppColors.border : AppColorsLight.border;

    return Column(
      children: [
        Container(
          color: bg,
          padding: const EdgeInsets.only(top: 8),
          child: Row(
            children: [
              Expanded(
                child: TabBar(
                  controller: _innerTabController,
                  indicatorSize: TabBarIndicatorSize.label,
                  indicatorColor: AppColors.primary,
                  labelColor: AppColors.primary,
                  unselectedLabelColor: text2,
                  labelStyle: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'Space Grotesk',
                  ),
                  unselectedLabelStyle: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                  tabs: const [
                    Tab(text: 'Posts'),
                    Tab(text: 'Stories'),
                    Tab(text: 'Saved'),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: GestureDetector(
                  onTap: () => setState(() => _gridView = !_gridView),
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.card : AppColorsLight.card,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: border),
                    ),
                    child: Icon(
                      _gridView ? Icons.view_list : Icons.grid_view,
                      size: 18,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _innerTabController,
            children: [
              _loadingPosts
                  ? const Center(child: CircularProgressIndicator())
                  : _gridView
                      ? _buildPostGrid(_myPosts)
                      : _buildPostList(_myPosts),
              _loadingStories
                  ? const Center(child: CircularProgressIndicator())
                  : _buildStoryList(),
              _loadingSaved
                  ? const Center(child: CircularProgressIndicator())
                  : Padding(
                      padding: const EdgeInsets.only(top: 24),
                      child: _gridView
                          ? _buildPostGrid(_savedPosts)
                          : _buildPostList(_savedPosts),
                    ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPostList(List<Map<String, dynamic>> posts) {
    if (posts.isEmpty) {
      return _buildEmptyState('No posts yet');
    }
    return ListView.builder(
      itemCount: posts.length,
      padding: const EdgeInsets.only(bottom: 80),
      itemBuilder: (_, i) => _postCard(posts[i]),
    );
  }

  Widget _buildPostGrid(List<Map<String, dynamic>> posts) {
    if (posts.isEmpty) {
      return _buildEmptyState('No posts yet');
    }
    return GridView.builder(
      itemCount: posts.length,
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 80),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 0.82,
      ),
      itemBuilder: (_, i) => _postCard(posts[i], compact: true),
    );
  }

  Widget _buildStoryList() {
    if (_stories.isEmpty) {
      return _buildEmptyState('No stories yet');
    }
    return ListView.builder(
      itemCount: _stories.length,
      padding: const EdgeInsets.only(bottom: 80),
      itemBuilder: (_, i) => _storyCard(_stories[i]),
    );
  }

  Widget _buildEmptyState(String message) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.inbox_outlined, size: 48, color: AppColors.text3),
          const SizedBox(height: 12),
          Text(
            message,
            style: const TextStyle(fontSize: 14, color: AppColors.text2),
          ),
        ],
      ),
    );
  }

  Widget _postCard(Map<String, dynamic> post, {bool compact = false}) {
    final author = post['author'] as Map<String, dynamic>? ?? {};
    final authorName = (author['displayName'] ?? 'User') as String;
    final authorInitial = authorName.characters.first.toUpperCase();
    final category = post['category'] as Map<String, dynamic>? ?? {};
    final categoryName = (category['name'] ?? 'General') as String;
    final caption = post['caption'] as String? ?? '';
    final likeCount = (post['likeCount'] ?? 0) as int;
    final commentCount = (post['commentCount'] ?? 0) as int;
    final media = (post['media'] as List<dynamic>?) ?? [];
    final hasImage = media.isNotEmpty;
    final createdAt = post['publishedAt'] ?? post['createdAt'] ?? '';
    final timeAgo = _formatTimeAgo(createdAt is String ? createdAt : '');

    final card = Container(
      margin: EdgeInsets.fromLTRB(
        compact ? 0 : 14,
        compact ? 0 : 0,
        compact ? 0 : 14,
        compact ? 0 : 14,
      ),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.all(compact ? 8 : 12),
            child: Row(
              children: [
                Container(
                  width: compact ? 28 : 36,
                  height: compact ? 28 : 36,
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(compact ? 8 : 10),
                  ),
                  child: Center(
                    child: Text(
                      authorInitial,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        fontSize: compact ? 12 : 14,
                        fontFamily: 'Space Grotesk',
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        authorName,
                        style: TextStyle(
                          fontSize: compact ? 11 : 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.text,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        '$categoryName · $timeAgo',
                        style: TextStyle(
                          fontSize: compact ? 9 : 10,
                          color: AppColors.text3,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (hasImage)
            Container(
              height: compact ? 100 : 140,
              width: double.infinity,
              decoration: BoxDecoration(
                color: AppColors.border2.withValues(alpha: 0.2),
                image: DecorationImage(
                  image: NetworkImage(
                    (media.first as Map<String, dynamic>)['url'] as String? ?? '',
                  ),
                  fit: BoxFit.cover,
                  onError: (error, stackTrace) {},
                ),
              ),
            ),
          if (caption.isNotEmpty)
            Padding(
              padding: EdgeInsets.fromLTRB(
                compact ? 8 : 12,
                compact ? 6 : 8,
                compact ? 8 : 12,
                0,
              ),
              child: Text(
                caption,
                maxLines: compact ? 2 : 3,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: compact ? 10 : 12,
                  color: AppColors.text,
                  height: 1.5,
                ),
              ),
            ),
          Padding(
            padding: EdgeInsets.all(compact ? 8 : 10),
            child: Row(
              children: [
                _actionItem(Icons.favorite_border, likeCount.toString(),
                    compact: compact),
                const SizedBox(width: 12),
                _actionItem(Icons.chat_bubble_outline, commentCount.toString(),
                    compact: compact),
                const Spacer(),
                _actionItem(Icons.bookmark_border, '',
                    compact: compact, color: AppColors.text3),
              ],
            ),
          ),
        ],
      ),
    );

    if (!compact) {
      return GestureDetector(
        onTap: () {
          final postId = post['id'] as String? ?? '';
          if (postId.isNotEmpty) {
            Navigator.pushNamed(context, '/post-detail', arguments: postId);
          }
        },
        child: card,
      );
    }
    return card;
  }

  Widget _storyCard(Map<String, dynamic> story) {
    final author = story['author'] as Map<String, dynamic>? ?? {};
    final authorName = (author['displayName'] ?? 'User') as String;
    final mediaUrl = story['mediaUrl'] as String? ?? '';
    final createdAt = story['createdAt'] as String? ?? '';
    final timeAgo = _formatTimeAgo(createdAt);
    final viewCount = (story['viewCount'] ?? 0) as int;

    return Container(
      margin: const EdgeInsets.fromLTRB(14, 0, 14, 14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (mediaUrl.isNotEmpty)
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              child: Image.network(
                mediaUrl,
                height: 160,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) =>
                    Container(height: 160, color: AppColors.border2),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Center(
                    child: Text(
                      authorName.characters.first.toUpperCase(),
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        fontSize: 12,
                        fontFamily: 'Space Grotesk',
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    authorName,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.text,
                    ),
                  ),
                ),
                Text(
                  timeAgo,
                  style: const TextStyle(fontSize: 10, color: AppColors.text3),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionItem(IconData icon, String count,
      {bool compact = false, Color? color}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: compact ? 14 : 16,
          color: color ?? AppColors.text2,
        ),
        if (count.isNotEmpty) ...[
          const SizedBox(width: 4),
          Text(
            count,
            style: TextStyle(
              fontSize: compact ? 10 : 11,
              color: color ?? AppColors.text2,
            ),
          ),
        ],
      ],
    );
  }
}