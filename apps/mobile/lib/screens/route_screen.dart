import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';
import '../services/database_service.dart';

class RouteScreen extends StatefulWidget {
  final String routeId; final String routeName;
  const RouteScreen({super.key, required this.routeId, required this.routeName});
  @override State<RouteScreen> createState() => _RouteScreenState();
}

class _RouteScreenState extends State<RouteScreen> {
  GoogleMapController? _mapController; List<Map<String, dynamic>> _points = []; int _currentIndex = 0; bool _isLoading = true; Position? _currentPosition;

  @override void initState() { super.initState(); _loadRoutePoints(); _startLocationTracking(); }

  Future<void> _loadRoutePoints() async {
    final db = await DatabaseService.database;
    final routeResult = await db.query('routes_cache', where: 'id = ?', whereArgs: [widget.routeId]);
    if (routeResult.isNotEmpty) {
      final ids = (routeResult.first['capture_points'] as String).split(',');
      final points = <Map<String, dynamic>>[];
      for (final id in ids) {
        final pr = await db.query('capture_points_cache', where: 'id = ?', whereArgs: [id.trim()]);
        if (pr.isNotEmpty) points.add(pr.first);
      }
      setState(() { _points = points; _isLoading = false; });
    } else { setState(() => _isLoading = false); }
  }

  void _startLocationTracking() {
    Geolocator.getPositionStream(locationSettings: const LocationSettings(accuracy: LocationAccuracy.best, distanceFilter: 5)).listen((position) {
      setState(() => _currentPosition = position);
      _mapController?.animateCamera(CameraUpdate.newLatLng(LatLng(position.latitude, position.longitude)));
    });
  }

  Future<void> _markPointCompleted(int index) async {
    final db = await DatabaseService.database;
    await db.update('capture_points_cache', {'completed_at': DateTime.now().toUtc().toIso8601String()}, where: 'id = ?', whereArgs: [_points[index]['id']]);
    setState(() { _points[index]['completed_at'] = DateTime.now().toUtc().toIso8601String(); if (_currentIndex < _points.length - 1) _currentIndex++; });
  }

  void _markPointMissed(int index) { setState(() { _points[index]['status'] = 'missed'; if (_currentIndex < _points.length - 1) _currentIndex++; }); }
  String _getStatus(p) { if (p['completed_at'] != null) return 'completed'; if (p['status'] == 'missed') return 'missed'; return 'pending'; }
  Color _getStatusColor(s) { switch (s) { case 'completed': return Colors.green; case 'missed': return Colors.orange; default: return Colors.blue; } }

  @override Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text('جولة: ${widget.routeName}'), centerTitle: true),
      body: _isLoading ? const Center(child: CircularProgressIndicator()) : Column(children: [
        Container(padding: const EdgeInsets.all(16.0), color: theme.colorScheme.primaryContainer, child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('التقدم: ${_currentIndex + 1} / ${_points.length}', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4), LinearProgressIndicator(value: (_currentIndex + 1) / _points.length, backgroundColor: theme.colorScheme.surface, color: theme.colorScheme.primary, minHeight: 8, borderRadius: BorderRadius.circular(4)),
          ])),
          Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6), decoration: BoxDecoration(color: theme.colorScheme.primary, borderRadius: BorderRadius.circular(20)), child: Text('${((_currentIndex + 1) / _points.length * 100).toInt()}%', style: TextStyle(color: theme.colorScheme.onPrimary, fontWeight: FontWeight.bold))),
        ])),
        Expanded(flex: 2, child: _points.isEmpty ? const Center(child: Text('لا توجد نقاط التقاط')) : GoogleMap(
          initialCameraPosition: CameraPosition(target: _points.first['gps_lat'] != null && _points.first['gps_lng'] != null ? LatLng(_points.first['gps_lat'] as double, _points.first['gps_lng'] as double) : const LatLng(24.7136, 46.6753), zoom: 18),
          myLocationEnabled: true, myLocationButtonEnabled: true,
          markers: _points.asMap().entries.map((entry) => Marker(
            markerId: MarkerId(entry.value['id'] as String),
            position: LatLng((entry.value['gps_lat'] as double?) ?? 24.7136, (entry.value['gps_lng'] as double?) ?? 46.6753),
            icon: BitmapDescriptor.defaultMarkerWithHue(_getStatus(entry.value) == 'completed' ? BitmapDescriptor.hueGreen : _getStatus(entry.value) == 'missed' ? BitmapDescriptor.hueOrange : entry.key == _currentIndex ? BitmapDescriptor.hueRed : BitmapDescriptor.hueBlue),
            infoWindow: InfoWindow(title: entry.value['name'] as String? ?? 'نقطة التقاط', snippet: _getStatus(entry.value) == 'completed' ? '✅ مكتملة' : _getStatus(entry.value) == 'missed' ? '⏸️ لم يتم التقاطها' : '⏳ معلقة'),
          )).toSet(), onMapCreated: (controller) => _mapController = controller,
        )),
        if (_currentIndex < _points.length) Container(padding: const EdgeInsets.all(16.0), decoration: BoxDecoration(color: theme.colorScheme.surface, boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 8, offset: const Offset(0, -2))]), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(width: 48, height: 48, decoration: BoxDecoration(color: _getStatusColor(_getStatus(_points[_currentIndex])), shape: BoxShape.circle), child: Center(child: Text('${_currentIndex + 1}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)))),
            const SizedBox(width: 16), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_points[_currentIndex]['name'] as String? ?? 'نقطة التقاط', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              Text(_points[_currentIndex]['description'] as String? ?? '—', style: theme.textTheme.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis),
              Text('GPS: ${_points[_currentIndex]['gps_lat']?.toStringAsFixed(6) ?? '—'}, ${_points[_currentIndex]['gps_lng']?.toStringAsFixed(6) ?? '—'}', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            ])),
          ]),
          const SizedBox(height: 16), Row(children: [
            Expanded(child: ElevatedButton.icon(onPressed: () => _markPointCompleted(_currentIndex), icon: const Icon(Icons.camera_alt), label: const Text('التقاط صورة'), style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)))),
            const SizedBox(width: 12), OutlinedButton(onPressed: () => _markPointMissed(_currentIndex), child: const Text('تخطي')),
          ]),
        ])) else Container(padding: const EdgeInsets.all(24.0), child: Column(children: [
          const Icon(Icons.check_circle, size: 64, color: Colors.green), const SizedBox(height: 16), Text('تم إكمال الجولة!', style: theme.textTheme.headlineSmall), const SizedBox(height: 8),
          Text('تم التقاط ${_points.where((p) => _getStatus(p) == 'completed').length} من ${_points.length} نقطة.', style: theme.textTheme.bodyMedium), const SizedBox(height: 16),
          ElevatedButton(onPressed: () => Navigator.pop(context), child: const Text('العودة')),
        ])),
      ]),
    );
  }

  @override void dispose() { _mapController?.dispose(); super.dispose(); }
}
