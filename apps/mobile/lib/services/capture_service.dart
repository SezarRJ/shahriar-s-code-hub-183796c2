import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:geolocator/geolocator.dart';
import 'package:ntp/ntp.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';

import '../models/capture_model.dart';
import 'database_service.dart';

/// SHAHID Capture Service
/// Handles photo capture with GPS, NTP timestamp, and SHA-256 hashing.
class CaptureService {
  static const _uuid = Uuid();

  /// Capture a photo with full metadata and store locally.
  Future<CaptureModel> capture({
    required String capturePointId,
    required String userId,
    required Uint8List imageBytes,
    required String fileName,
    String? notes,
  }) async {
    // 1. Get NTP-synced timestamp
    final ntpTime = await _getNtpTime();
    final capturedAt = ntpTime.toUtc().toIso8601String();

    // 2. Get GPS coordinates
    final position = await _getPosition();
    final gpsLat = position.latitude;
    final gpsLng = position.longitude;
    final gpsAccuracy = position.accuracy;

    // 3. Compute SHA-256 hash of original bytes
    final hash = sha256.convert(imageBytes).toString();

    // 4. Get device info
    final deviceId = await _getDeviceId();
    final deviceModel = await _getDeviceModel();

    // 5. Build model
    final capture = CaptureModel(
      localId: _uuid.v4(),
      capturePointId: capturePointId,
      userId: userId,
      imageBytes: imageBytes,
      fileName: fileName,
      capturedAt: capturedAt,
      gpsLat: gpsLat,
      gpsLng: gpsLng,
      gpsAccuracy: gpsAccuracy,
      hashSha256: hash,
      deviceId: deviceId,
      deviceModel: deviceModel,
      notes: notes,
      createdAt: DateTime.now().toUtc().toIso8601String(),
    );

    // 6. Store in local SQLite queue
    await _storeLocal(capture);

    // 7. Log audit
    await _logAudit('capture', 'photo', capture.localId!, {
      'capture_point_id': capturePointId,
      'hash': hash,
    });

    return capture;
  }

  Future<DateTime> _getNtpTime() async {
    try {
      final ntpOffset = await NTP.getNtpOffset(localTime: DateTime.now().toUtc());
      return DateTime.now().toUtc().add(Duration(milliseconds: ntpOffset));
    } catch (e) {
      // Fallback to local time with warning flag (should be logged)
      return DateTime.now().toUtc();
    }
  }

  Future<Position> _getPosition() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw Exception('Location services disabled');
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw Exception('Location permission denied');
      }
    }

    if (permission == LocationPermission.deniedForever) {
      throw Exception('Location permission permanently denied');
    }

    return await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.best,
    );
  }

  Future<String> _getDeviceId() async {
    final deviceInfo = DeviceInfoPlugin();
    if (Platform.isAndroid) {
      final androidInfo = await deviceInfo.androidInfo;
      return androidInfo.id;
    } else if (Platform.isIOS) {
      final iosInfo = await deviceInfo.iosInfo;
      return iosInfo.identifierForVendor ?? 'unknown';
    }
    return 'unknown';
  }

  Future<String?> _getDeviceModel() async {
    final deviceInfo = DeviceInfoPlugin();
    if (Platform.isAndroid) {
      final androidInfo = await deviceInfo.androidInfo;
      return '${androidInfo.manufacturer} ${androidInfo.model}';
    } else if (Platform.isIOS) {
      final iosInfo = await deviceInfo.iosInfo;
      return iosInfo.utsname.machine;
    }
    return null;
  }

  Future<void> _storeLocal(CaptureModel capture) async {
    final db = await DatabaseService.database;
    await db.insert('photos_queue', {
      ...capture.toMap(),
      'image_bytes': capture.imageBytes,
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<void> _logAudit(String action, String entityType, String entityId, Map<String, dynamic> details) async {
    final db = await DatabaseService.database;
    await db.insert('local_audit_log', {
      'action': action,
      'entity_type': entityType,
      'entity_id': entityId,
      'timestamp': DateTime.now().toUtc().toIso8601String(),
      'details': jsonEncode(details),
    });
  }

  /// Get all unsynced photos from local queue.
  Future<List<CaptureModel>> getUnsyncedPhotos() async {
    final db = await DatabaseService.database;
    final maps = await db.query('photos_queue', where: 'synced = ?', whereArgs: [0]);

    final List<CaptureModel> photos = [];
    for (final map in maps) {
      final bytes = map['image_bytes'] as Uint8List;
      photos.add(CaptureModel.fromMap(Map<String, dynamic>.from(map), bytes));
    }
    return photos;
  }

  /// Mark a photo as synced.
  Future<void> markSynced(String localId, String serverId) async {
    final db = await DatabaseService.database;
    await db.update('photos_queue', {
      'synced': 1,
      'server_id': serverId,
      'sync_error': null,
    }, where: 'local_id = ?', whereArgs: [localId]);
  }

  /// Mark sync error.
  Future<void> markSyncError(String localId, String error) async {
    final db = await DatabaseService.database;
    await db.update('photos_queue', {
      'sync_error': error,
    }, where: 'local_id = ?', whereArgs: [localId]);
  }

  /// Get local queue size.
  Future<int> getQueueSize() async {
    final db = await DatabaseService.database;
    final count = Sqflite.firstIntValue(await db.rawQuery('SELECT COUNT(*) FROM photos_queue WHERE synced = 0'));
    return count ?? 0;
  }

  /// Get oldest unsynced photo date.
  Future<DateTime?> getOldestUnsyncedDate() async {
    final db = await DatabaseService.database;
    final result = await db.rawQuery(
      'SELECT created_at FROM photos_queue WHERE synced = 0 ORDER BY created_at ASC LIMIT 1'
    );
    if (result.isEmpty) return null;
    return DateTime.tryParse(result.first['created_at'] as String);
  }
}
