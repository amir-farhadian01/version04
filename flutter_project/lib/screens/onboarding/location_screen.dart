import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

/// Onboarding Screen 2: Location setup.
/// Asks for location permission and shows address input.
class LocationScreen extends StatefulWidget {
  final void Function(double lat, double lng, String address) onLocationSet;

  const LocationScreen({
    super.key,
    required this.onLocationSet,
  });

  @override
  State<LocationScreen> createState() => _LocationScreenState();
}

class _LocationScreenState extends State<LocationScreen> {
  final TextEditingController _addressController = TextEditingController();
  bool _isLoadingLocation = false;
  bool _locationSet = false;
  String? _error;

  @override
  void dispose() {
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _useCurrentLocation() async {
    setState(() {
      _isLoadingLocation = true;
      _error = null;
    });

    try {
      // In real app, use geolocator package already in pubspec.yaml
      // For now, simulate location detection with a default Toronto coordinate
      // and let user manually enter/confirm address
      //
      // When geolocator is fully wired:
      //   Position position = await Geolocator.getCurrentPosition();
      //   List<Placemark> placemarks = await placemarkFromCoordinates(position.latitude, position.longitude);
      //   final address = '${placemarks.first.street}, ${placemarks.first.locality}';
      //
      // For now we'll just use the manual address field with a placeholder location
      await Future.delayed(const Duration(seconds: 1)); // Simulate GPS fetch

      if (!mounted) return;

      // Default to Toronto downtown coordinates
      const lat = 43.6532;
      const lng = -79.3832;

      setState(() {
        _isLoadingLocation = false;
        _locationSet = true;
        if (_addressController.text.isEmpty) {
          _addressController.text = 'Toronto, ON';
        }
      });

      final address = _addressController.text.trim();
      if (address.isNotEmpty) {
        widget.onLocationSet(lat, lng, address);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoadingLocation = false;
        _error = 'Could not detect location. Please enter manually.';
      });
    }
  }

  void _onAddressChanged(String value) {
    setState(() {
      _locationSet = value.trim().isNotEmpty;
    });
    if (value.trim().isNotEmpty) {
      // Toronto coordinates as default
      widget.onLocationSet(43.6532, -79.3832, value.trim());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Where are you\nlocated?',
            style: TextStyle(
              fontFamily: 'Space Grotesk',
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: AppColors.text,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'We\'ll show you nearby services and providers.',
            style: TextStyle(fontSize: 14, color: AppColors.text2, height: 1.5),
          ),
          const SizedBox(height: 32),

          // Location map placeholder
          Container(
            height: 180,
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border2),
            ),
            child: Stack(
              children: [
                // Map placeholder with pin
                Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        _locationSet ? Icons.location_on : Icons.location_searching,
                        size: 48,
                        color: _locationSet ? AppColors.primary : AppColors.text3,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _locationSet
                            ? 'Location set'
                            : _isLoadingLocation
                                ? 'Detecting location...'
                                : 'Tap button below to detect',
                        style: TextStyle(
                          fontSize: 13,
                          color: _locationSet ? AppColors.secondary : AppColors.text2,
                        ),
                      ),
                    ],
                  ),
                ),
                if (_isLoadingLocation)
                  const Center(child: CircularProgressIndicator(color: AppColors.primary)),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Use current location button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton.icon(
              onPressed: _isLoadingLocation ? null : _useCurrentLocation,
              icon: const Icon(Icons.my_location, size: 20),
              label: const Text(
                'Use my current location',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Divider with "or"
          Row(
            children: [
              const Expanded(child: Divider(color: AppColors.border2)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text('or', style: TextStyle(color: AppColors.text3, fontSize: 13)),
              ),
              const Expanded(child: Divider(color: AppColors.border2)),
            ],
          ),
          const SizedBox(height: 16),

          // Manual address entry
          const Text(
            'ENTER ADDRESS MANUALLY',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.text2),
          ),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: AppColors.card,
              border: Border.all(color: AppColors.border2),
              borderRadius: BorderRadius.circular(12),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              controller: _addressController,
              onChanged: _onAddressChanged,
              style: const TextStyle(color: AppColors.text, fontSize: 15),
              decoration: const InputDecoration(
                hintText: '123 Main St, Toronto, ON',
                hintStyle: TextStyle(color: AppColors.text3),
                border: InputBorder.none,
                prefixIcon: Icon(Icons.location_on_outlined, color: AppColors.text3, size: 20),
              ),
            ),
          ),

          // Error
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                _error!,
                style: const TextStyle(color: AppColors.red, fontSize: 13),
              ),
            ),

          const Spacer(),

          // Privacy notice
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                const Icon(Icons.shield_outlined, color: AppColors.text3, size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Your location is only used to show nearby services. You can change it anytime in settings.',
                    style: TextStyle(fontSize: 12, color: AppColors.text3, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}