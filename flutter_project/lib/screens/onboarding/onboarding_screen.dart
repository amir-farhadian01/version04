import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/auth_service.dart';
import 'interests_screen.dart';
import 'location_screen.dart';
import 'photo_screen.dart';

/// 3-screen onboarding wizard shown after first login.
/// Screen 1: Interests (≥3 categories)
/// Screen 2: Location
/// Screen 3: Profile photo (optional)
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  final int _totalPages = 3;

  // Shared state across screens
  List<String> _selectedInterests = [];
  double? _latitude;
  double? _longitude;
  String? _address;
  String? _avatarUrl;

  bool _isCompleting = false;
  String? _errorMessage;

  final AuthService _authService = AuthService();

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _goToPage(int page) {
    _pageController.animateToPage(
      page,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeInOut,
    );
  }

  void _onContinue() {
    if (_currentPage < _totalPages - 1) {
      _goToPage(_currentPage + 1);
    }
  }

  void _onBack() {
    if (_currentPage > 0) {
      _goToPage(_currentPage - 1);
    }
  }

  Future<void> _completeOnboarding() async {
    setState(() {
      _isCompleting = true;
      _errorMessage = null;
    });

    try {
      await _authService.completeOnboarding(
        interests: _selectedInterests,
        latitude: _latitude,
        longitude: _longitude,
        address: _address,
        avatarUrl: _avatarUrl,
      );
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/home');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Failed to save onboarding data. Please try again.';
        _isCompleting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          children: [
            // ── Progress indicator ──
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(_totalPages, (index) {
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: _currentPage == index ? 24 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: _currentPage == index ? AppColors.primary : AppColors.border2,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  );
                }),
              ),
            ),

            // ── PageView ──
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                onPageChanged: (page) {
                  setState(() {
                    _currentPage = page;
                    _errorMessage = null;
                  });
                },
                children: [
                  InterestsScreen(
                    selectedInterests: _selectedInterests,
                    onInterestsChanged: (interests) {
                      _selectedInterests = interests;
                    },
                  ),
                  LocationScreen(
                    onLocationSet: (lat, lng, address) {
                      _latitude = lat;
                      _longitude = lng;
                      _address = address;
                    },
                  ),
                  PhotoScreen(
                    onPhotoSet: (avatarUrl) {
                      _avatarUrl = avatarUrl;
                    },
                    isCompleting: _isCompleting,
                  ),
                ],
              ),
            ),

            // ── Error message ──
            if (_errorMessage != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Text(
                  _errorMessage!,
                  style: const TextStyle(color: AppColors.red, fontSize: 13),
                  textAlign: TextAlign.center,
                ),
              ),

            // ── Bottom buttons ──
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
              child: Row(
                children: [
                  // Back button (hidden on first page)
                  if (_currentPage > 0)
                    TextButton(
                      onPressed: _onBack,
                      child: const Text(
                        'Back',
                        style: TextStyle(
                          fontSize: 15,
                          color: AppColors.text2,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    )
                  else
                    const SizedBox(width: 80),

                  const Spacer(),

                  // Continue / Get Started button
                  if (_currentPage < _totalPages - 1)
                    _buildContinueButton()
                  else
                    _buildGetStartedButton(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContinueButton() {
    bool canContinue;
    switch (_currentPage) {
      case 0:
        canContinue = _selectedInterests.length >= 3;
        break;
      case 1:
        canContinue = _address != null && _address!.isNotEmpty;
        break;
      default:
        canContinue = true;
    }

    return ElevatedButton(
      onPressed: canContinue ? _onContinue : null,
      style: ElevatedButton.styleFrom(
        backgroundColor: canContinue ? AppColors.primary : AppColors.border2,
        disabledBackgroundColor: AppColors.border2,
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      child: const Text(
        'Continue',
        style: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
      ),
    );
  }

  Widget _buildGetStartedButton() {
    return ElevatedButton(
      onPressed: _isCompleting ? null : _completeOnboarding,
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.secondary,
        disabledBackgroundColor: AppColors.border2,
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      child: _isCompleting
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            )
          : const Text(
              'Get Started!',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
    );
  }
}