import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../cache/image_cache_config.dart';

/// Full-screen story viewer with auto-advance timer.
class StoryScreen extends StatefulWidget {
  final String storyId;

  const StoryScreen({super.key, required this.storyId});

  @override
  State<StoryScreen> createState() => _StoryScreenState();
}

class _StoryScreenState extends State<StoryScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _progressController;
  bool _paused = false;

  final ApiService _api = ApiService();
  Map<String, dynamic>? _story;
  bool _loadingStory = true;
  String? _storyError;

  @override
  void initState() {
    super.initState();
    _progressController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 5),
    )..addStatusListener((status) {
        if (status == AnimationStatus.completed) {
          Navigator.pop(context);
        }
      });
    _progressController.forward();
    _loadStory();
  }

  @override
  void dispose() {
    _progressController.dispose();
    super.dispose();
  }

  Future<void> _loadStory() async {
    try {
      final result = await _api.get('/stories/${widget.storyId}');
      if (mounted) {
        setState(() {
          _story = result;
          _loadingStory = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _storyError = 'Story not available';
          _loadingStory = false;
        });
      }
    }
  }

  void _togglePause() {
    setState(() {
      _paused = !_paused;
      if (_paused) {
        _progressController.stop();
      } else {
        _progressController.forward();
      }
    });
  }

  Widget _buildStoryContent() {
    final mediaUrl = _story!['mediaUrl'] as String? ?? '';
    final thumbnailUrl = _story!['thumbnailUrl'] as String? ?? '';
    final imageUrl = mediaUrl.isNotEmpty ? mediaUrl : thumbnailUrl;
    final author = _story!['author'] as Map<String, dynamic>? ?? {};
    final authorName = (author['displayName'] ?? 'User') as String;
    final authorInitial = authorName.characters.first.toUpperCase();
    final caption = _story!['caption'] as String? ?? '';

    return Stack(
      fit: StackFit.expand,
      children: [
        // Background: image or fallback
        if (imageUrl.isNotEmpty)
          CachedNetworkImage(
            imageUrl: imageUrl,
            fit: BoxFit.cover,
            cacheManager: ImageCacheConfig.manager,
            placeholder: (_, _) => Container(color: Colors.black),
            errorWidget: (_, _, _) =>
                Container(color: const Color(0xFF1A1A2E)),
          )
        else
          Container(
            color: const Color(0xFF1A1A2E),
            child: const Center(
              child: Icon(Icons.hide_image_outlined,
                  size: 64, color: Colors.white24),
            ),
          ),

        // Dark gradient overlay at top (for progress bar readability)
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: 120,
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.black54, Colors.transparent],
              ),
            ),
          ),
        ),

        // Dark gradient overlay at bottom (for author + caption)
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          height: 180,
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.bottomCenter,
                end: Alignment.topCenter,
                colors: [Colors.black87, Colors.transparent],
              ),
            ),
          ),
        ),

        // Author row + caption at bottom
        Positioned(
          bottom: 40,
          left: 16,
          right: 60,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.white38, width: 1),
                    ),
                    child: Center(
                      child: Text(
                        authorInitial,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    authorName,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
              if (caption.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  caption,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    height: 1.4,
                    shadows: [Shadow(blurRadius: 4, color: Colors.black45)],
                  ),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _togglePause(),
      onTapUp: (_) => _togglePause(),
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          children: [
            // Story content
            _loadingStory
                ? Container(
                    width: double.infinity,
                    height: double.infinity,
                    color: Colors.black,
                    child: const Center(
                      child: CircularProgressIndicator(
                          color: Colors.white54, strokeWidth: 2),
                    ),
                  )
                : _storyError != null || _story == null
                    ? Container(
                        width: double.infinity,
                        height: double.infinity,
                        color: Colors.black,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.broken_image,
                                size: 48, color: Colors.white38),
                            const SizedBox(height: 16),
                            Text(
                              _storyError ?? 'Story not found',
                              style: const TextStyle(
                                  color: Colors.white54, fontSize: 14),
                            ),
                          ],
                        ),
                      )
                    : _buildStoryContent(),
            // Progress bar
            Positioned(
              top: 48,
              left: 16,
              right: 16,
              child: AnimatedBuilder(
                animation: _progressController,
                builder: (context, child) {
                  return ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: LinearProgressIndicator(
                      value: _progressController.value,
                      backgroundColor: Colors.white24,
                      valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                      minHeight: 3,
                    ),
                  );
                },
              ),
            ),
            // Close button
            Positioned(
              top: 56,
              right: 16,
              child: GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: Colors.black38,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Icon(Icons.close, color: Colors.white, size: 20),
                ),
              ),
            ),
            // Pause indicator
            if (_paused)
              const Center(
                child: Icon(Icons.pause_circle, size: 48, color: Colors.white54),
              ),
          ],
        ),
      ),
    );
  }
}