import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';
import '../../widgets/service_search_delegate.dart';

/// Home screen (TAB 1) with Home and My Posts sub-tabs.
/// Displays neighbourhood banner, utility icons, search, news feed,
/// and a My Posts tab with Posts / Stories / Saved inner tabs.
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
      _banner = {
        'title': 'Central Park Vaughan',
        'temp': '13°C',
        'condition': 'Sunny',
        'alert': 'Police Alert',
      };
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
        {
          'title': 'Construction rates up 12%',
          'time': '2h',
          'color': 'primary',
        },
        {
          'title': 'Traffic delay on Major Mackenzie Dr',
          'time': '45m',
          'color': 'warn',
        },
        {
          'title': 'Music Festival at Vaughan Mills',
          'time': '5h',
          'color': 'secondary',
        },
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
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 10),
            decoration: BoxDecoration(
              color: bg,
              border: Border(bottom: BorderSide(color: border)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.location_on,
                            size: 12, color: AppColors.primary),
                        const SizedBox(width: 5),
                        Text(
                          _currentLocation,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Good morning 👋',
                      style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w700,
                        color: text,
                        fontFamily: 'Space Grotesk',
                      ),
                    ),
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
                      border:
                          Border.all(color: AppColors.primary, width: 2),
                    ),
                    child: const Center(
                      child: Text(
                        'A',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                          fontSize: 15,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Main tab bar: Home | My Posts
          Container(
            color: bg,
            child: TabBar(
              controller: _tabController,
              indicatorSize: TabBarIndicatorSize.label,
              indicatorColor: AppColors.primary,
              labelColor: AppColors.primary,
              unselectedLabelColor: text2,
              labelStyle: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                fontFamily: 'Space Grotesk',
              ),
              unselectedLabelStyle: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
              tabs: const [
                Tab(text: 'Home'),
                Tab(text: 'My Posts'),
              ],
            ),
          ),

          // Tab content
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : TabBarView(
                    controller: _tabController,
                    children: [
                      // ── TAB 0: Home ──
                      _buildHomeTab(text2),
                      // ── TAB 1: My Posts ──
                      const MyPostsTab(),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildHomeTab(Color text2) {
    return SingleChildScrollView(
      child: Column(
        children: [
          // Neighbourhood Banner
          _buildBanner(),
          // Search box
          _buildSearchBox(),
          // Utility Icons
          _buildUtilityIcons(),
          // News
          _buildSection(
            'Local News',
            _news.map((n) => _newsTile(n)).toList(),
            text2,
          ),
          // Events
          _buildSection('Local Events', _buildEventCards(), text2),
          const SizedBox(height: 80),
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
        gradient: const LinearGradient(
          colors: [Color(0xFF1A3580), Color(0xFF0A1228)],
        ),
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
                  Text(
                    'Photo of the Week',
                    style:
                        TextStyle(fontSize: 11, color: Color(0xFFC8D8FF)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _banner?['title'] as String? ?? 'Neighbourhood',
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                fontFamily: 'Space Grotesk',
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                _bannerPill(
                  Icons.access_time,
                  '${_banner?['temp'] ?? '??'} · ${_banner?['condition'] ?? ''}',
                  Colors.white.withValues(alpha: 0.1),
                ),
                const SizedBox(width: 8),
                if (_banner?['alert'] != null)
                  _bannerPill(
                    Icons.warning_amber,
                    _banner!['alert'].toString(),
                    const Color(0x26FFB800),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _bannerPill(IconData icon, String text, Color bgColor) {
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
          Text(
            text,
            style: const TextStyle(fontSize: 11, color: Color(0xFFD0E0FF)),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBox() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxWidth =
            constraints.maxWidth > 480 ? 480.0 : constraints.maxWidth;
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
                  child: Row(
                    children: [
                      const Icon(Icons.search,
                          size: 16, color: AppColors.text3),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Search services in your area...',
                          style: TextStyle(
                            fontSize:
                                constraints.maxWidth < 360 ? 13 : 14,
                            color: AppColors.text3,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
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
                      child: Center(
                        child: Text(
                          u['label'] as String? ?? '',
                          style: const TextStyle(fontSize: 18),
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      u['label'] as String? ?? '',
                      style: const TextStyle(
                        fontSize: 10,
                        color: AppColors.text2,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildSection(
      String title, List<Widget> children, Color text2) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.article, size: 14, color: AppColors.text2),
              const SizedBox(width: 6),
              Text(
                title,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: text2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...children,
        ],
      ),
    );
  }

  Widget _newsTile(Map<String, dynamic> item) {
    final c = item['color'] as String? ?? 'primary';
    final colorVal = c == 'warn'
        ? AppColors.warn
        : c == 'secondary'
            ? AppColors.secondary
            : AppColors.primary;
    return Container(
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
            decoration:
                BoxDecoration(color: colorVal, shape: BoxShape.circle),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              item['title'] as String? ?? '',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.text,
                height: 1.5,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            item['time'] as String? ?? '',
            style: const TextStyle(fontSize: 10, color: AppColors.text3),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildEventCards() {
    final events = [
      (
        'Craft Festival',
        'May 10 · Vaughan Mills',
        [const Color(0x550FC98A), const Color(0xFF001105)]
      ),
      (
        'Concert Night',
        'May 14 · Club District',
        [const Color(0x55FF7A2B), const Color(0xFF210A00)]
      ),
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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Text(
                      e.$1,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        fontFamily: 'Space Grotesk',
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      e.$2,
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xB3FFFFFF),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ),
    ];
  }
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

  /// Whether to show posts in grid view (true) or list view (false).
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
        // Inner tab bar: Posts | Stories | Saved — with padding to prevent
        // content from hiding behind it.
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
              // List / Grid toggle
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: GestureDetector(
                  onTap: () => setState(() => _gridView = !_gridView),
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: AppColors.card,
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

        // Inner tab content — with explicit padding-top so cards
        // never overlap with the tab bar or its indicator underline.
        Expanded(
          child: TabBarView(
            controller: _innerTabController,
            children: [
              // ── POSTS (no extra padding — no overlap issue) ──
              _loadingPosts
                  ? const Center(child: CircularProgressIndicator())
                  : _gridView
                      ? _buildPostGrid(_myPosts)
                      : _buildPostList(_myPosts),

              // ── STORIES (no extra padding — no overlap issue) ──
              _loadingStories
                  ? const Center(child: CircularProgressIndicator())
                  : _buildStoryList(),

              // ── SAVED (padding-top added to prevent cards hiding behind tab bar) ──
              _loadingSaved
                  ? const Center(child: CircularProgressIndicator())
                  : Padding(
                      padding: const EdgeInsets.only(top: 20),
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

  /// List view of post cards.
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

  /// Grid view of post cards (2 columns).
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

  /// Story cards (always linear/horizontal).
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
          const Icon(Icons.inbox_outlined,
              size: 48, color: AppColors.text3),
          const SizedBox(height: 12),
          Text(
            message,
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.text2,
            ),
          ),
        ],
      ),
    );
  }

  /// Post card — shared between list and grid modes.
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
          // Header
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

          // Media thumbnail
          if (hasImage)
            Container(
              height: compact ? 100 : 140,
              width: double.infinity,
              decoration: BoxDecoration(
                color: AppColors.border2.withValues(alpha: 0.2),
                image: DecorationImage(
                  image: NetworkImage(
                    (media.first as Map<String, dynamic>)['url'] as String? ??
                        '',
                  ),
                  fit: BoxFit.cover,
                  onError: (error, stackTrace) {},
                ),
              ),
            ),

          // Caption (shortened in compact mode)
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

          // Action bar
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
                    compact: compact,
                    color: AppColors.text3),
              ],
            ),
          ),
        ],
      ),
    );

    // In non-compact list mode, wrap in a GestureDetector for navigation
    if (!compact) {
      return GestureDetector(
        onTap: () {
          final postId = post['id'] as String? ?? '';
          if (postId.isNotEmpty) {
            Navigator.pushNamed(context, '/explorer/comments',
                arguments: postId);
          }
        },
        child: card,
      );
    }
    return card;
  }

  /// Simple story card — linear list style.
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
          // Media
          if (mediaUrl.isNotEmpty)
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(16)),
              child: Container(
                height: 180,
                width: double.infinity,
                color: AppColors.border2.withValues(alpha: 0.3),
                child: Image.network(
                  mediaUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => const Center(
                    child: Icon(Icons.broken_image,
                        size: 40, color: AppColors.text3),
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Center(
                    child: Text(
                      authorName.characters.first.toUpperCase(),
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        fontSize: 14,
                        fontFamily: 'Space Grotesk',
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        authorName,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.text,
                        ),
                      ),
                      Text(
                        timeAgo.isNotEmpty ? '$timeAgo · $viewCount views' : '',
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.text3,
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

  /// Action item with icon + count (like, comment, bookmark).
  Widget _actionItem(IconData icon, String label,
      {Color? color, bool compact = false}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: compact ? 14 : 16,
          color: color ?? AppColors.text3,
        ),
        if (label.isNotEmpty) ...[
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: compact ? 10 : 11,
              color: color ?? AppColors.text3,
            ),
          ),
        ],
      ],
    );
  }
}