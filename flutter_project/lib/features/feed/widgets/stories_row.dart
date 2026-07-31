import 'package:flutter/material.dart';
import '../../../theme/app_theme.dart';

/// Horizontal stories row with gradient-ring avatars.
/// Shows story authors from the API; tapping navigates to /explorer/story.
class StoriesRow extends StatelessWidget {
  final List<Map<String, dynamic>> stories;

  const StoriesRow({super.key, required this.stories});

  @override
  Widget build(BuildContext context) {
    if (stories.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      height: 90,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
        itemCount: stories.length,
        itemBuilder: (ctx, i) {
          final s = stories[i];
          final seen = s['seen'] as bool? ?? false;
          return GestureDetector(
            onTap: () => Navigator.pushNamed(
              context,
              '/explorer/story',
              arguments: s['id'],
            ),
            child: Container(
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
                      gradient: seen
                          ? null
                          : const LinearGradient(
                              colors: [AppColors.primary, AppColors.accent],
                            ),
                      color: seen ? AppColors.border2 : null,
                    ),
                    child: Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.card,
                        border: Border.all(color: AppColors.bg2, width: 2),
                      ),
                      child: Center(
                        child: Text(
                          s['initial'] as String? ?? '?',
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
                  const SizedBox(height: 6),
                  Text(
                    s['name'] as String? ?? '',
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
        },
      ),
    );
  }
}
