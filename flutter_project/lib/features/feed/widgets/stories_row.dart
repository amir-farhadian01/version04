import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../theme/app_theme.dart';

/// Instagram-style horizontal stories row with gradient-ring avatars.
/// - Unseen stories: pink→orange→purple gradient ring (3 colors)
/// - Seen stories: solid gray ring
/// - "Your Story" first cell with + badge for creating new story
/// - Smooth horizontal scrolling with snap-to-item behavior
class StoriesRow extends StatelessWidget {
  final List<Map<String, dynamic>> stories;
  /// Whether to show the "Your Story" cell as the first item
  final bool showYourStory;
  /// Called when the "Your Story" + cell is tapped
  final VoidCallback? onAddStory;

  const StoriesRow({
    super.key,
    required this.stories,
    this.showYourStory = true,
    this.onAddStory,
  });

  // Three-color gradient for unseen stories (Instagram-like: pink→orange→purple)
  static const List<Color> _unseenGradient = [
    Color(0xFFE1306C), // Instagram pink
    Color(0xFFF77737), // Instagram orange
    Color(0xFF8B5CF6), // Purple
  ];

  // Gray gradient for seen stories
  static const List<Color> _seenGradient = [
    Color(0xFF4A4F70),
    Color(0xFF2A2F4A),
  ];

  static const double _avatarSize = 68;
  static const double _ringWidth = 3;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 108,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
        physics: const BouncingScrollPhysics(),
        itemCount: stories.length + (showYourStory ? 1 : 0),
        itemBuilder: (ctx, i) {
          // "Your Story" cell
          if (showYourStory && i == 0) {
            return _buildYourStoryCell(context);
          }
          final storyIndex = showYourStory ? i - 1 : i;
          return _buildStoryCell(context, stories[storyIndex], storyIndex);
        },
      ),
    );
  }

  /// "Your Story" cell with a + badge for creating a new story
  Widget _buildYourStoryCell(BuildContext context) {
    return GestureDetector(
      onTap: onAddStory ?? () {},
      child: Container(
        width: 78,
        margin: const EdgeInsets.only(right: 14),
        child: Column(
          children: [
            // Avatar with + badge
            SizedBox(
              width: _avatarSize,
              height: _avatarSize,
              child: Stack(
                children: [
                  // Avatar ring (gray, no gradient for own story)
                  Container(
                    width: _avatarSize,
                    height: _avatarSize,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: AppColors.border2,
                        width: _ringWidth,
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(3),
                      child: CircleAvatar(
                        backgroundColor: AppColors.card,
                        child: const Icon(
                          Icons.person,
                          color: AppColors.text2,
                          size: 28,
                        ),
                      ),
                    ),
                  ),
                  // + badge
                  Positioned(
                    bottom: 0,
                    right: 0,
                    child: Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.primary,
                        border: Border.all(
                          color: AppColors.bg,
                          width: 2,
                        ),
                      ),
                      child: const Icon(
                        Icons.add,
                        color: Colors.white,
                        size: 16,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Your Story',
              style: TextStyle(
                fontSize: 11,
                color: AppColors.text2,
                fontWeight: FontWeight.w500,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  /// Individual story cell with gradient avatar ring
  Widget _buildStoryCell(BuildContext context, Map<String, dynamic> story, int index) {
    final seen = story['seen'] as bool? ?? false;
    final avatarUrl = story['avatarUrl'] as String?;
    final name = story['name'] as String? ?? '';
    final initial = story['initial'] as String? ?? '?';
    final id = story['id'] as String?;

    return GestureDetector(
      onTap: () {
        if (id != null) {
          Navigator.pushNamed(
            context,
            '/story',
            arguments: id,
          );
        }
      },
      child: Container(
        width: 78,
        margin: const EdgeInsets.only(right: 14),
        child: Column(
          children: [
            // Gradient-ring avatar
            Container(
              width: _avatarSize,
              height: _avatarSize,
              padding: const EdgeInsets.all(_ringWidth),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: seen ? _seenGradient : _unseenGradient,
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.card,
                  border: Border.all(color: AppColors.bg2, width: 2),
                ),
                child: ClipOval(
                  child: avatarUrl != null && avatarUrl.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: avatarUrl,
                          fit: BoxFit.cover,
                          width: _avatarSize - _ringWidth * 2 - 4,
                          height: _avatarSize - _ringWidth * 2 - 4,
                          placeholder: (_, __) => Center(
                            child: Text(
                              initial,
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                                color: AppColors.accent,
                                fontFamily: 'Space Grotesk',
                              ),
                            ),
                          ),
                          errorWidget: (_, __, ___) => Center(
                            child: Text(
                              initial,
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                                color: AppColors.accent,
                                fontFamily: 'Space Grotesk',
                              ),
                            ),
                          ),
                        )
                      : Center(
                          child: Text(
                            initial,
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                              color: AppColors.accent,
                              fontFamily: 'Space Grotesk',
                            ),
                          ),
                        ),
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              name,
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.text2,
                fontWeight: FontWeight.w500,
              ),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
          ],
        ),
      ),
    );
  }
}