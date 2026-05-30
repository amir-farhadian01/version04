import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../cache/cache_manager.dart';
import '../providers/cache_provider.dart';

/// Small badge that shows whether the current data was served from cache or
/// fetched fresh from the network.
class CacheStatusIndicator extends StatefulWidget {
  final CacheSource source;

  const CacheStatusIndicator({super.key, required this.source});

  @override
  State<CacheStatusIndicator> createState() => _CacheStatusIndicatorState();
}

class _CacheStatusIndicatorState extends State<CacheStatusIndicator> {
  String get _label {
    switch (widget.source) {
      case CacheSource.memory:
        return '⚡ Instant';
      case CacheSource.disk:
        return '💾 Local';
      case CacheSource.network:
        return '🌐 Fresh';
    }
  }

  Color get _color {
    switch (widget.source) {
      case CacheSource.memory:
        return Colors.greenAccent;
      case CacheSource.disk:
        return Colors.amber;
      case CacheSource.network:
        return Colors.cyanAccent;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        _label,
        style: TextStyle(fontSize: 9, color: _color, fontWeight: FontWeight.w600),
      ),
    );
  }
}

/// Dialog that shows current cache stats and offers a one-tap purge.
class CacheStatsDialog extends StatelessWidget {
  const CacheStatsDialog({super.key});

  @override
  Widget build(BuildContext context) {
    final cache = context.read<CacheProvider>().manager;

    return FutureBuilder<int>(
      future: cache.diskRowCount(),
      builder: (ctx, snapshot) {
        final diskRows = snapshot.data ?? 0;
        return AlertDialog(
          title: const Text('Cache Management'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _statRow('In-memory entries', cache.memoryEntryCount.toString()),
              const SizedBox(height: 8),
              _statRow('Disk rows', diskRows.toString()),
              const SizedBox(height: 16),
              const Text(
                'Clearing the cache frees storage and forces fresh data fetch on next visit.',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton.icon(
              onPressed: () async {
                await cache.clearAll();
                if (context.mounted) Navigator.pop(context);
              },
              icon: const Icon(Icons.delete_outline, size: 18),
              label: const Text('Clear All Cache'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.redAccent,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _statRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 13)),
        Text(value,
            style: const TextStyle(
                fontSize: 13, fontWeight: FontWeight.w600)),
      ],
    );
  }
}