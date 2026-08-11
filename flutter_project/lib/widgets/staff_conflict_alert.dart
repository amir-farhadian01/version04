import 'package:flutter/material.dart';
import '../services/api_service.dart';

/// Displays a warning banner when a staff member has scheduling conflicts
/// across multiple workspaces. Fetches from GET /api/workspaces/:workspaceId/staff-conflicts.
///
/// Usage: Place in a workspace management screen or staff scheduling view.
/// Tap to expand and see conflict details, or tap staff name to open full schedule.

class StaffConflictAlert extends StatelessWidget {
  final String workspaceId;
  final void Function(String staffId, String staffName)? onViewSchedule;

  const StaffConflictAlert({
    super.key,
    required this.workspaceId,
    this.onViewSchedule,
  });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _fetchConflicts(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const SizedBox.shrink();
        }

        if (snapshot.hasError || snapshot.data == null) {
          return const SizedBox.shrink();
        }

        final data = snapshot.data!;
        final conflicts = (data['data'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ?? [];

        if (conflicts.isEmpty) return const SizedBox.shrink();

        return _ConflictBanner(
          conflicts: conflicts,
          onViewSchedule: onViewSchedule,
        );
      },
    );
  }

  Future<Map<String, dynamic>> _fetchConflicts() async {
    return await ApiService().get('/workspaces/$workspaceId/staff-conflicts');
  }
}

class _ConflictBanner extends StatefulWidget {
  final List<Map<String, dynamic>> conflicts;
  final void Function(String staffId, String staffName)? onViewSchedule;

  const _ConflictBanner({required this.conflicts, this.onViewSchedule});

  @override
  State<_ConflictBanner> createState() => _ConflictBannerState();
}

class _ConflictBannerState extends State<_ConflictBanner> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final totalConflicts = widget.conflicts.fold<int>(0, (sum, c) => sum + ((c['conflictCount'] as num?)?.toInt() ?? 0));

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.orange.shade200),
      ),
      child: Column(
        children: [
          // Header
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade100,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(Icons.warning_amber_rounded, size: 20, color: Colors.orange.shade800),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${widget.conflicts.length} staff with scheduling conflicts',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Colors.orange.shade900,
                          ),
                        ),
                        Text(
                          '$totalConflicts overlapping blocks this week',
                          style: TextStyle(fontSize: 12, color: Colors.orange.shade700),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    _expanded ? Icons.expand_less : Icons.expand_more,
                    color: Colors.orange.shade700,
                  ),
                ],
              ),
            ),
          ),

          // Expanded conflict list
          if (_expanded)
            Container(
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: Colors.orange.shade200)),
              ),
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: widget.conflicts.length,
                separatorBuilder: (_, __) => Divider(height: 1, indent: 16, endIndent: 16, color: Colors.orange.shade100),
                itemBuilder: (context, index) {
                  final c = widget.conflicts[index];
                  final staff = c['staff'] as Map<String, dynamic>? ?? {};
                  final staffId = staff['id']?.toString() ?? '';
                  final staffName = [
                    staff['firstName'],
                    staff['lastName'],
                  ].where((s) => s != null && s.toString().isNotEmpty).join(' ');
                  final conflictCount = (c['conflictCount'] as num?)?.toInt() ?? 0;
                  final nextConflict = c['nextConflict'] as Map<String, dynamic>?;

                  return ListTile(
                    dense: true,
                    leading: CircleAvatar(
                      radius: 16,
                      backgroundColor: Colors.orange.shade100,
                      backgroundImage: staff['avatarUrl'] != null && staff['avatarUrl'].toString().isNotEmpty
                          ? NetworkImage(staff['avatarUrl'].toString())
                          : null,
                      child: staff['avatarUrl'] == null
                          ? Text(
                              staff['firstName']?.toString().isNotEmpty == true
                                  ? staff['firstName'].toString()[0]
                                  : '?',
                              style: TextStyle(fontSize: 12, color: Colors.orange.shade700),
                            )
                          : null,
                    ),
                    title: Text(
                      staffName.isNotEmpty ? staffName : 'Unknown Staff',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    subtitle: nextConflict != null
                        ? Text(
                            _formatConflict(nextConflict),
                            style: TextStyle(fontSize: 11, color: Colors.orange.shade700),
                          )
                        : Text(
                            '$conflictCount blocks in other workspaces',
                            style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                          ),
                    trailing: TextButton(
                      onPressed: () => widget.onViewSchedule?.call(staffId, staffName),
                      child: const Text('View Schedule', style: TextStyle(fontSize: 12)),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

  String _formatConflict(Map<String, dynamic> conflict) {
    final workspace = conflict['workspace'] as Map<String, dynamic>?;
    final wsName = workspace?['name']?.toString() ?? 'Unknown';
    final startAt = conflict['startAt']?.toString();
    if (startAt == null) return 'In $wsName';
    try {
      final dt = DateTime.parse(startAt);
      final local = dt.toLocal();
      final weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      final day = weekdays[local.weekday % 7];
      final time = '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
      return '$day $time — $wsName';
    } catch (_) {
      return 'In $wsName';
    }
  }
}