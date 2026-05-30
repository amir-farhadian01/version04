import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';

/// Shared configuration for all cached network images across the app.
///
/// ⚠️ DO NOT use [DefaultCacheManager] directly — call [ImageCacheConfig.manager].
abstract final class ImageCacheConfig {
  ImageCacheConfig._();

  static CacheManager? _instance;

  /// Returns the singleton [CacheManager] used for all cached images.
  static CacheManager get manager {
    _instance ??= CacheManager(
      Config(
        'neighborly_images',
        stalePeriod: const Duration(days: 7),
        maxNrOfCacheObjects: 5000,
        repo: JsonCacheInfoRepository(databaseName: 'neighborly_images'),
        fileService: HttpFileService(),
      ),
    );
    return _instance!;
  }

  /// Placeholder shown while an image is loading.
  static Widget get placeholder => const _LoadingPlaceholder();

  /// Widget shown when the image fails to load.
  static Widget get errorWidget => const _ErrorPlaceholder();

  /// Fetch an image at its original size *and* cache it.
  static ImageProvider provider(String url) =>
      CachedNetworkImageProvider(url, cacheManager: manager);

  /// Flush every cached image from disk.
  static Future<void> clearAll() async {
    await manager.emptyCache();
  }
}

class _LoadingPlaceholder extends StatelessWidget {
  const _LoadingPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF0F0F0),
      alignment: Alignment.center,
      child: const SizedBox(
        width: 24,
        height: 24,
        child: CircularProgressIndicator(strokeWidth: 2.0),
      ),
    );
  }
}

class _ErrorPlaceholder extends StatelessWidget {
  const _ErrorPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF0F0F0),
      alignment: Alignment.center,
      child: const Icon(Icons.broken_image, color: Color(0xFFBDBDBD)),
    );
  }
}