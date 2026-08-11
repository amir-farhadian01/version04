import 'package:flutter/material.dart';
import '../services/api_service.dart';

/// Visual calendar/schedule view showing a staff member's availability
/// across all connected businesses. Fetches from GET /api/staff/:staffId/availability.
///
/// Displays a week view with color-coded time blocks per workspace.
/// Empty state shows "No scheduled blocks" with an illustration.
/// Responsive: week view on tablet, day view on phone.

class ScheduleBlock {
  final String id;
  final DateTime startAt;
  final DateTime endAt;
  final String? reason;
  final String? orderId;
  final String workspaceId;
  final String workspaceName;
  final String? workspaceLogoUrl;

  ScheduleBlock({
    required this.id,
    required this.startAt,
    required this.endAt,
    this.reason,
    this.orderId,
    required this.workspaceId,
    required this.workspaceName,
    this.workspaceLogoUrl,
  });
}

class StaffWorkspace {
  final String id;
  final String name;
  final String? logoUrl;
  final String role;

  StaffWorkspace({
    required this.id,
    required this.name,
    this.logoUrl,
    required this.role,
  });
}

class MultiWorkspaceScheduleWidget extends StatefulWidget {
  final String staffId;
  final String? staffName;
  final DateTime? initialFrom;
  final DateTime? initialTo;

  const MultiWorkspaceScheduleWidget({
    super.key,
    required this.staffId,
    this.staffName,
    this.initialFrom,
    this.initialTo,
  });

  @override
  State<MultiWorkspaceScheduleWidget> createState() => _MultiWorkspaceScheduleWidgetState();
}

class _MultiWorkspaceScheduleWidgetState extends State<MultiWorkspaceScheduleWidget> {
  List<ScheduleBlock> _blocks = [];
  List<StaffWorkspace> _workspaces = [];
  bool _loading = true;
  String? _error;

  late DateTime _rangeStart;
  late DateTime _rangeEnd;
  int _viewMode = 0; // 0 = week, 1 = day

  static const _workspaceColors = [
    Color(0xFF6366F1), // indigo
    Color(0xFF8B5CF6), // violet
    Color(0xFF06B6D4), // cyan
    Color(0xFF10B981), // emerald
    Color(0xFFF59E0B), // amber
    Color(0xFFEF4444), // red
    Color(0xFFEC4899), // pink
    Color(0xFF14B8A6), // teal
  ];

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _rangeStart = widget.initialFrom ?? DateTime(now.year, now.month, now.day).subtract(const Duration(days: 1));
    _rangeEnd = widget.initialTo ?? _rangeStart.add(const Duration(days: 7));
    _loadSchedule();
  }

  Future<void> _loadSchedule() async {
    setState(() { _loading = true; _error = null; });
    try {
      final from = _rangeStart.toUtc().toIso8601String();
      final to = _rangeEnd.toUtc().toIso8601String();
      final response = await ApiService().get('/staff/${widget.staffId}/availability?from=$from&to=$to');
      final data = response['data'] as Map<String, dynamic>?;

      if (mounted) {
        final rawBlocks = (data?['blockedSlots'] as List<dynamic>?) ?? [];
        final rawWorkspaces = (data?['workspaces'] as List<dynamic>?) ?? [];

        setState(() {
          _blocks = rawBlocks.map((b) {
            final ws = (b as Map<String, dynamic>)['workspace'] as Map<String, dynamic>? ?? {};
            return ScheduleBlock(
              id: b['id']?.toString() ?? '',
              startAt: DateTime.parse(b['startAt'].toString()),
              endAt: DateTime.parse(b['endAt'].toString()),
              reason: b['reason']?.toString(),
              orderId: b['orderId']?.toString(),
              workspaceId: ws['id']?.toString() ?? '',
              workspaceName: ws['name']?.toString() ?? 'Unknown',
              workspaceLogoUrl: ws['logoUrl']?.toString(),
            );
          }).toList();

          _workspaces = rawWorkspaces.map((w) {
            final c = (w as Map<String, dynamic>)['company'] as Map<String, dynamic>? ?? {};
            return StaffWorkspace(
              id: w['id']?.toString() ?? c['id']?.toString() ?? '',
              name: c['name']?.toString() ?? w['name']?.toString() ?? 'Unknown',
              logoUrl: c['logoUrl']?.toString(),
              role: w['role']?.toString() ?? '',
            );
          }).toList();

          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load schedule: $e';
          _loading = false;
        });
      }
    }
  }

  Color _colorForWorkspace(String id) {
    final index = _workspaces.indexWhere((w) => w.id == id);
    return _workspaceColors[index % _workspaceColors.length];
  }

  void _navigateWeek(int delta) {
    setState(() {
      _rangeStart = _rangeStart.add(Duration(days: 7 * delta));
      _rangeEnd = _rangeEnd.add(Duration(days: 7 * delta));
    });
    _loadSchedule();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header with navigation
        _buildHeader(),

        const SizedBox(height: 12),

        // Legend
        if (_workspaces.isNotEmpty) _buildLegend(),

        const SizedBox(height: 12),

        // Schedule content
        if (_loading)
          const Center(child: Padding(
            padding: EdgeInsets.all(40),
            child: CircularProgressIndicator(),
          ))
        else if (_error != null)
          _buildErrorState()
        else if (_blocks.isEmpty)
          _buildEmptyState()
        else
          _viewMode == 0 ? _buildWeekView() : _buildDayView(),
      ],
    );
  }

  Widget _buildHeader() {
    final dayRange = _rangeStart.add(const Duration(days: 1));
    final endDisplay = _rangeEnd.subtract(const Duration(days: 1));
    final rangeText =
        '${_formatShortDate(dayRange)} — ${_formatShortDate(endDisplay)}';

    return Row(
      children: [
        // Navigation arrows
        IconButton(
          onPressed: () => _navigateWeek(-1),
          icon: const Icon(Icons.chevron_left, size: 24),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
        ),
        Expanded(
          child: Text(
            rangeText,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
          ),
        ),
        IconButton(
          onPressed: () => _navigateWeek(1),
          icon: const Icon(Icons.chevron_right, size: 24),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
        ),
        // View mode toggle
        SegmentedButton<int>(
          segments: const [
            ButtonSegment(value: 0, label: Text('Week', style: TextStyle(fontSize: 12))),
            ButtonSegment(value: 1, label: Text('Day', style: TextStyle(fontSize: 12))),
          ],
          selected: {_viewMode},
          onSelectionChanged: (v) => setState(() => _viewMode = v.first),
          style: ButtonStyle(
            visualDensity: VisualDensity.compact,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        ),
      ],
    );
  }

  Widget _buildLegend() {
    return Wrap(
      spacing: 12,
      runSpacing: 6,
      children: _workspaces.map((w) {
        final color = _colorForWorkspace(w.id);
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: color.withOpacity(0.3)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              const SizedBox(width: 6),
              Text(w.name, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildWeekView() {
    // Build 7-day columns
    final days = List.generate(7, (i) => _rangeStart.add(Duration(days: i + 1)));

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: SizedBox(
        width: MediaQuery.of(context).size.width * 2.5, // wide enough for 7 days
        child: Column(
          children: [
            // Day headers
            Row(
              children: days.map((d) {
                final weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                return SizedBox(
                  width: (MediaQuery.of(context).size.width * 2.5) / 7,
                  child: Column(
                    children: [
                      Text(weekdays[d.weekday % 7],
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey.shade600)),
                      Text('${d.day}',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                    ],
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 8),
            // Time blocks (simplified: show blocks grouped by day)
            SizedBox(
              height: 300,
              child: Stack(
                children: _blocks.map((block) {
                  final dayIndex = block.startAt.difference(days.first).inDays;
                  if (dayIndex < 0 || dayIndex > 6) return const SizedBox.shrink();

                  final startHour = block.startAt.hour + block.startAt.minute / 60.0;
                  final endHour = block.endAt.hour + block.endAt.minute / 60.0;
                  final top = (startHour / 24) * 300;
                  final height = ((endHour - startHour) / 24 * 300).clamp(20.0, 300.0);
                  final color = _colorForWorkspace(block.workspaceId);
                  final cellWidth = (MediaQuery.of(context).size.width * 2.5) / 7;

                  return Positioned(
                    left: dayIndex * cellWidth + 4,
                    top: top,
                    width: cellWidth - 8,
                    height: height,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      decoration: BoxDecoration(
                        color: color.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                        border: Border(left: BorderSide(color: color, width: 3)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            block.workspaceName,
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            '${_formatTime(block.startAt)} - ${_formatTime(block.endAt)}',
                            style: TextStyle(fontSize: 9, color: Colors.grey.shade700),
                          ),
                          if (block.reason != null && block.reason!.isNotEmpty)
                            Text(
                              block.reason!,
                              style: TextStyle(fontSize: 8, color: Colors.grey.shade500),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDayView() {
    // Show today's or selected day blocks as a vertical timeline
    final today = DateTime.now();
    final todayBlocks = _blocks
        .where((b) =>
            b.startAt.year == today.year &&
            b.startAt.month == today.month &&
            b.startAt.day == today.day)
        .toList()
      ..sort((a, b) => a.startAt.compareTo(b.startAt));

    if (todayBlocks.isEmpty) {
      return _buildEmptyState();
    }

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: todayBlocks.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final block = todayBlocks[index];
        final color = _colorForWorkspace(block.workspaceId);
        final duration = block.endAt.difference(block.startAt);

        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: color.withOpacity(0.08),
            borderRadius: BorderRadius.circular(12),
            border: Border(left: BorderSide(color: color, width: 4)),
          ),
          child: Row(
            children: [
              // Time column
              SizedBox(
                width: 70,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _formatTime(block.startAt),
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                    ),
                    Text(
                      _formatTime(block.endAt),
                      style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _formatDuration(duration),
                      style: TextStyle(fontSize: 10, color: Colors.grey.shade400),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              // Details
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      block.workspaceName,
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: color),
                    ),
                    if (block.reason != null && block.reason!.isNotEmpty)
                      Text(
                        block.reason!,
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                      ),
                    if (block.orderId != null)
                      Text(
                        'Order: ${block.orderId!.substring(0, 8)}...',
                        style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                      ),
                  ],
                ),
              ),
              Icon(Icons.schedule, size: 18, color: Colors.grey.shade400),
            ],
          ),
        );
      },
    );
  }

  Widget _buildEmptyState() {
    return Container(
      padding: const EdgeInsets.all(40),
      child: Column(
        children: [
          Icon(Icons.event_available, size: 64, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          Text(
            'No scheduled blocks',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.grey.shade500),
          ),
          const SizedBox(height: 4),
          Text(
            'This staff member has full availability',
            style: TextStyle(fontSize: 13, color: Colors.grey.shade400),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    return Container(
      padding: const EdgeInsets.all(40),
      child: Column(
        children: [
          const Icon(Icons.error_outline, size: 48, color: Colors.red),
          const SizedBox(height: 12),
          Text(_error!, style: const TextStyle(color: Colors.red), textAlign: TextAlign.center),
          const SizedBox(height: 12),
          ElevatedButton(onPressed: _loadSchedule, child: const Text('Retry')),
        ],
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final local = dt.toLocal();
    return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }

  String _formatShortDate(DateTime dt) {
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[dt.month - 1]} ${dt.day}';
  }

  String _formatDuration(Duration d) {
    final hours = d.inHours;
    final minutes = d.inMinutes.remainder(60);
    if (hours > 0 && minutes > 0) return '${hours}h ${minutes}m';
    if (hours > 0) return '${hours}h';
    return '${minutes}m';
  }
}