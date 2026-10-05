import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neighborly_app/features/feed/widgets/post_card.dart';
import 'package:neighborly_app/screens/auth_screen.dart';
import 'package:neighborly_app/screens/profile/kyc_verification_screen.dart';
import 'package:neighborly_app/services/api_service.dart';

Widget _testApp(Widget child) {
  return MaterialApp(
    theme: ThemeData.dark(useMaterial3: true),
    home: Scaffold(body: child),
  );
}

class _FakeKycApi implements KycVerificationApi {
  _FakeKycApi({
    this.emailVerified = false,
    this.phoneVerified = false,
    this.level2 = const <String, dynamic>{
      'submission': null,
      'canSubmit': true,
    },
  });

  final bool emailVerified;
  final bool phoneVerified;
  final Map<String, dynamic> level2;

  @override
  Future<Map<String, dynamic>> confirmKycEmailVerification(
    String token,
  ) async => <String, dynamic>{};

  @override
  Future<Map<String, dynamic>> confirmKycPhoneVerification(String code) async =>
      <String, dynamic>{};

  @override
  Future<Map<String, dynamic>> getKycLevel1() async => <String, dynamic>{
    'emailVerified': emailVerified,
    'phoneVerified': phoneVerified,
  };

  @override
  Future<Map<String, dynamic>> getKycLevel2() async => level2;

  @override
  Future<Map<String, dynamic>> startKycEmailVerification() async =>
      <String, dynamic>{};

  @override
  Future<Map<String, dynamic>> startKycPhoneVerification() async =>
      <String, dynamic>{};

  @override
  Future<Map<String, dynamic>> submitKycLevel2(
    Map<String, dynamic> body,
  ) async => <String, dynamic>{};

  @override
  Future<Map<String, dynamic>> resubmitKycLevel2(
    Map<String, dynamic> body,
  ) async => <String, dynamic>{};

  @override
  Future<String> uploadKycDocumentBytes(
    String fileName,
    List<int> bytes,
  ) async => 'document-ref';
}

void main() {
  group('API contract', () {
    test('uses the safe local API default', () {
      expect(ApiService.baseUrl, 'http://localhost:8080/api');
      expect(
        ApiService.uriFor('/orders/draft'),
        Uri.parse('http://localhost:8080/api/orders/draft'),
      );
    });

    test('builds the backend draft submit route', () {
      expect(
        ApiService.draftSubmitPath('order-123'),
        '/orders/draft/order-123/submit',
      );
    });

    test('nests draft description under prefill', () {
      final body = ApiService.draftOrderBody(
        serviceCatalogId: 'service-1',
        entryPoint: 'direct',
        description: 'Replace the leaking kitchen faucet.',
        packageId: 'package-1',
        prefill: <String, dynamic>{'price': 6900},
      );

      expect(body.containsKey('description'), isFalse);
      expect(body['serviceCatalogId'], 'service-1');
      expect(body['entryPoint'], 'direct');
      expect(body['prefill'], <String, dynamic>{
        'packageId': 'package-1',
        'price': 6900,
        'description': 'Replace the leaking kitchen faucet.',
      });
    });

    test('builds canonical active and completed order filters', () {
      final active = Uri.parse(
        ApiService.myOrdersPath(ApiService.activeOrderStatuses),
      );
      final completed = Uri.parse(
        ApiService.myOrdersPath(ApiService.completedOrderStatuses),
      );

      expect(active.path, '/orders/me');
      expect(active.queryParametersAll['status[]'], <String>[
        'draft',
        'submitted',
        'matching',
        'matched',
        'contracted',
        'paid',
        'in_progress',
        'disputed',
      ]);
      expect(completed.queryParametersAll['status[]'], <String>[
        'completed',
        'closed',
      ]);
    });

    test('parses canonical order-list responses for the dashboard', () {
      final dashboard = ApiService.parseCustomerDashboard(
        <String, dynamic>{
          'total': 1,
          'items': <dynamic>[
            <String, dynamic>{'id': 'order-1', 'status': 'in_progress'},
          ],
        },
        <String, dynamic>{'total': 2, 'items': <dynamic>[]},
      );

      expect(dashboard.stats['activeOrders'], 1);
      expect(dashboard.stats['completedOrders'], 2);
      expect(dashboard.stats['totalSpent'], isNull);
      expect(dashboard.stats['avgRating'], isNull);
      expect(dashboard.activeItems.single['id'], 'order-1');
    });

    test('parses an empty dashboard without fabricated data', () {
      final dashboard = ApiService.parseCustomerDashboard(
        <String, dynamic>{'total': 0, 'items': <dynamic>[]},
        <String, dynamic>{'total': 0, 'items': <dynamic>[]},
      );

      expect(dashboard.stats['activeOrders'], 0);
      expect(dashboard.stats['completedOrders'], 0);
      expect(dashboard.stats['totalSpent'], isNull);
      expect(dashboard.stats['avgRating'], isNull);
      expect(dashboard.activeItems, isEmpty);
    });

    test('uses an allowed MIME type for KYC byte uploads', () {
      final type = ApiService.kycDocumentContentTypeForFileName(
        'identity.webp',
      );

      expect(type.mimeType, 'image/webp');
      expect(
        () => ApiService.kycDocumentContentTypeForFileName('identity.heic'),
        throwsArgumentError,
      );
    });
  });

  group('authentication journey', () {
    testWidgets('renders login and signup entry points', (tester) async {
      await tester.pumpWidget(_testApp(const AuthScreen()));

      expect(find.textContaining('Welcome to'), findsOneWidget);
      expect(find.text('Log In'), findsWidgets);
      expect(find.text('Sign Up'), findsOneWidget);
      expect(
        find.byWidgetPredicate(
          (widget) =>
              widget is TextField &&
              widget.decoration?.hintText ==
                  'Enter your username, email, or phone',
        ),
        findsOneWidget,
      );
    });

    testWidgets('switches to signup form', (tester) async {
      await tester.pumpWidget(_testApp(const AuthScreen()));

      await tester.tap(find.text('Sign Up'));
      await tester.pumpAndSettle();

      expect(find.text('Create Account'), findsOneWidget);
      expect(find.text('your@email.com'), findsOneWidget);
      expect(find.text('Your display name'), findsOneWidget);
    });
  });

  group('feed journey', () {
    testWidgets('renders a business post and invokes primary actions', (
      tester,
    ) async {
      var likes = 0;
      var saves = 0;
      var bookings = 0;
      final post = <String, dynamic>{
        'id': 'post-1',
        'author': <String, dynamic>{
          'id': 'author-1',
          'displayName': 'Neighbour Bakery',
        },
        'category': <String, dynamic>{'name': 'Food'},
        'caption': 'Fresh bread today',
        'likeCount': 3,
        'commentCount': 0,
        'saveCount': 1,
        'media': <dynamic>[],
        'isBusinessPost': true,
        'serviceCatalogId': 'service-1',
      };

      await tester.pumpWidget(
        _testApp(
          SingleChildScrollView(
            child: PostCard(
              post: post,
              state: const PostCardState(),
              callbacks: PostCardCallbacks(
                onLike: () => likes++,
                onSave: () => saves++,
                onBookNow: () => bookings++,
              ),
            ),
          ),
        ),
      );

      expect(find.text('Neighbour Bakery'), findsWidgets);
      expect(find.text('Fresh bread today'), findsOneWidget);
      expect(find.text('Book Now'), findsNWidgets(2));

      await tester.tap(find.byIcon(Icons.favorite_outline));
      await tester.tap(find.byIcon(Icons.bookmark_outline));
      await tester.tap(find.text('Book Now').first);

      expect(likes, 1);
      expect(saves, 1);
      expect(bookings, 1);
    });

    testWidgets('opens the empty comments state', (tester) async {
      await tester.pumpWidget(
        _testApp(
          PostCard(
            post: <String, dynamic>{
              'id': 'post-2',
              'author': <String, dynamic>{
                'id': 'author-2',
                'displayName': 'Local User',
              },
              'category': <String, dynamic>{'name': 'Community'},
              'caption': 'Hello neighbours',
              'commentCount': 1,
              'media': <dynamic>[],
            },
            state: const PostCardState(),
            callbacks: const PostCardCallbacks(),
          ),
        ),
      );

      await tester.tap(find.byIcon(Icons.chat_bubble_outline));
      await tester.pumpAndSettle();

      expect(find.text('Comments'), findsOneWidget);
      expect(find.textContaining('No comments yet'), findsOneWidget);
      expect(find.text('Add a comment...'), findsOneWidget);
    });
  });

  group('KYC journey', () {
    testWidgets('shows a resubmission state from the Level 2 contract', (
      tester,
    ) async {
      await tester.pumpWidget(
        _testApp(
          KycVerificationScreen(
            api: _FakeKycApi(
              emailVerified: true,
              phoneVerified: true,
              level2: const <String, dynamic>{
                'submission': <String, dynamic>{
                  'status': 'resubmit_requested',
                  'reviewNote': 'Please provide a clearer ID image.',
                },
                'canSubmit': true,
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Current status: resubmit_requested'), findsOneWidget);
      expect(
        find.text('Reviewer note: Please provide a clearer ID image.'),
        findsOneWidget,
      );

      await tester.drag(find.byType(ListView), const Offset(0, -1200));
      await tester.pumpAndSettle();

      expect(find.text('Resubmit Level 2'), findsOneWidget);
    });

    testWidgets('enables email confirmation after a token is entered', (
      tester,
    ) async {
      await tester.pumpWidget(
        _testApp(KycVerificationScreen(api: _FakeKycApi())),
      );
      await tester.pump();

      final confirmButton = find.widgetWithText(
        OutlinedButton,
        'Confirm email',
      );
      expect(tester.widget<OutlinedButton>(confirmButton).onPressed, isNull);

      await tester.enterText(find.byType(TextField).first, 'email-token');
      await tester.pump();

      expect(tester.widget<OutlinedButton>(confirmButton).onPressed, isNotNull);
    });
  });
}
