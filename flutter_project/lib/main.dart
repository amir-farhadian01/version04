import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'theme/app_theme.dart';
import 'providers/cache_provider.dart';
import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';
import 'screens/activity_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/business_profile_screen.dart';
import 'screens/dashboard_screen.dart';
import 'features/feed/feed_screen.dart';
import 'screens/home/home_screen.dart' as home_new;
import 'screens/customer/dashboard_screen.dart';
import 'screens/customer/orders_screen.dart';
import 'screens/customer/order_detail_screen.dart';
import 'screens/customer/messages_screen.dart';
import 'screens/customer/contract_chat_screen.dart';
import 'screens/customer/new_order_screen.dart';
import 'screens/business/business_page_screen.dart';
import 'screens/profile/upgrade_to_business_screen.dart';
import 'features/story/story_screen.dart';
import 'features/story/create_story_screen.dart';
import 'features/comments/comments_screen.dart';
import 'screens/post_detail_screen.dart';
import 'screens/onboarding/onboarding_screen.dart';
import 'features/post/create_post_screen.dart';
import 'widgets/responsive_scaffold.dart';
import 'widgets/flutter_app_scaffold.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => CacheProvider()),
      ],
      child: const NeighborHubApp(),
    ),
  );
}

class NeighborHubApp extends StatelessWidget {
  const NeighborHubApp({super.key});

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    return MaterialApp(
      title: 'NeighborHub',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeProvider.themeMode,
      initialRoute: '/auth',
      routes: {
        '/auth': (_) => const ResponsiveScaffold(child: AuthScreen()),
        '/home': (_) => const ResponsiveScaffold(child: HomeScreen()),
        '/feed': (_) => const FlutterAppScaffold(
          showBottomNav: true,
          currentTab: 'explorer',
          child: FeedScreen(),
        ),
        '/activity': (_) => const ResponsiveScaffold(child: ActivityScreen()),
        '/profile': (_) => const ResponsiveScaffold(child: ProfileScreen()),
        '/biz-profile': (_) => const ResponsiveScaffold(child: BusinessProfileScreen()),
        '/dashboard': (_) => const ResponsiveScaffold(expandOnDesktop: true, child: DashboardScreen()),
        '/new-home': (_) => const ResponsiveScaffold(child: home_new.FlutterHomeScreen()),
        '/services': (_) => const ResponsiveScaffold(expandOnDesktop: true, child: CustomerDashboardScreen()),
        '/customer/orders': (_) => const ResponsiveScaffold(expandOnDesktop: true, child: CustomerOrdersScreen()),
        '/customer/messages': (_) => const ResponsiveScaffold(expandOnDesktop: true, child: CustomerMessagesScreen()),
        '/profile/upgrade': (_) => const ResponsiveScaffold(child: UpgradeToBusinessScreen()),
              '/order/new': (_) => const ResponsiveScaffold(child: NewOrderScreen()),
        '/onboarding': (_) => const ResponsiveScaffold(child: OnboardingScreen()),
        '/post/create': (_) => const ResponsiveScaffold(child: CreatePostScreen()),
        '/create-post': (_) => const FlutterAppScaffold(
          title: 'Create Post',
          showBack: true,
          child: CreatePostScreen(),
        ),
        '/create-story': (context) => const CreateStoryScreen(),
      },
      onGenerateRoute: (settings) {
        if (settings.name == '/customer/order-detail') {
          final orderId = settings.arguments as String? ?? '';
          return MaterialPageRoute(
            builder: (_) => ResponsiveScaffold(
              expandOnDesktop: true,
              child: CustomerOrderDetailScreen(orderId: orderId),
            ),
          );
        }
        if (settings.name == '/customer/contract-chat') {
          final chatId = settings.arguments as String? ?? '';
          return MaterialPageRoute(
            builder: (_) => ResponsiveScaffold(
              expandOnDesktop: true,
              child: CustomerContractChatScreen(chatId: chatId),
            ),
          );
        }
        if (settings.name == '/business') {
          final businessId = settings.arguments as String? ?? '';
          return MaterialPageRoute(
            builder: (_) => ResponsiveScaffold(
              child: BusinessPageScreen(businessId: businessId),
            ),
          );
        }
        if (settings.name == '/explorer/story') {
          final storyId = settings.arguments as String? ?? '';
          return MaterialPageRoute(
            builder: (_) => ResponsiveScaffold(
              child: StoryScreen(storyId: storyId),
            ),
          );
        }
        if (settings.name == '/comments') {
          final postId = settings.arguments as String? ?? '';
          return MaterialPageRoute(
            builder: (_) => ResponsiveScaffold(
              child: CommentsScreen(postId: postId),
            ),
          );
        }
        if (settings.name == '/post-detail') {
          final postId = settings.arguments as String? ?? '';
          return MaterialPageRoute(
            builder: (_) => ResponsiveScaffold(
              child: PostDetailScreen(postId: postId),
            ),
          );
        }
        if (settings.name == '/order/new') {
          return MaterialPageRoute(
            builder: (_) => const ResponsiveScaffold(child: NewOrderScreen()),
          );
        }
        return null;
      },
    );
  }
}