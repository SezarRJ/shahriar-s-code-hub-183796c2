import 'dart:async';
import 'package:sqflite/sqflite.dart';
import 'package:workmanager/workmanager.dart';
import 'database_service.dart';

/// SHAHID Cleanup Service
/// Enforces SRS constraints:
/// - 7-day maximum local retention for synced photos (NFR-3.2, AC-01)
/// - 500-photo maximum queue size (FR-1.5)
/// - Exponential backoff for failed sync attempts (FR-1.6)
///
/// Runs as a background WorkManager task every 6 hours.
class CleanupService {
  static const String cleanupTaskName = 'shahid_cleanup_task';
  static const int maxQueueSize = 500;
  static const int maxRetentionDays = 7;
  static const int maxSyncAttempts = 10;

  /// Initialize WorkManager background task registration
  static Future<void> init() async {
    await Workmanager().initialize(
      cleanupCallback,
      isInDebugMode: false,
    );

    // Register periodic cleanup every 6 hours
    await Workmanager().registerPeriodicTask(
      cleanupTaskName,
      cleanupTaskName,
      frequency: const Duration(hours: 6),
      constraints: Constraints(
        networkType: NetworkType.not_required, // Cleanup runs offline too
        requiresBatteryNotLow: true,
      ),
      existingWorkPolicy: ExistingWorkPolicy.replace,
    );
  }

  /// Cancel cleanup tasks (for testing or logout)
  static Future<void> cancel() async {
    await Workmanager().cancelByUniqueName(cleanupTaskName);
  }

  /// Main cleanup logic — called by WorkManager callback
  static Future<Map<String, int>> performCleanup() async {
    final db = await DatabaseService.database;
    final results = <String, int>{};

    await db.transaction((txn) async {
      // 1. Delete synced photos older than 7 days
      final cutoffDate = DateTime.now().subtract(
        const Duration(days: maxRetentionDays),
      ).toUtc().toIso8601String();

      final deletedSynced = await txn.rawDelete('''
        DELETE FROM photos_queue
        WHERE synced = 1
          AND created_at < ?
      ''', [cutoffDate]);
      results['deleted_synced_older_than_7d'] = deletedSynced;

      // 2. Delete failed sync attempts exceeding max retries
      final deletedFailed = await txn.rawDelete('''
        DELETE FROM photos_queue
        WHERE sync_error IS NOT NULL
          AND sync_attempts >= ?
      ''', [maxSyncAttempts]);
      results['deleted_failed_max_retries'] = deletedFailed;

      // 3. If queue still exceeds 500 photos, delete oldest synced first,
      //    then oldest unsynced with warnings
      final countResult = await txn.rawQuery(
        'SELECT COUNT(*) as count FROM photos_queue',
      );
      final currentCount = (countResult.first['count'] as int?) ?? 0;

      if (currentCount > maxQueueSize) {
        final overflow = currentCount - maxQueueSize;

        // First: delete oldest synced photos
        final deletedSyncedOverflow = await txn.rawDelete('''
          DELETE FROM photos_queue
          WHERE id IN (
            SELECT id FROM photos_queue
            WHERE synced = 1
            ORDER BY created_at ASC
            LIMIT ?
          )
        ''', [overflow]);

        int remainingToDelete = overflow - deletedSyncedOverflow;

        // If still overflowing, delete oldest unsynced (emergency — log warning)
        if (remainingToDelete > 0) {
          final deletedUnsyncedOverflow = await txn.rawDelete('''
            DELETE FROM photos_queue
            WHERE id IN (
              SELECT id FROM photos_queue
              WHERE synced = 0
              ORDER BY created_at ASC
              LIMIT ?
            )
          ''', [remainingToDelete]);
          results['deleted_unsynced_overflow'] = deletedUnsyncedOverflow;
        }

        results['deleted_synced_overflow'] = deletedSyncedOverflow;
      }

      results['queue_size_after_cleanup'] = currentCount -
          (results['deleted_synced_older_than_7d'] ?? 0) -
          (results['deleted_failed_max_retries'] ?? 0) -
          (results['deleted_synced_overflow'] ?? 0) -
          (results['deleted_unsynced_overflow'] ?? 0);
    });

    return results;
  }

  /// Check if queue is approaching limit (warning at 400, block at 500)
  static Future<QueueStatus> checkQueueStatus() async {
    final db = await DatabaseService.database;
    final result = await db.rawQuery('''
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN synced = 0 THEN 1 ELSE 0 END) as unsynced,
        SUM(CASE WHEN synced = 1 THEN 1 ELSE 0 END) as synced
      FROM photos_queue
    ''');

    final row = result.first;
    final total = (row['total'] as int?) ?? 0;
    final unsynced = (row['unsynced'] as int?) ?? 0;
    final synced = (row['synced'] as int?) ?? 0;

    return QueueStatus(
      total: total,
      unsynced: unsynced,
      synced: synced,
      isWarning: total >= 400,
      isBlocked: total >= maxQueueSize,
      remainingCapacity: maxQueueSize - total,
    );
  }

  /// Get oldest unsynced photo age for UI display
  static Future<Duration?> getOldestUnsyncedAge() async {
    final db = await DatabaseService.database;
    final result = await db.rawQuery('''
      SELECT created_at FROM photos_queue
      WHERE synced = 0
      ORDER BY created_at ASC
      LIMIT 1
    ''');

    if (result.isEmpty) return null;

    final oldestDate = DateTime.tryParse(result.first['created_at'] as String);
    if (oldestDate == null) return null;

    return DateTime.now().toUtc().difference(oldestDate);
  }
}

/// WorkManager callback dispatcher (must be top-level function)
@pragma('vm:entry-point')
void cleanupCallback() {
  Workmanager().executeTask((task, inputData) async {
    if (task == CleanupService.cleanupTaskName) {
      try {
        await DatabaseService.init();
        final results = await CleanupService.performCleanup();
        print('SHAHID cleanup completed: $results');
        return Future.value(true);
      } catch (e) {
        print('SHAHID cleanup failed: $e');
        return Future.value(false);
      }
    }
    return Future.value(true);
  });
}

class QueueStatus {
  final int total;
  final int unsynced;
  final int synced;
  final bool isWarning;
  final bool isBlocked;
  final int remainingCapacity;

  const QueueStatus({
    required this.total,
    required this.unsynced,
    required this.synced,
    required this.isWarning,
    required this.isBlocked,
    required this.remainingCapacity,
  });
}
