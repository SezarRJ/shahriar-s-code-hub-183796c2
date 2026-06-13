import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:sqflite/sqflite.dart';

import 'capture_service.dart';
import 'database_service.dart';
import 'cleanup_service.dart';
import '../models/capture_model.dart';

/// SHAHID Sync Service
/// Manages background upload of queued photos when connectivity is available.
/// Implements exponential backoff for failed uploads (max 10 attempts).
class SyncService {
  static final SyncService _instance = SyncService._internal();
  factory SyncService() => _instance;
  SyncService._internal();

  static const String _apiBase = 'http://10.0.2.2:3001/api/v1'; // Android emulator localhost
  static bool _initialized = false;
  static Timer? _timer;
  static Timer? _backoffTimer;

  static Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    // Initialize cleanup service (background queue maintenance)
    await CleanupService.init();

    // Listen for connectivity changes
    Connectivity().onConnectivityChanged.listen((results) {
      final result = results.firstOrNull;
      if (result != ConnectivityResult.none) {
        _instance._triggerSync();
      }
    });

    // Periodic sync attempt every 5 minutes
    _timer = Timer.periodic(const Duration(minutes: 5), (_) {
      _instance._triggerSync();
    });
  }

  Future<void> _triggerSync() async {
    final connectivity = await Connectivity().checkConnectivity();
    if (connectivity.firstOrNull == ConnectivityResult.none) {
      return;
    }

    // Check queue capacity before sync
    final queueStatus = await CleanupService.checkQueueStatus();
    if (queueStatus.isBlocked) {
      // Run emergency cleanup first
      await CleanupService.performCleanup();
    }

    final unsynced = await CaptureService().getUnsyncedPhotos();
    if (unsynced.isEmpty) return;

    // Upload one by one to avoid memory issues with large images
    for (final photo in unsynced) {
      await _uploadPhoto(photo);
    }
  }

  Future<void> _uploadPhoto(CaptureModel photo) async {
    final db = await DatabaseService.database;
    try {
      final uri = Uri.parse('$_apiBase/photos');
      final request = http.MultipartRequest('POST', uri);

      // Auth token should be injected from AuthService
      // For now, placeholder header
      request.headers['Authorization'] = 'Bearer ${await _getToken()}';

      // Metadata JSON — includes immutable hash and NTP sync flag for server verification
      final metadata = jsonEncode({
        'capture_point_id': photo.capturePointId,
        'captured_at': photo.capturedAt,
        'gps_lat': photo.gpsLat,
        'gps_lng': photo.gpsLng,
        'gps_accuracy': photo.gpsAccuracy,
        'hash_sha256': photo.hashSha256,
        'is_ntp_synced': photo.isNtpSynced,
        'device_id': photo.deviceId,
        'device_model': photo.deviceModel,
        'notes': photo.notes,
      });

      request.fields['metadata'] = metadata;

      // Image file
      request.files.add(http.MultipartFile.fromBytes(
        'photo',
        photo.imageBytes,
        filename: photo.fileName,
        contentType: MediaType('image', 'jpeg'),
      ));

      final response = await request.send().timeout(const Duration(seconds: 60));
      final responseBody = await response.stream.bytesToString();

      if (response.statusCode == 201) {
        final body = jsonDecode(responseBody);
        final serverId = body['data']?['photo']?['id'] as String?;
        if (serverId != null) {
          await CaptureService().markSynced(photo.localId!, serverId);
        } else {
          await _markFailed(photo.localId!, 'Missing server ID in response', db);
        }
      } else if (response.statusCode == 400) {
        // Hash mismatch or validation error — this will never succeed, retry is futile
        await _markFailed(photo.localId!, 'FATAL: ${response.statusCode} $responseBody', db);
      } else {
        // Transient error — increment attempt and retry with backoff
        await _markFailed(photo.localId!, 'HTTP ${response.statusCode}: $responseBody', db, incrementAttempt: true);
      }
    } catch (e) {
      await _markFailed(photo.localId!, 'Network/Upload error: $e', db, incrementAttempt: true);
    }
  }

  /// Mark photo as failed with incrementing retry count and exponential backoff
  Future<void> _markFailed(String localId, String error, DatabaseExecutor db, {bool incrementAttempt = false}) async {
    int newAttempts = 1;
    if (incrementAttempt) {
      final current = await db.rawQuery(
        'SELECT sync_attempts FROM photos_queue WHERE local_id = ?', [localId]
      );
      newAttempts = ((current.firstOrNull?['sync_attempts'] as int?) ?? 0) + 1;
    }

    await db.update('photos_queue', {
      'sync_error': error,
      'sync_attempts': newAttempts,
    }, where: 'local_id = ?', whereArgs: [localId]);

    // If max attempts reached, schedule cleanup
    if (newAttempts >= CleanupService.maxSyncAttempts) {
      print('Photo $localId reached max sync attempts ($newAttempts). Will be purged by cleanup.');
    }
  }

  Future<String> _getToken() async {
    // In production: retrieve JWT from secure storage (flutter_secure_storage)
    return 'local-dev-token';
  }

  void dispose() {
    _timer?.cancel();
    _backoffTimer?.cancel();
  }
}
