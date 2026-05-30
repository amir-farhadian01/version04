import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

/// Flutter search delegate for finding services and packages.
/// Opens as a full-screen search overlay with suggestions as the user types.
class ServiceSearchDelegate extends SearchDelegate<Map<String, dynamic>?> {
  final ApiService _api = ApiService();

  ServiceSearchDelegate() : super(
    searchFieldLabel: 'Search services...',
    keyboardType: TextInputType.text,
    textInputAction: TextInputAction.search,
  );

  @override
  String get searchFieldLabel => 'Search services...';

  @override
  ThemeData appBarTheme(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? AppColors.text : AppColorsLight.text;
    final hintColor = isDark ? AppColors.text3 : AppColorsLight.text3;
    final bgColor = isDark ? AppColors.bg : AppColorsLight.bg;

    return ThemeData(
      appBarTheme: AppBarTheme(
        backgroundColor: bgColor,
        foregroundColor: textColor,
        elevation: 0,
      ),
      inputDecorationTheme: InputDecorationTheme(
        hintStyle: TextStyle(color: hintColor, fontSize: 16),
        border: InputBorder.none,
      ),
      scaffoldBackgroundColor: bgColor,
      // The search-field input inherits its text color from titleLarge.
      textTheme: TextTheme(
        titleLarge: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w400,
          color: textColor,
        ),
        bodyLarge: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w400,
          color: textColor,
        ),
      ),
    );
  }

  @override
  List<Widget> buildActions(BuildContext context) {
    return [
      if (query.isNotEmpty)
        IconButton(
          icon: const Icon(Icons.clear),
          onPressed: () => query = '',
        ),
    ];
  }

  @override
  Widget buildLeading(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.arrow_back),
      onPressed: () => close(context, null),
    );
  }

  @override
  Widget buildResults(BuildContext context) {
    if (query.trim().length < 2) {
      return _buildEmptyState(context, 'Type at least 2 characters to search');
    }
    return _buildSearchResults(context);
  }

  @override
  Widget buildSuggestions(BuildContext context) {
    if (query.trim().length < 2) {
      return _buildEmptyState(context, 'Search for services, packages, and businesses');
    }
    return _buildSearchResults(context);
  }

  Widget _buildEmptyState(BuildContext context, String message) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? AppColors.text3 : AppColorsLight.text3;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.search, size: 48, color: textColor),
          const SizedBox(height: 16),
          Text(message, style: TextStyle(fontSize: 14, color: textColor)),
        ],
      ),
    );
  }

  Widget _buildSearchResults(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _api.searchServices(query.trim()),
      builder: (context, snapshot) {
        // Loading state
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        // Error state
        if (snapshot.hasError) {
          return _buildErrorState(context, snapshot.error.toString());
        }

        // Empty state
        final data = snapshot.data;
        if (data == null) {
          return _buildEmptyState(context, "No results found for '$query'");
        }

        final resultData = data['data'] as Map<String, dynamic>?;
        final services = (resultData?['services'] as List<dynamic>?)
                ?.cast<Map<String, dynamic>>() ??
            [];
        final packages = (resultData?['packages'] as List<dynamic>?)
                ?.cast<Map<String, dynamic>>() ??
            [];
        final totalServices = resultData?['totalServices'] as int? ?? 0;
        final totalPackages = resultData?['totalPackages'] as int? ?? 0;

        if (services.isEmpty && packages.isEmpty) {
          return _buildEmptyState(context, "No results found for '$query'");
        }

        return ListView(
          padding: const EdgeInsets.symmetric(vertical: 8),
          children: [
            if (services.isNotEmpty) ...[
              _buildSectionHeader(context, 'Services ($totalServices)'),
              ...services.map((s) => _buildServiceTile(context, s)),
            ],
            if (packages.isNotEmpty) ...[
              const SizedBox(height: 8),
              _buildSectionHeader(context, 'Packages ($totalPackages)'),
              ...packages.map((p) => _buildPackageTile(context, p)),
            ],
          ],
        );
      },
    );
  }

  Widget _buildErrorState(BuildContext context, String error) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? AppColors.text2 : AppColorsLight.text2;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, size: 48, color: AppColors.red),
          const SizedBox(height: 16),
          Text('Search failed', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: textColor)),
          const SizedBox(height: 8),
          Text(error, style: TextStyle(fontSize: 12, color: textColor), textAlign: TextAlign.center),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(BuildContext context, String title) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? AppColors.text2 : AppColorsLight.text2;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Text(title,
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: textColor,
              letterSpacing: 0.5)),
    );
  }

  Widget _buildServiceTile(BuildContext context, Map<String, dynamic> service) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? AppColors.card : AppColorsLight.card;
    final textColor = isDark ? AppColors.text : AppColorsLight.text;
    final text2Color = isDark ? AppColors.text2 : AppColorsLight.text2;
    final borderColor = isDark ? AppColors.border : AppColorsLight.border;

    final name = service['name'] as String? ?? 'Unknown Service';
    final businessName = service['businessName'] as String? ?? '';
    final categoryName = service['categoryName'] as String? ?? '';
    final breadcrumb = (service['breadcrumb'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .join(' > ') ??
        categoryName;
    final price = service['startingPrice'] as int?;
    final bookingMode = service['bookingMode'] as String? ?? '';
    final location = service['location'] as Map<String, dynamic>?;
    final city = location?['city'] as String? ?? '';
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        leading: CircleAvatar(
          backgroundColor: AppColors.primaryDim,
          child: const Icon(Icons.build, color: AppColors.primary, size: 20),
        ),
        title: Text(name,
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: textColor)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (businessName.isNotEmpty)
              Text(businessName, style: TextStyle(fontSize: 12, color: text2Color)),
            Row(
              children: [
                if (breadcrumb.isNotEmpty)
                  Expanded(
                    child: Text(breadcrumb,
                        style: TextStyle(fontSize: 11, color: text2Color),
                        overflow: TextOverflow.ellipsis),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                if (price != null)
                  Text('\$${(price / 100).toStringAsFixed(0)}',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
                          color: AppColors.secondary)),
                if (price != null && bookingMode.isNotEmpty) const SizedBox(width: 8),
                if (bookingMode.isNotEmpty) _buildBookingBadge(bookingMode),
                const Spacer(),
                if (city.isNotEmpty)
                  Row(children: [
                    const Icon(Icons.location_on, size: 10, color: AppColors.text3),
                    const SizedBox(width: 2),
                    Text(city, style: const TextStyle(fontSize: 10, color: AppColors.text3)),
                  ]),
              ],
            ),
          ],
        ),
        trailing: const Icon(Icons.chevron_right, color: AppColors.text3),
        onTap: () {
          final serviceId = service['id'] as String?;
          if (serviceId != null) {
            Navigator.pushNamed(context, '/order/new', arguments: {'serviceId': serviceId});
          }
          close(context, service);
        },
      ),
    );
  }

  Widget _buildPackageTile(BuildContext context, Map<String, dynamic> package) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? AppColors.card : AppColorsLight.card;
    final textColor = isDark ? AppColors.text : AppColorsLight.text;
    final text2Color = isDark ? AppColors.text2 : AppColorsLight.text2;

    final name = package['name'] as String? ?? 'Unknown Package';
    final serviceName = package['serviceName'] as String? ?? '';
    final businessName = package['businessName'] as String? ?? '';
    final price = package['price'] as int?;
    final duration = package['duration'] as int?; // minutes

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.secondary.withValues(alpha: 0.3)),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.secondary.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.shopping_bag, color: AppColors.secondary, size: 20),
        ),
        title: Text(name,
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: textColor)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (serviceName.isNotEmpty)
              Text('in $serviceName',
                  style: TextStyle(fontSize: 12, color: text2Color)),
            if (businessName.isNotEmpty)
              Text(businessName,
                  style: TextStyle(fontSize: 11, color: text2Color)),
            const SizedBox(height: 4),
            Row(
              children: [
                if (price != null)
                  Text('\$${(price / 100).toStringAsFixed(0)}',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
                          color: AppColors.secondary)),
                if (duration != null) ...[
                  const SizedBox(width: 8),
                  Icon(Icons.access_time, size: 10, color: AppColors.text3),
                  const SizedBox(width: 2),
                  Text('${duration}min',
                      style: const TextStyle(fontSize: 10, color: AppColors.text3)),
                ],
              ],
            ),
          ],
        ),
        trailing: const Icon(Icons.chevron_right, color: AppColors.text3),
        onTap: () {
          final packageId = package['id'] as String?;
          if (packageId != null) {
            Navigator.pushNamed(context, '/order/new', arguments: {'packageId': packageId});
          }
          close(context, package);
        },
      ),
    );
  }

  Widget _buildBookingBadge(String mode) {
    Color color;
    String label;
    switch (mode) {
      case 'auto_appointment':
        color = AppColors.secondary;
        label = 'Auto-Appt';
        break;
      case 'negotiation':
        color = AppColors.warn;
        label = 'Negotiate';
        break;
      case 'hybrid':
        color = AppColors.primary;
        label = 'Hybrid';
        break;
      case 'quote_first':
        color = AppColors.purple;
        label = 'Quote';
        break;
      case 'walk_in':
        color = AppColors.accent;
        label = 'Walk-in';
        break;
      default:
        color = AppColors.text3;
        label = mode;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: color)),
    );
  }
}