import 'dart:typed_data';

/// SHAHID Capture Model — Immutable photo record with metadata
class CaptureModel {
  final String? localId; // SQLite local ID before sync
  final String? serverId; // UUID after sync
  final String capturePointId;
  final String userId;
  final Uint8List imageBytes;
  final String fileName;
  final String capturedAt; // ISO 8601 from NTP
  final double gpsLat;
  final double gpsLng;
  final double? gpsAccuracy;
  final String hashSha256; // Computed locally before upload
  final String deviceId;
  final String? deviceModel;
  final String? notes;
  final bool synced;
  final String? syncError;
  final String createdAt; // Local timestamp

  CaptureModel({
    this.localId,
    this.serverId,
    required this.capturePointId,
    required this.userId,
    required this.imageBytes,
    required this.fileName,
    required this.capturedAt,
    required this.gpsLat,
    required this.gpsLng,
    this.gpsAccuracy,
    required this.hashSha256,
    required this.deviceId,
    this.deviceModel,
    this.notes,
    this.synced = false,
    this.syncError,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'local_id': localId,
      'server_id': serverId,
      'capture_point_id': capturePointId,
      'user_id': userId,
      'file_name': fileName,
      'captured_at': capturedAt,
      'gps_lat': gpsLat,
      'gps_lng': gpsLng,
      'gps_accuracy': gpsAccuracy,
      'hash_sha256': hashSha256,
      'device_id': deviceId,
      'device_model': deviceModel,
      'notes': notes,
      'synced': synced ? 1 : 0,
      'sync_error': syncError,
      'created_at': createdAt,
    };
  }

  factory CaptureModel.fromMap(Map<String, dynamic> map, Uint8List imageBytes) {
    return CaptureModel(
      localId: map['local_id'] as String?,
      serverId: map['server_id'] as String?,
      capturePointId: map['capture_point_id'] as String,
      userId: map['user_id'] as String,
      imageBytes: imageBytes,
      fileName: map['file_name'] as String,
      capturedAt: map['captured_at'] as String,
      gpsLat: map['gps_lat'] as double,
      gpsLng: map['gps_lng'] as double,
      gpsAccuracy: map['gps_accuracy'] as double?,
      hashSha256: map['hash_sha256'] as String,
      deviceId: map['device_id'] as String,
      deviceModel: map['device_model'] as String?,
      notes: map['notes'] as String?,
      synced: (map['synced'] as int) == 1,
      syncError: map['sync_error'] as String?,
      createdAt: map['created_at'] as String,
    );
  }

  CaptureModel copyWith({
    String? localId,
    String? serverId,
    bool? synced,
    String? syncError,
  }) {
    return CaptureModel(
      localId: localId ?? this.localId,
      serverId: serverId ?? this.serverId,
      capturePointId: capturePointId,
      userId: userId,
      imageBytes: imageBytes,
      fileName: fileName,
      capturedAt: capturedAt,
      gpsLat: gpsLat,
      gpsLng: gpsLng,
      gpsAccuracy: gpsAccuracy,
      hashSha256: hashSha256,
      deviceId: deviceId,
      deviceModel: deviceModel,
      notes: notes,
      synced: synced ?? this.synced,
      syncError: syncError ?? this.syncError,
      createdAt: createdAt,
    );
  }
}
