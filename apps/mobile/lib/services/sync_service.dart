import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import 'capture_service.dart';
import 'database_service.dart';
import '../models/capture_model.dart';

/// SHAHID Sync Service
/// Manages background upload of queued photos when connectivity is available.
class SyncService {
  static final SyncService _instance = SyncService._internal();
  factory SyncService() => _instance;
  SyncService._internal();

  static const String _apiBase = 'http://10.0.2.2:3001/api/v1'; // Android emulator localhost
  static bool _initialized = false;
  static Timer? _timer;

  static Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

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

    final unsynced = await CaptureService().getUnsyncedPhotos();
    if (unsynced.isEmpty) return;

    // Upload one by one to avoid memory issues with large images
    for (final photo in unsynced) {
      await _uploadPhoto(photo);
    }
  }

  Future<void> _uploadPhoto(CaptureModel photo) async {
    try {
      final uri = Uri.parse('$_apiBase/photos');
      final request = http.MultipartRequest('POST', uri);

      // Auth token should be injected from AuthService
      // For now, placeholder header
      request.headers['Authorization'] = 'Bearer ${await _getToken()}';

      // Metadata JSON
      final metadata = jsonEncode({
        'capture_point_id': photo.capturePointId,
        'captured_at': photo.capturedAt,
        'gps_lat': photo.gpsLat,
        'gps_lng': photo.gpsLng,
        'gps_accuracy': photo.gpsAccuracy,
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
          await CaptureService().markSyncError(photo.localId!, 'Missing server ID in response');
        }
      } else {
        await CaptureService().markSyncError(photo.localId!, 'HTTP ${response.statusCode}: $responseBody');
      }
    } catch (e) {
      await CaptureService().markSyncError(photo.localId!, 'Network/Upload error: $e');
    }
  }

  Future<String> _getToken() async {
    // In production: retrieve JWT from secure storage (flutter_secure_storage)
    return 'local-dev-token';
  }

  void dispose() {
    _timer?.cancel();
  }
}
