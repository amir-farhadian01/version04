import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import '../../services/api_service.dart';

class KycVerificationScreen extends StatefulWidget {
  const KycVerificationScreen({super.key, this.api});

  final KycVerificationApi? api;

  @override
  State<KycVerificationScreen> createState() => _KycVerificationScreenState();
}

class _KycVerificationScreenState extends State<KycVerificationScreen> {
  late final KycVerificationApi _api;
  final _picker = ImagePicker();
  final _emailToken = TextEditingController();
  final _phoneCode = TextEditingController();
  final _legalName = TextEditingController();
  final _documentNumber = TextEditingController();
  final _line1 = TextEditingController();
  final _line2 = TextEditingController();
  final _city = TextEditingController();
  final _province = TextEditingController();
  final _postalCode = TextEditingController();
  String _documentType = 'national_id';
  bool _emailVerified = false;
  bool _phoneVerified = false;
  Map<String, dynamic>? _level2Submission;
  bool _canSubmitLevel2 = false;
  bool _busy = true;
  XFile? _front;
  XFile? _back;
  XFile? _selfie;
  String? _error;
  String? _message;

  @override
  void initState() {
    super.initState();
    _api = widget.api ?? ApiService();
    _refresh();
  }

  @override
  void dispose() {
    for (final c in [
      _emailToken,
      _phoneCode,
      _legalName,
      _documentNumber,
      _line1,
      _line2,
      _city,
      _province,
      _postalCode,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final responses = await Future.wait(<Future<Map<String, dynamic>>>[
        _api.getKycLevel1(),
        _api.getKycLevel2(),
      ]);
      final level1 = responses[0];
      final level2 = responses[1];
      final submission = level2['submission'];
      if (!mounted) return;
      setState(() {
        _emailVerified = level1['emailVerified'] == true;
        _phoneVerified = level1['phoneVerified'] == true;
        _level2Submission = submission is Map
            ? Map<String, dynamic>.from(submission)
            : null;
        _canSubmitLevel2 = level2['canSubmit'] == true;
        _busy = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _busy = false;
        });
      }
    }
  }

  Future<void> _run(Future<void> Function() action, String success) async {
    setState(() {
      _busy = true;
      _error = null;
      _message = null;
    });
    try {
      await action();
      if (!mounted) return;
      setState(() => _message = success);
      await _refresh();
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _busy = false;
        });
      }
    }
  }

  Future<void> _submitLevel2() async {
    if (!_canSubmitLevel2) {
      setState(() {
        _error = 'This Level 2 submission is currently under review.';
      });
      return;
    }
    if (_front == null ||
        _selfie == null ||
        (_documentType == 'national_id' && _back == null)) {
      setState(() => _error = 'Required identity images are missing.');
      return;
    }
    await _run(
      () async {
        final front = await _uploadKycDocument(_front!);
        final selfie = await _uploadKycDocument(_selfie!);
        final back = _back == null ? null : await _uploadKycDocument(_back!);
        final body = <String, dynamic>{
          'declaredLegalName': _legalName.text.trim(),
          'idDocumentType': _documentType,
          'idDocumentNumber': _documentNumber.text.trim(),
          'idFrontUrl': front,
          'idBackUrl': back,
          'selfieUrl': selfie,
          'address': {
            'line1': _line1.text.trim(),
            'line2': _line2.text.trim(),
            'city': _city.text.trim(),
            'province': _province.text.trim().toUpperCase(),
            'postalCode': _postalCode.text.trim().toUpperCase(),
            'country': 'CA',
          },
        };
        if (_requiresLevel2Resubmission) {
          await _api.resubmitKycLevel2(body);
        } else {
          await _api.submitKycLevel2(body);
        }
      },
      _requiresLevel2Resubmission
          ? 'Level 2 resubmitted for administrator review.'
          : 'Level 2 submitted for administrator review.',
    );
  }

  Future<String> _uploadKycDocument(XFile file) async =>
      _api.uploadKycDocumentBytes(file.name, await file.readAsBytes());

  String? get _level2Status => _level2Submission?['status'] as String?;

  bool get _requiresLevel2Resubmission =>
      _level2Status == 'rejected' || _level2Status == 'resubmit_requested';

  bool get _canEditLevel2 =>
      !_busy && _emailVerified && _phoneVerified && _canSubmitLevel2;

  InputDecoration _dec(String label) =>
      InputDecoration(labelText: label, border: const OutlineInputBorder());
  Widget _pick(
    String label,
    XFile? file,
    void Function(XFile) save, {
    ImageSource source = ImageSource.gallery,
  }) => OutlinedButton.icon(
    onPressed: !_canEditLevel2
        ? null
        : () async {
            final picked = await _picker.pickImage(
              source: source,
              imageQuality: 85,
            );
            if (picked != null) setState(() => save(picked));
          },
    icon: Icon(file == null ? Icons.upload_file : Icons.check_circle),
    label: Text(file?.name ?? label),
  );

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Identity verification')),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_error != null)
          Semantics(
            liveRegion: true,
            child: Card(
              color: Theme.of(context).colorScheme.errorContainer,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Text(_error!),
              ),
            ),
          ),
        if (_message != null)
          Semantics(
            liveRegion: true,
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Text(_message!),
              ),
            ),
          ),
        Text(
          'Level 1 · Email and phone',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 8),
        Text(
          'Email: ${_emailVerified ? 'Verified' : 'Not verified'} · Phone: ${_phoneVerified ? 'Verified' : 'Not verified'}',
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            FilledButton(
              onPressed: _busy || _emailVerified
                  ? null
                  : () => _run(() async {
                      await _api.startKycEmailVerification();
                    }, 'Verification email sent.'),
              child: const Text('Send email link'),
            ),
            FilledButton(
              onPressed: _busy || _phoneVerified
                  ? null
                  : () => _run(() async {
                      await _api.startKycPhoneVerification();
                    }, 'SMS code sent.'),
              child: const Text('Send SMS code'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _emailToken,
          onChanged: (_) => setState(() {}),
          decoration: _dec('Email token'),
        ),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: _busy || _emailToken.text.trim().isEmpty
              ? null
              : () => _run(() async {
                  await _api.confirmKycEmailVerification(
                    _emailToken.text.trim(),
                  );
                }, 'Email verified.'),
          child: const Text('Confirm email'),
        ),
        TextField(
          controller: _phoneCode,
          onChanged: (_) => setState(() {}),
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          maxLength: 6,
          decoration: _dec('Six-digit phone code'),
        ),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: _busy || _phoneCode.text.length != 6
              ? null
              : () => _run(() async {
                  await _api.confirmKycPhoneVerification(_phoneCode.text);
                }, 'Phone verified.'),
          child: const Text('Confirm phone'),
        ),
        const Divider(height: 40),
        Text(
          'Level 2 · Identity and Canadian address',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 12),
        if (_level2Submission != null)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Current status: ${_level2Status ?? 'unknown'}'),
                  if (_level2Submission?['reviewNote'] is String &&
                      (_level2Submission?['reviewNote'] as String).isNotEmpty)
                    Text('Reviewer note: ${_level2Submission?['reviewNote']}'),
                ],
              ),
            ),
          ),
        if (_level2Submission != null) const SizedBox(height: 8),
        TextField(
          controller: _legalName,
          enabled: _canEditLevel2,
          decoration: _dec('Legal name'),
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          initialValue: _documentType,
          decoration: _dec('Document type'),
          items: const [
            DropdownMenuItem(
              value: 'national_id',
              child: Text('Identity card'),
            ),
            DropdownMenuItem(value: 'passport', child: Text('Passport')),
            DropdownMenuItem(
              value: 'drivers_license',
              child: Text('Driver’s licence'),
            ),
          ],
          onChanged: !_canEditLevel2
              ? null
              : (v) => setState(() => _documentType = v ?? _documentType),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _documentNumber,
          enabled: _canEditLevel2,
          decoration: _dec('Document number'),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _line1,
          enabled: _canEditLevel2,
          decoration: _dec('Address line 1'),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _line2,
          enabled: _canEditLevel2,
          decoration: _dec('Address line 2'),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _city,
          enabled: _canEditLevel2,
          decoration: _dec('City'),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _province,
          enabled: _canEditLevel2,
          maxLength: 2,
          decoration: _dec('Province'),
        ),
        TextField(
          controller: _postalCode,
          enabled: _canEditLevel2,
          decoration: _dec('Postal code'),
        ),
        const SizedBox(height: 8),
        _pick('ID front', _front, (v) => _front = v),
        _pick('ID back', _back, (v) => _back = v),
        _pick(
          'Current selfie',
          _selfie,
          (v) => _selfie = v,
          source: ImageSource.camera,
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: _canEditLevel2 ? _submitLevel2 : null,
          child: Text(
            _busy
                ? 'Working…'
                : _requiresLevel2Resubmission
                ? 'Resubmit Level 2'
                : 'Submit Level 2',
          ),
        ),
      ],
    ),
  );
}
