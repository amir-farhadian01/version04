import 'package:flutter/material.dart';
import '../services/api_service.dart';

/// A bottom sheet modal that allows a Prime business owner to
/// assign a matched order to an approved B2B network partner.

class B2BPartner {
  final String connectionId;
  final String type;
  final double? specialPrice;
  final String id;
  final String name;
  final String? logoUrl;
  final String? workspaceType;

  B2BPartner({
    required this.connectionId,
    required this.type,
    this.specialPrice,
    required this.id,
    required this.name,
    this.logoUrl,
    this.workspaceType,
  });

  factory B2BPartner.fromJson(Map<String, dynamic> json) {
    final partner = json['partner'] as Map<String, dynamic>? ?? {};
    return B2BPartner(
      connectionId: json['connectionId']?.toString() ?? '',
      type: json['type']?.toString() ?? 'contractor',
      specialPrice: json['specialPrice'] is num ? (json['specialPrice'] as num).toDouble() : null,
      id: partner['id']?.toString() ?? '',
      name: partner['name']?.toString() ?? 'Unknown',
      logoUrl: partner['logoUrl']?.toString(),
      workspaceType: partner['type']?.toString(),
    );
  }
}

class StaffMember {
  final String id;
  final String firstName;
  final String lastName;
  final String? avatarUrl;

  StaffMember({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.avatarUrl,
  });

  String get displayName => '$firstName $lastName'.trim();

  factory StaffMember.fromJson(Map<String, dynamic> json) {
    return StaffMember(
      id: json['id']?.toString() ?? '',
      firstName: json['firstName']?.toString() ?? '',
      lastName: json['lastName']?.toString() ?? '',
      avatarUrl: json['avatarUrl']?.toString(),
    );
  }
}

class SubcontractorAssignmentSheet extends StatefulWidget {
  final String workspaceId;
  final String orderId;
  final int? orderBudgetCents;
  final void Function(Map<String, dynamic> assignment)? onAssigned;

  const SubcontractorAssignmentSheet({
    super.key,
    required this.workspaceId,
    required this.orderId,
    this.orderBudgetCents,
    this.onAssigned,
  });

  static Future<Map<String, dynamic>?> show(
    BuildContext context, {
    required String workspaceId,
    required String orderId,
    int? orderBudgetCents,
  }) {
    return showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => SubcontractorAssignmentSheet(
        workspaceId: workspaceId,
        orderId: orderId,
        orderBudgetCents: orderBudgetCents,
      ),
    );
  }

  @override
  State<SubcontractorAssignmentSheet> createState() => _SubcontractorAssignmentSheetState();
}

class _SubcontractorAssignmentSheetState extends State<SubcontractorAssignmentSheet> {
  List<B2BPartner>? _partners;
  List<StaffMember>? _staff;

  B2BPartner? _selectedPartner;
  StaffMember? _selectedStaff;
  double _primeShare = 70;
  String _notes = '';

  bool _loadingPartners = true;
  bool _loadingStaff = false;
  bool _submitting = false;
  String? _error;
  String? _partnerError;
  String? _splitError;

  @override
  void initState() {
    super.initState();
    _loadPartners();
  }

  Future<void> _loadPartners() async {
    try {
      final response = await ApiService().get('/workspaces/${widget.workspaceId}/b2b-network');
      final items = (response['data'] as List<dynamic>?)
          ?.map((j) => B2BPartner.fromJson(j as Map<String, dynamic>))
          .toList() ?? [];
      if (mounted) {
        setState(() {
          _partners = items;
          _loadingPartners = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load B2B partners: $e';
          _loadingPartners = false;
        });
      }
    }
  }

  Future<void> _loadStaff(String workspaceId) async {
    setState(() {
      _loadingStaff = true;
      _staff = null;
      _selectedStaff = null;
    });
    try {
      final response = await ApiService().get('/workspaces/$workspaceId/members');
      final items = (response['data'] as List<dynamic>?)
          ?.map((j) => StaffMember.fromJson(j as Map<String, dynamic>))
          .toList() ?? [];
      if (mounted) {
        setState(() {
          _staff = items;
          _loadingStaff = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _staff = [];
          _loadingStaff = false;
        });
      }
    }
  }

  void _onSelectPartner(B2BPartner partner) {
    setState(() {
      _selectedPartner = partner;
      _partnerError = null;
    });
    _loadStaff(partner.id);
  }

  Future<void> _submit() async {
    if (_selectedPartner == null) {
      setState(() => _partnerError = 'Please select a B2B partner');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final body = {
        'subWorkspaceId': _selectedPartner!.id,
        'primeSharePercent': _primeShare,
        'subSharePercent': 100 - _primeShare,
        if (_selectedStaff != null) 'assignedStaffId': _selectedStaff!.id,
        if (_notes.isNotEmpty) 'notes': _notes,
      };

      final response = await ApiService().post(
        '/workspaces/${widget.workspaceId}/orders/${widget.orderId}/subcontract',
        body: body,
      );
      final data = response['data'] as Map<String, dynamic>?;

      if (mounted) {
        widget.onAssigned?.call(data ?? body);
        Navigator.of(context).pop(data);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to assign: ${e.toString()}';
          _submitting = false;
        });
      }
    }
  }

  String _formatCents(int? cents) {
    if (cents == null) return '';
    return '\$${(cents / 100).toStringAsFixed(2)}';
  }

  Widget _buildBudgetPreview() {
    if (widget.orderBudgetCents == null) return const SizedBox.shrink();
    final budget = widget.orderBudgetCents!;
    final primeAmount = (budget * _primeShare / 100).round();
    final subAmount = (budget * (100 - _primeShare) / 100).round();

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.blue.shade100),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildShareItem('You (${_primeShare.toInt()}%)', _formatCents(primeAmount), Colors.green),
          const Icon(Icons.arrow_forward, size: 16, color: Colors.grey),
          _buildShareItem('Sub (${(100 - _primeShare).toInt()}%)', _formatCents(subAmount), Colors.blue),
        ],
      ),
    );
  }

  Widget _buildShareItem(String label, String amount, Color color) {
    return Column(
      children: [
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
        const SizedBox(height: 2),
        Text(amount, style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: color)),
      ],
    );
  }

  Widget _buildSectionHeader(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, top: 4),
      child: Text(
        text,
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.indigo),
      ),
    );
  }

  Widget _buildEmptyState(String text) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Center(
        child: Text(text, style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
      ),
    );
  }

  Widget _buildPartnerCard(B2BPartner partner) {
    final isSelected = _selectedPartner?.id == partner.id;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isSelected ? Colors.indigo : Colors.grey.shade200,
          width: isSelected ? 2 : 1,
        ),
      ),
      elevation: 0,
      color: isSelected ? Colors.indigo.shade50 : Colors.white,
      child: InkWell(
        onTap: () => _onSelectPartner(partner),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: Colors.indigo.shade100,
                backgroundImage: partner.logoUrl != null && partner.logoUrl!.isNotEmpty
                    ? NetworkImage(partner.logoUrl!)
                    : null,
                child: partner.logoUrl == null || partner.logoUrl!.isEmpty
                    ? Text(partner.name.isNotEmpty ? partner.name[0].toUpperCase() : '?',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.indigo))
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(partner.name,
                        style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14,
                            color: isSelected ? Colors.indigo.shade900 : Colors.grey.shade800)),
                    const SizedBox(height: 2),
                    Text(partner.workspaceType ?? partner.type,
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                  ],
                ),
              ),
              if (isSelected) const Icon(Icons.check_circle, color: Colors.indigo, size: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSplitSlider() {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Prime: ${_primeShare.toInt()}%', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            Text('Sub: ${(100 - _primeShare).toInt()}%', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Colors.blue.shade700)),
          ],
        ),
        Slider(
          value: _primeShare,
          min: 10,
          max: 90,
          divisions: 80,
          label: '${_primeShare.toInt()}%',
          onChanged: (v) {
            setState(() {
              _primeShare = v.roundToDouble();
              _splitError = null;
            });
          },
          activeColor: Colors.indigo,
          inactiveColor: Colors.indigo.shade100,
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('10%', style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
            Text('50%', style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
            Text('90%', style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
          ],
        ),
      ],
    );
  }

  Widget _buildStaffDropdown() {
    if (_staff == null || _staff!.isEmpty) return const SizedBox.shrink();
    return DropdownButtonFormField<String>(
      value: _selectedStaff?.id,
      isExpanded: true,
      hint: const Text('Select staff member'),
      decoration: InputDecoration(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        isDense: true,
      ),
      items: _staff!.map((s) => DropdownMenuItem(
        value: s.id,
        child: Row(
          children: [
            CircleAvatar(
              radius: 14,
              backgroundImage: s.avatarUrl != null && s.avatarUrl!.isNotEmpty
                  ? NetworkImage(s.avatarUrl!)
                  : null,
              child: s.avatarUrl == null || s.avatarUrl!.isEmpty
                  ? Text(s.firstName.isNotEmpty ? s.firstName[0] : 'S',
                      style: const TextStyle(fontSize: 10))
                  : null,
            ),
            const SizedBox(width: 8),
            Text(s.displayName, style: const TextStyle(fontSize: 14)),
          ],
        ),
      )).toList(),
      onChanged: (v) {
        setState(() {
          _selectedStaff = _staff!.firstWhere((s) => s.id == v);
        });
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final partnerWidgets = _partners != null && _partners!.isNotEmpty
        ? _partners!.map((p) => _buildPartnerCard(p)).toList()
        : <Widget>[];

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Title
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Row(
              children: [
                const Icon(Icons.people_alt_outlined, size: 24, color: Colors.indigo),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'Assign to Subcontractor',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),

          // Error banner
          if (_error != null)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.red.shade200),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: Colors.red, size: 20),
                  const SizedBox(width: 8),
                  Expanded(child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13))),
                ],
              ),
            ),

          // Scrollable content
          Flexible(
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              children: [
                // Step 1: Select Partner
                _buildSectionHeader('1. Select B2B Partner'),
                if (_partnerError != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(_partnerError!, style: TextStyle(color: Colors.red.shade600, fontSize: 12)),
                  ),
                if (_loadingPartners)
                  const Center(child: CircularProgressIndicator())
                else if (_partners == null || _partners!.isEmpty)
                  _buildEmptyState('No approved B2B partners found.')
                else
                  ...partnerWidgets,

                const SizedBox(height: 20),

                // Step 2: Revenue Split
                _buildSectionHeader('2. Revenue Split'),
                if (_splitError != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(_splitError!, style: TextStyle(color: Colors.red.shade600, fontSize: 12)),
                  ),
                _buildSplitSlider(),
                _buildBudgetPreview(),

                const SizedBox(height: 20),

                // Step 3: Assign Staff (optional)
                _buildSectionHeader('3. Assign Staff (optional)'),
                if (_selectedPartner == null)
                  Text('Select a partner first', style: TextStyle(fontSize: 13, color: Colors.grey.shade500))
                else if (_loadingStaff)
                  const Center(child: Padding(
                    padding: EdgeInsets.all(8),
                    child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                  ))
                else if (_staff == null || _staff!.isEmpty)
                  Text('No staff members in this workspace', style: TextStyle(fontSize: 13, color: Colors.grey.shade500))
                else
                  _buildStaffDropdown(),

                const SizedBox(height: 20),

                // Step 4: Notes
                _buildSectionHeader('4. Notes (optional)'),
                TextField(
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText: 'Add any notes for the subcontractor...',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    contentPadding: const EdgeInsets.all(12),
                    isDense: true,
                  ),
                  onChanged: (v) => _notes = v,
                ),

                const SizedBox(height: 24),

                // Submit
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: _submitting ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.indigo,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      elevation: 0,
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Send Proposal', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}