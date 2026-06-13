import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

/// SHAHID Local Database Service
/// Handles SQLite for photo queue, capture points, and route state.
class DatabaseService {
  static Database? _db;

  static Future<Database> get database async {
    _db ??= await _initDB();
    return _db!;
  }

  static Future<Database> _initDB() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'shahid_local.db');

    return await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        // Photos queue (offline-first storage)
        await db.execute('''
          CREATE TABLE photos_queue (
            local_id TEXT PRIMARY KEY,
            server_id TEXT,
            capture_point_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            image_bytes BLOB NOT NULL,
            file_name TEXT NOT NULL,
            captured_at TEXT NOT NULL,
            gps_lat REAL NOT NULL,
            gps_lng REAL NOT NULL,
            gps_accuracy REAL,
            hash_sha256 TEXT NOT NULL,
            is_ntp_synced INTEGER NOT NULL DEFAULT 1,
            device_id TEXT NOT NULL,
            device_model TEXT,
            notes TEXT,
            synced INTEGER NOT NULL DEFAULT 0,
            sync_error TEXT,
            created_at TEXT NOT NULL
          )
        ''');

        // Capture points cache (for offline route access)
        await db.execute('''
          CREATE TABLE capture_points_cache (
            id TEXT PRIMARY KEY,
            zone_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            expected_stage TEXT,
            capture_frequency_hours INTEGER NOT NULL DEFAULT 24,
            gps_lat REAL,
            gps_lng REAL,
            is_active INTEGER NOT NULL DEFAULT 1,
            route_order INTEGER NOT NULL DEFAULT 0,
            completed_at TEXT,
            synced INTEGER NOT NULL DEFAULT 0
          )
        ''');

        // Routes cache
        await db.execute('''
          CREATE TABLE routes_cache (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            date TEXT NOT NULL,
            capture_points TEXT NOT NULL, -- JSON array of IDs
            completed INTEGER NOT NULL DEFAULT 0
          )
        ''');

        // Audit log (local actions)
        await db.execute('''
          CREATE TABLE local_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT,
            timestamp TEXT NOT NULL,
            details TEXT
          )
        ''');
      },
    );
  }

  static Future<void> init() async {
    await database;
  }

  static Future<void> close() async {
    if (_db != null) {
      await _db!.close();
      _db = null;
    }
  }
}
