import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'blocs/auth/auth_bloc.dart';
import 'blocs/capture/capture_bloc.dart';
import 'blocs/sync/sync_bloc.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'services/auth_service.dart';
import 'services/capture_service.dart';
import 'services/sync_service.dart';
import 'services/database_service.dart';
import 'l10n/l10n.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize local database (Hive + SQLite)
  await DatabaseService.init();

  // Initialize sync service (background upload queue) and cleanup
  await SyncService.init();

  runApp(const ShahidApp());
}

class ShahidApp extends StatelessWidget {
  const ShahidApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider(create: (_) => AuthService()),
        RepositoryProvider(create: (_) => CaptureService()),
        RepositoryProvider(create: (_) => SyncService()),
      ],
      child: MultiBlocProvider(
        providers: [
          BlocProvider(create: (context) => AuthBloc(authService: context.read<AuthService>())),
          BlocProvider(create: (context) => CaptureBloc(captureService: context.read<CaptureService>())),
          BlocProvider(create: (context) => SyncBloc(syncService: context.read<SyncService>())),
        ],
        child: MaterialApp(
          title: 'SHAHID — شاهد',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            useMaterial3: true,
            colorScheme: ColorScheme.fromSeed(
              seedColor: const Color(0xFF1E3A5F),
              brightness: Brightness.light,
            ),
            fontFamily: 'Cairo',
          ),
          darkTheme: ThemeData(
            useMaterial3: true,
            colorScheme: ColorScheme.fromSeed(
              seedColor: const Color(0xFF1E3A5F),
              brightness: Brightness.dark,
            ),
            fontFamily: 'Cairo',
          ),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: L10n.all,
          locale: const Locale('ar'), // Default to Arabic per SRS
          builder: (context, child) {
            // Force RTL for Arabic
            return Directionality(
              textDirection: TextDirection.rtl,
              child: child!,
            );
          },
          home: BlocBuilder<AuthBloc, AuthState>(
            builder: (context, state) {
              if (state is Authenticated) {
                return const HomeScreen();
              }
              return const LoginScreen();
            },
          ),
        ),
      ),
    );
  }
}
