import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../theme/app_theme.dart';
import '../../../cache/image_cache_config.dart';

/// Card widget for the Business Hub tab showing a single business/organization.
/// Tapping navigates to the business page.
class BusinessCard extends StatelessWidget {
  final Map<String, dynamic> business;

  const BusinessCard({super.key, required this.business});

  @override
  Widget build(BuildContext context) {
    final name = business['name'] as String? ?? 'Business';
    final avatarUrl = business['avatarUrl'] as String?;
    final slug = business['slug'] as String? ?? business['id'] as String? ?? '';

    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/business', arguments: slug),
      child: Container(
        width: 140,
        margin: const EdgeInsets.only(right: 12),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.accent.withValues(alpha: 0.15),
              ),
              child: avatarUrl != null
                  ? ClipOval(
                      child: CachedNetworkImage(
                        imageUrl: avatarUrl,
                        fit: BoxFit.cover,
                        cacheManager: ImageCacheConfig.manager,
                        errorWidget: (_, _, _) => Center(
                          child: Text(
                            name.characters.first.toUpperCase(),
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: AppColors.accent,
                              fontFamily: 'Space Grotesk',
                            ),
                          ),
                        ),
                      ),
                    )
                  : Center(
                      child: Text(
                        name.characters.first.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          color: AppColors.accent,
                          fontFamily: 'Space Grotesk',
                        ),
                      ),
                    ),
            ),
            const SizedBox(height: 8),
            Text(
              name,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.text,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            const Text(
              'View Profile',
              style: TextStyle(fontSize: 10, color: AppColors.primary),
            ),
          ],
        ),
      ),
    );
  }
}
