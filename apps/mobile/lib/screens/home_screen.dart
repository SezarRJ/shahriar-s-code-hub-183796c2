import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

  import '../blocs/auth/auth_bloc.dart';
import '../blocs/capture/capture_bloc.dart';
import '../blocs/sync/sync_bloc.dart';
import '../services/cleanup_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;
  QueueStatus? _queueStatus;

  @override
  void initState() {
    super.initState();
    _refreshQueueStatus();
  }

  Future<void> _refreshQueueStatus() async {
    final status = await CleanupService.checkQueueStatus();
    if (mounted) {
      setState(() {
        _queueStatus = status;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('شاهد — الشاشة الرئيسية'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'تسجيل الخروج',
            onPressed: () {
              context.read<AuthBloc>().add(AuthLogoutRequested());
            },
          ),
        ],
      ),
      body: IndexedStack(
        index: _selectedIndex,
        children: [
          _buildDashboardTab(context),
          _buildRouteTab(context),
          _buildQueueTab(context),
          _buildProfileTab(context),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) {
          setState(() {
            _selectedIndex = index;
          });
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'الرئيسية',
          ),
          NavigationDestination(
            icon: Icon(Icons.map_outlined),
            selectedIcon: Icon(Icons.map),
            label: 'المسار',
          ),
          NavigationDestination(
            icon: Icon(Icons.sync_outlined),
            selectedIcon: Icon(Icons.sync),
            label: 'المزامنة',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'الحساب',
          ),
        ],
      ),
    );
  }

  Widget _buildDashboardTab(BuildContext context) {
    final theme = Theme.of(context);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildKpiCard(
            context,
            icon: Icons.camera_alt,
            title: 'التقاطات اليوم',
            value: '0',
            color: theme.colorScheme.primary,
          ),
          const SizedBox(height: 12),
          _buildKpiCard(
            context,
            icon: Icons.pending_actions,
            title: 'في قائمة الانتظار',
            value: '0',
            color: theme.colorScheme.tertiary,
          ),
          const SizedBox(height: 12),
          _buildKpiCard(
            context,
            icon: Icons.check_circle,
            title: 'نقاط مكتملة',
            value: '0 / 0',
            color: theme.colorScheme.secondary,
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () {
              // Navigate to capture flow
            },
            icon: const Icon(Icons.camera_alt),
            label: const Text('بدء جولة التقاط'),
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRouteTab(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.map, size: 64, color: Theme.of(context).colorScheme.outline),
          const SizedBox(height: 16),
          Text(
            'جارٍ تحميل المسار...',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 32.0),
            child: LinearProgressIndicator(),
          ),
        ],
      ),
    );
  }

  Widget _buildQueueTab(BuildContext context) {
    final queueStatus = _queueStatus;
    final queueSize = queueStatus?.total ?? 0;
    final unsynced = queueStatus?.unsynced ?? 0;
    final synced = queueStatus?.synced ?? 0;
    final isWarning = queueStatus?.isWarning ?? false;
    final isBlocked = queueStatus?.isBlocked ?? false;
    final remaining = queueStatus?.remainingCapacity ?? CleanupService.maxQueueSize;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            color: isBlocked ? Theme.of(context).colorScheme.errorContainer : null,
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                children: [
                  Text(
                    'الصور في قائمة الانتظار',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Column(
                        children: [
                          Text(
                            '$unsynced',
                            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: unsynced > 0 ? Theme.of(context).colorScheme.primary : null,
                            ),
                          ),
                          Text('غير مزامنة', style: Theme.of(context).textTheme.bodySmall),
                        ],
                      ),
                      const SizedBox(width: 24),
                      Container(height: 40, width: 1, color: Colors.grey.shade300),
                      const SizedBox(width: 24),
                      Column(
                        children: [
                          Text(
                            '$synced',
                            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: Colors.grey,
                            ),
                          ),
                          Text('مزامنة', style: Theme.of(context).textTheme.bodySmall),
                        ],
                      ),
                      const SizedBox(width: 24),
                      Container(height: 40, width: 1, color: Colors.grey.shade300),
                      const SizedBox(width: 24),
                      Column(
                        children: [
                          Text(
                            '$queueSize',
                            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: isBlocked
                                  ? Theme.of(context).colorScheme.error
                                  : isWarning
                                      ? Theme.of(context).colorScheme.tertiary
                                      : null,
                            ),
                          ),
                          Text('المجموع', style: Theme.of(context).textTheme.bodySmall),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: queueSize / CleanupService.maxQueueSize,
                    backgroundColor: Colors.grey.shade200,
                    color: isBlocked
                        ? Theme.of(context).colorScheme.error
                        : isWarning
                            ? Theme.of(context).colorScheme.tertiary
                            : Theme.of(context).colorScheme.primary,
                    minHeight: 8,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'السعة المتبقية: $remaining / ${CleanupService.maxQueueSize}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  if (isBlocked) ...[
                    const SizedBox(height: 12),
                    Text(
                      '⚠️ قائمة الانتظار ممتلئة! سيتم حذف الصور القديمة تلقائياً.',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                  if (isWarning && !isBlocked) ...[
                    const SizedBox(height: 12),
                    Text(
                      '⚠️ قائمة الانتظار تقترب من السعة القصوى.',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.tertiary,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: () {
                      context.read<SyncBloc>().add(SyncTriggerRequested());
                      _refreshQueueStatus();
                    },
                    icon: const Icon(Icons.cloud_upload),
                    label: const Text('مزامنة الآن'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          BlocBuilder<SyncBloc, SyncState>(
            builder: (context, syncState) {
              if (syncState is SyncInProgress) {
                return const Card(
                  child: Padding(
                    padding: EdgeInsets.all(16.0),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                );
              }
              if (syncState is SyncFailure) {
                return Card(
                  color: Theme.of(context).colorScheme.errorContainer,
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Text(
                      'خطأ في المزامنة: ${syncState.error}',
                      style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer),
                    ),
                  ),
                );
              }
              return const SizedBox.shrink();
            },
          ),
        ],
      ),
    );
  }

  Widget _buildProfileTab(BuildContext context) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, state) {
        String userName = 'مستخدم';
        String userRole = '---';
        if (state is Authenticated) {
          userName = state.user['name']?.toString() ?? 'مستخدم';
          userRole = state.user['role']?.toString() ?? '---';
        }

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              CircleAvatar(
                radius: 48,
                backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                child: Icon(
                  Icons.person,
                  size: 48,
                  color: Theme.of(context).colorScheme.onPrimaryContainer,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                userName,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              Text(
                userRole.toUpperCase(),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 24),
              ListTile(
                leading: const Icon(Icons.settings_outlined),
                title: const Text('الإعدادات'),
                trailing: const Icon(Icons.chevron_left),
                onTap: () {},
              ),
              ListTile(
                leading: const Icon(Icons.help_outline),
                title: const Text('المساعدة'),
                trailing: const Icon(Icons.chevron_left),
                onTap: () {},
              ),
              ListTile(
                leading: const Icon(Icons.logout, color: Colors.red),
                title: const Text('تسجيل الخروج', style: TextStyle(color: Colors.red)),
                onTap: () {
                  context.read<AuthBloc>().add(AuthLogoutRequested());
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildKpiCard(BuildContext context, {
    required IconData icon,
    required String title,
    required String value,
    required Color color,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    value,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
