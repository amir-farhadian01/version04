import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// NeighborHub design system — matches template.html CSS variables
class AppColors {
  // Dark theme colors
  static const Color bg = Color(0xFF0D0F1A);
  static const Color bg2 = Color(0xFF131624);
  static const Color bg3 = Color(0xFF1A1D2E);
  static const Color card = Color(0xFF1E2235);
  static const Color card2 = Color(0xFF242840);
  static const Color primary = Color(0xFF2B6EFF);
  static const Color primaryDim = Color(0xFF1A3F99);
  static const Color secondary = Color(0xFF0FC98A);
  static const Color accent = Color(0xFFFF7A2B);
  static const Color warn = Color(0xFFFFB800);
  static const Color red = Color(0xFFFF4D4D);
  static const Color purple = Color(0xFF8B5CF6);
  static const Color text = Color(0xFFF0F2FF);
  static const Color text2 = Color(0xFF8B90B0);
  static const Color text3 = Color(0xFF4A4F70);
  static const Color border = Color(0xFF2A2F4A);
  static const Color border2 = Color(0xFF363B5E);
}

/// Light theme colors
class AppColorsLight {
  static const Color bg = Color(0xFFF5F6FA);
  static const Color bg2 = Color(0xFFEBEDF5);
  static const Color bg3 = Color(0xFFE0E3EE);
  static const Color card = Color(0xFFFFFFFF);
  static const Color card2 = Color(0xFFF0F2F8);
  static const Color primary = Color(0xFF2B6EFF);
  static const Color primaryDim = Color(0xFFD6E3FF);
  static const Color secondary = Color(0xFF0FC98A);
  static const Color accent = Color(0xFFFF7A2B);
  static const Color warn = Color(0xFFFFB800);
  static const Color red = Color(0xFFFF4D4D);
  static const Color purple = Color(0xFF8B5CF6);
  static const Color text = Color(0xFF1A1D2E);
  static const Color text2 = Color(0xFF6B7090);
  static const Color text3 = Color(0xFF9EA3C0);
  static const Color border = Color(0xFFDDE0EB);
  static const Color border2 = Color(0xFFC8CCE0);
}

class AppTheme {
  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.bg,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.primary,
        secondary: AppColors.secondary,
        surface: AppColors.card,
        error: AppColors.red,
      ),
      fontFamily: 'DM Sans',
      textTheme: const TextTheme(
        displayLarge: TextStyle(
          fontFamily: 'Space Grotesk',
          fontSize: 26,
          fontWeight: FontWeight.w700,
          color: AppColors.text,
        ),
        displayMedium: TextStyle(
          fontFamily: 'Space Grotesk',
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: AppColors.text,
        ),
        titleLarge: TextStyle(
          fontFamily: 'Space Grotesk',
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: AppColors.text,
        ),
        titleMedium: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w700,
          color: AppColors.text,
          fontFamily: 'Space Grotesk',
        ),
        bodyLarge: TextStyle(
          fontSize: 15,
          color: AppColors.text,
        ),
        bodyMedium: TextStyle(
          fontSize: 13,
          color: AppColors.text,
        ),
        bodySmall: TextStyle(
          fontSize: 12,
          color: AppColors.text2,
        ),
        labelSmall: TextStyle(
          fontSize: 10,
          color: AppColors.text2,
          fontWeight: FontWeight.w500,
        ),
      ),
      dividerColor: AppColors.border,
      cardColor: AppColors.card,
      canvasColor: AppColors.bg,
    );
  }

  static ThemeData get lightTheme {
    return ThemeData(
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColorsLight.bg,
      colorScheme: const ColorScheme.light(
        primary: AppColorsLight.primary,
        secondary: AppColorsLight.secondary,
        surface: AppColorsLight.card,
        error: AppColorsLight.red,
      ),
      fontFamily: 'DM Sans',
      textTheme: const TextTheme(
        displayLarge: TextStyle(
          fontFamily: 'Space Grotesk',
          fontSize: 26,
          fontWeight: FontWeight.w700,
          color: AppColorsLight.text,
        ),
        displayMedium: TextStyle(
          fontFamily: 'Space Grotesk',
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: AppColorsLight.text,
        ),
        titleLarge: TextStyle(
          fontFamily: 'Space Grotesk',
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: AppColorsLight.text,
        ),
        titleMedium: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w700,
          color: AppColorsLight.text,
          fontFamily: 'Space Grotesk',
        ),
        bodyLarge: TextStyle(
          fontSize: 15,
          color: AppColorsLight.text,
        ),
        bodyMedium: TextStyle(
          fontSize: 13,
          color: AppColorsLight.text,
        ),
        bodySmall: TextStyle(
          fontSize: 12,
          color: AppColorsLight.text2,
        ),
        labelSmall: TextStyle(
          fontSize: 10,
          color: AppColorsLight.text2,
          fontWeight: FontWeight.w500,
        ),
      ),
      dividerColor: AppColorsLight.border,
      cardColor: AppColorsLight.card,
      canvasColor: AppColorsLight.bg,
    );
  }
}

/// Theme provider that persists the user's preference
class ThemeProvider extends ChangeNotifier {
  static const String _themeKey = 'theme_mode';

  ThemeMode _themeMode = ThemeMode.dark;

  ThemeMode get themeMode => _themeMode;

  bool get isDarkMode => _themeMode == ThemeMode.dark;

  ThemeProvider() {
    _loadTheme();
  }

  Future<void> _loadTheme() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_themeKey);
    if (saved == 'light') {
      _themeMode = ThemeMode.light;
      notifyListeners();
    }
  }

  Future<void> setDarkMode() async {
    _themeMode = ThemeMode.dark;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeKey, 'dark');
  }

  Future<void> setLightMode() async {
    _themeMode = ThemeMode.light;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeKey, 'light');
  }

  Future<void> toggleTheme() async {
    if (_themeMode == ThemeMode.dark) {
      await setLightMode();
    } else {
      await setDarkMode();
    }
  }
}
