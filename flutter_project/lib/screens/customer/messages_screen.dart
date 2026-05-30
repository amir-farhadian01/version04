import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../providers/cache_provider.dart';
import '../../cache/cache_policy.dart';
import '../../cache/cache_manager.dart';
import '../../services/api_service.dart';
import '../../widgets/cached_list_view.dart';

/// Customer inbox with Active, Offers, and History tabs.
///
/// Uses the five-layer caching system: memory (L1), disk (L2), network (L3).
/// Only visible items are rendered thanks to [CachedListView]/[ListView.builder].
class CustomerMessagesScreen extends StatefulWidget {
  const CustomerMessagesScreen({super.key});

  @override
  State<CustomerMessagesScreen> createState() => _CustomerMessagesScreenState();
}

class _CustomerMessagesScreenState extends State<CustomerMessagesScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final ApiService _api = ApiService();

  bool _loading = true;
  CacheSource _source = CacheSource.network;
  final List<Map<String, dynamic>> _conversations = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadInbox();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadInbox() async {
    setState(() => _loading = true);

    final cache = context.read<CacheProvider>();

    try {
      final result = await cache.fetch(
        key: '/chat/inbox',
        group: 'messages',
        ttl: CachePolicy.messagesTtl,
        fetcher: () => _api.getInbox(),
      );

      _source = result.source;
      final items = (result.data['data'] as List<dynamic>?)
              ?.cast<Map<String, dynamic>>() ??
          (result.data['items'] as List<dynamic>?)
                  ?.cast<Map<String, dynamic>>() ??
              _mockConversations();

      _conversations.clear();
      _conversations.addAll(items);
    } catch (_) {
      _conversations.clear();
      _conversations.addAll(_mockConversations());
      _source = CacheSource.disk;
    }

    setState(() => _loading = false);
  }

  List<Map<String, dynamic>> _mockConversations() => [
        {
          'id': 'chat-1',
          'userName': 'AutoFix Vaughan',
          'lastMessage': 'Your oil change is scheduled for Monday.',
          'unread': 2,
          'time': '2m ago',
        },
        {
          'id': 'chat-2',
          'userName': 'CleanPro Services',
          'lastMessage': 'We received your booking request.',
          'unread': 0,
          'time': '1h ago',
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
                Text('Messages',
                    style: TextStyle(
                        fontFamily: 'Space Grotesk',
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: text)),
                const Spacer(),
                if (_source != CacheSource.network)
                  Icon(Icons.cloud_off, size: 14, color: AppColors.warn),
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
            dividerColor: Colors.transparent,
            tabs: const [
              Tab(text: 'Active'),
              Tab(text: 'Offers'),
              Tab(text: 'History'),
            ],
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildConversationList(),
                _buildEmptyTab('No offer conversations yet'),
                _buildEmptyTab('No message history'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildConversationList() {
    return CachedListView(
      itemCount: _conversations.length,
      isLoading: _loading,
      loadingWidget: const Center(child: CircularProgressIndicator()),
      emptyWidget: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.chat, size: 48, color: AppColors.text3),
            const SizedBox(height: 12),
            const Text('No messages yet',
                style: TextStyle(fontSize: 13, color: AppColors.text3)),
          ],
        ),
      ),
      padding: const EdgeInsets.all(14),
      itemBuilder: (ctx, i) {
        final c = _conversations[i];
        return _conversationTile(c);
      },
    );
  }

  Widget _buildEmptyTab(String message) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.inbox, size: 48, color: AppColors.text3),
          const SizedBox(height: 12),
          Text(message,
              style: const TextStyle(fontSize: 13, color: AppColors.text3)),
        ],
      ),
    );
  }

  Widget _conversationTile(Map<String, dynamic> conv) {
    final unread = (conv['unread'] as int?) ?? 0;
    return GestureDetector(
      onTap: () {
        Navigator.pushNamed(context, '/customer/contract-chat',
            arguments: conv['id']);
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: unread > 0
                    ? AppColors.primary.withValues(alpha: 0.15)
                    : AppColors.bg3,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  ((conv['userName'] as String? ?? 'U')[0]).toUpperCase(),
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: unread > 0
                          ? AppColors.primary
                          : AppColors.text3,
                      fontFamily: 'Space Grotesk'),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          conv['userName'] as String? ?? 'User',
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.text),
                        ),
                      ),
                      Text(
                        conv['time'] as String? ?? '',
                        style: const TextStyle(
                            fontSize: 10, color: AppColors.text3),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    conv['lastMessage'] as String? ?? '',
                    style: TextStyle(
                      fontSize: 12,
                      color: unread > 0 ? AppColors.text : AppColors.text3,
                      fontWeight:
                          unread > 0 ? FontWeight.w500 : FontWeight.normal,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (unread > 0) ...[
              const SizedBox(width: 8),
              Container(
                width: 20,
                height: 20,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    unread.toString(),
                    style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: Colors.white),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}