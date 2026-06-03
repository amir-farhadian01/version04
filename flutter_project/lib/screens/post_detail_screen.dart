import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

class PostDetailScreen extends StatefulWidget {
  final String postId;
  const PostDetailScreen({super.key, required this.postId});

  @override
  State<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends State<PostDetailScreen> {
  final ApiService _api = ApiService();

  Map<String, dynamic>? _post;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPost();
  }

  Future<void> _loadPost() async {
    try {
      final result = await _api.get('/social/posts/${widget.postId}');
      final data = result['data'] as Map<String, dynamic>?;
      if (mounted) {
        setState(() {
          _post = data;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Post not found or has been removed.';
          _loading = false;
        });
      }
    }
  }

  Future<void> _toggleSave() async {
    if (_post == null) return;
    final prevSaved = _post!['isSaved'] as bool? ?? false;
    setState(() => _post!['isSaved'] = !prevSaved);
    try {
      final result = await _api.post('/social/posts/${widget.postId}/save');
      final saved = result['data']?['saved'] as bool? ?? !prevSaved;
      if (mounted) setState(() => _post!['isSaved'] = saved);
    } catch (_) {
      if (mounted) setState(() => _post!['isSaved'] = prevSaved);
    }
  }

  Future<void> _toggleLike() async {
    if (_post == null) return;
    final prevLiked = _post!['isLiked'] as bool? ?? false;
    final prevCount = (_post!['likeCount'] ?? 0) as int;
    setState(() {
      _post!['isLiked'] = !prevLiked;
      _post!['likeCount'] = prevLiked ? prevCount - 1 : prevCount + 1;
    });
    try {
      final result = await _api.post('/social/posts/${widget.postId}/like');
      final liked = result['data']?['liked'] as bool? ?? !prevLiked;
      if (mounted) setState(() => _post!['isLiked'] = liked);
    } catch (_) {
      if (mounted) {
        setState(() {
          _post!['isLiked'] = prevLiked;
          _post!['likeCount'] = prevCount;
        });
      }
    }
  }

  String _formatTimeAgo(String dateStr) {
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
    final textColor = isDark ? AppColors.text : AppColorsLight.text;
    final text2 = isDark ? AppColors.text2 : AppColorsLight.text2;

    if (_loading) {
      return Scaffold(
        backgroundColor: bg,
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_error != null || _post == null) {
      return Scaffold(
        backgroundColor: bg,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.text3),
              const SizedBox(height: 12),
              Text(
                _error ?? 'Post not found',
                style: const TextStyle(fontSize: 14, color: AppColors.text2),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Go Back'),
              ),
            ],
          ),
        ),
      );
    }

    final author = _post!['author'] as Map<String, dynamic>? ?? {};
    final authorName = (author['displayName'] ?? 'User') as String;
    final authorInitial = authorName.characters.first.toUpperCase();
    final category = _post!['category'] as Map<String, dynamic>? ?? {};
    final categoryName = (category['name'] ?? 'General') as String;
    final caption = _post!['caption'] as String? ?? '';
    final likeCount = (_post!['likeCount'] ?? 0) as int;
    final commentCount = (_post!['commentCount'] ?? 0) as int;
    final isLiked = _post!['isLiked'] as bool? ?? false;
    final isSaved = _post!['isSaved'] as bool? ?? false;
    final media = (_post!['media'] as List<dynamic>?) ?? [];
    final createdAt = _post!['publishedAt'] ?? _post!['createdAt'] ?? '';
    final timeAgo = _formatTimeAgo(createdAt is String ? createdAt : '');

    return Scaffold(
      backgroundColor: bg,
      body: SafeArea(
        child: Column(
          children: [
            // Header with back button
            Container(
              color: bg,
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: AppColors.text2),
                    onPressed: () => Navigator.pop(context),
                  ),
                  const Text(
                    'Post',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      fontFamily: 'Space Grotesk',
                      color: AppColors.text,
                    ),
                  ),
                ],
              ),
            ),
            // Scrollable content
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Media
                    if (media.isNotEmpty)
                      ClipRRect(
                        child: Image.network(
                          (media.first as Map<String, dynamic>)['url'] as String? ?? '',
                          width: double.infinity,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                            height: 280,
                            color: AppColors.border2.withValues(alpha: 0.2),
                            child: const Center(
                              child: Icon(Icons.image, size: 64, color: AppColors.text3),
                            ),
                          ),
                        ),
                      )
                    else
                      Container(
                        height: 280,
                        color: AppColors.border2.withValues(alpha: 0.2),
                        child: const Center(
                          child: Icon(Icons.image, size: 64, color: AppColors.text3),
                        ),
                      ),

                    // Author row
                    Padding(
                      padding: const EdgeInsets.fromLTRB(14, 16, 14, 8),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Center(
                              child: Text(
                                authorInitial,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontFamily: 'Space Grotesk',
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                authorName,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: textColor,
                                ),
                              ),
                              Text(
                                '$categoryName · $timeAgo',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.text3,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    // Caption
                    if (caption.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        child: Text(
                          caption,
                          style: TextStyle(
                            fontSize: 14,
                            color: textColor,
                            height: 1.6,
                          ),
                        ),
                      ),

                    const SizedBox(height: 16),

                    // Action bar
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      child: Row(
                        children: [
                          // Like button
                          GestureDetector(
                            onTap: _toggleLike,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                color: isLiked
                    ? AppColors.red.withValues(alpha: 0.1)
                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    isLiked ? Icons.favorite : Icons.favorite_border,
                                    size: 18,
                                    color: isLiked ? AppColors.red : AppColors.text3,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    likeCount.toString(),
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: isLiked ? AppColors.red : AppColors.text2,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          // Comment count
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.chat_bubble_outline, size: 18, color: AppColors.text3),
                              const SizedBox(width: 4),
                              Text(
                                commentCount.toString(),
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.text2,
                                ),
                              ),
                            ],
                          ),
                          const Spacer(),
                          // Save / Unsave toggle
                          GestureDetector(
                            onTap: _toggleSave,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: isSaved
                                    ? AppColors.warn.withValues(alpha: 0.1)
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    isSaved ? Icons.bookmark : Icons.bookmark_border,
                                    size: 18,
                                    color: isSaved ? AppColors.warn : AppColors.text3,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    isSaved ? 'Saved' : 'Save',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: isSaved ? AppColors.warn : AppColors.text2,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}