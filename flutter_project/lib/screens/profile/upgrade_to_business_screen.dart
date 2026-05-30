import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';

/// Multi-step business upgrade wizard.
class UpgradeToBusinessScreen extends StatefulWidget {
  const UpgradeToBusinessScreen({super.key});

  @override
  State<UpgradeToBusinessScreen> createState() => _UpgradeToBusinessScreenState();
}

class _UpgradeToBusinessScreenState extends State<UpgradeToBusinessScreen> {
  int _step = 0;
  final ApiService _api = ApiService();
  bool _submitting = false;
  String? _error;
  String? _success;

  // Step 0: Business info
  final _businessNameCtrl = TextEditingController();
  final _categoryCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();

  // Step 1: Documents
  final _licenseCtrl = TextEditingController();
  final _insuranceCtrl = TextEditingController();

  @override
  void dispose() {
    _businessNameCtrl.dispose();
    _categoryCtrl.dispose();
    _descriptionCtrl.dispose();
    _licenseCtrl.dispose();
    _insuranceCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final body = <String, dynamic>{
        'businessName': _businessNameCtrl.text.trim(),
        'category': _categoryCtrl.text.trim(),
        'description': _descriptionCtrl.text.trim(),
      };
      if (_licenseCtrl.text.trim().isNotEmpty) {
        body['license'] = _licenseCtrl.text.trim();
      }
      if (_insuranceCtrl.text.trim().isNotEmpty) {
        body['insurance'] = _insuranceCtrl.text.trim();
      }

      await _api.upgradeToBusiness(body);
      setState(() {
        _success = 'Congratulations! Your business account has been created.';
        _submitting = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to upgrade. Please ensure your KYC is verified.';
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.bg : AppColorsLight.bg;
    final text = isDark ? AppColors.text : AppColorsLight.text;
    final text3 = isDark ? AppColors.text3 : AppColorsLight.text3;
    final border = isDark ? AppColors.border : AppColorsLight.border;

    return Container(
      color: bg,
      child: Column(children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(color: bg, border: Border(bottom: BorderSide(color: border))),
          child: Row(children: [
            GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Icon(Icons.arrow_back, size: 20, color: text3),
            ),
            const SizedBox(width: 12),
            Text('Upgrade to Business',
                style: TextStyle(fontFamily: 'Space Grotesk', fontSize: 16,
                    fontWeight: FontWeight.w600, color: text)),
          ]),
        ),
        Expanded(
          child: _success != null
              ? _buildSuccessScreen()
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(14),
                  child: Column(children: [
                    // Step indicator
                    Row(children: ['Business Info', 'Documents', 'Review'].asMap().entries.map((e) {
                      final active = e.key <= _step;
                      final current = e.key == _step;
                      return Expanded(
                        child: Column(children: [
                          Container(
                            width: 28, height: 28,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: current ? AppColors.primary : active ? AppColors.secondary : AppColors.bg3,
                            ),
                            child: Center(child: Text('${e.key + 1}',
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                                    color: active ? Colors.white : text3))),
                          ),
                          const SizedBox(height: 4),
                          Text(e.value, style: TextStyle(fontSize: 10,
                              color: active ? AppColors.text : text3)),
                        ]),
                      );
                    }).toList()),
                    const SizedBox(height: 24),
                    if (_step == 0) _buildStep1(),
                    if (_step == 1) _buildStep2(),
                    if (_step == 2) _buildStep3(),
                    if (_error != null)
                      Container(
                        margin: const EdgeInsets.only(top: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.red.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(children: [
                          const Icon(Icons.warning, size: 16, color: AppColors.red),
                          const SizedBox(width: 8),
                          Expanded(child: Text(_error!, style: const TextStyle(fontSize: 12, color: AppColors.red))),
                        ]),
                      ),
                    const SizedBox(height: 20),
                    Row(children: [
                      if (_step > 0)
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => setState(() => _step--),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.text2,
                              side: const BorderSide(color: AppColors.border),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                            child: const Text('Back'),
                          ),
                        ),
                      if (_step > 0) const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: _step < 2
                              ? () => setState(() => _step++)
                              : _submit,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: _step < 2
                              ? const Text('Next')
                              : _submitting
                                  ? const SizedBox(width: 20, height: 20,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                  : const Text('Submit'),
                        ),
                      ),
                    ]),
                  ]),
                ),
        ),
      ]),
    );
  }

  Widget _buildSuccessScreen() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 72, height: 72,
            decoration: BoxDecoration(
              color: AppColors.secondary.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_circle, size: 40, color: AppColors.secondary),
          ),
          const SizedBox(height: 16),
          Text(_success!,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600,
                  color: AppColors.text, fontFamily: 'Space Grotesk'),
              textAlign: TextAlign.center),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pushReplacementNamed(context, '/dashboard');
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
            ),
            child: const Text('Go to Dashboard'),
          ),
        ]),
      ),
    );
  }

  Widget _buildStep1() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Business Information',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.text,
              fontFamily: 'Space Grotesk')),
      const SizedBox(height: 4),
      const Text('Tell us about your business',
          style: TextStyle(fontSize: 12, color: AppColors.text3)),
      const SizedBox(height: 16),
      _field('Business Name', _businessNameCtrl, 'e.g. AutoFix Vaughan'),
      const SizedBox(height: 12),
      _field('Category', _categoryCtrl, 'e.g. Auto Repair, Beauty, Plumbing'),
      const SizedBox(height: 12),
      _field('Description', _descriptionCtrl, 'Brief description of your services', maxLines: 3),
    ]);
  }

  Widget _buildStep2() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Verification Documents',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.text,
              fontFamily: 'Space Grotesk')),
      const SizedBox(height: 4),
      const Text('Optional — add later from your dashboard',
          style: TextStyle(fontSize: 12, color: AppColors.text3)),
      const SizedBox(height: 16),
      _field('License Number', _licenseCtrl, 'e.g. ON-7823-AUTO'),
      const SizedBox(height: 12),
      _field('Insurance Policy #', _insuranceCtrl, 'e.g. INS-2024-001'),
    ]);
  }

  Widget _buildStep3() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Review',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.text,
              fontFamily: 'Space Grotesk')),
      const SizedBox(height: 16),
      _reviewRow('Business Name', _businessNameCtrl.text),
      _reviewRow('Category', _categoryCtrl.text),
      _reviewRow('Description', _descriptionCtrl.text),
      if (_licenseCtrl.text.isNotEmpty) _reviewRow('License', _licenseCtrl.text),
      if (_insuranceCtrl.text.isNotEmpty) _reviewRow('Insurance', _insuranceCtrl.text),
    ]);
  }

  Widget _field(String label, TextEditingController ctrl, String hint, {int maxLines = 1}) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontSize: 12, color: AppColors.text2)),
      const SizedBox(height: 6),
      Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(10),
        ),
        child: TextField(
          controller: ctrl,
          maxLines: maxLines,
          style: const TextStyle(fontSize: 14, color: AppColors.text),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: AppColors.text3, fontSize: 14),
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),
      ),
    ]);
  }

  Widget _reviewRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(children: [
        SizedBox(width: 100, child: Text(label,
            style: const TextStyle(fontSize: 12, color: AppColors.text3))),
        Expanded(child: Text(value.isNotEmpty ? value : '—',
            style: const TextStyle(fontSize: 13, color: AppColors.text))),
      ]),
    );
  }
}