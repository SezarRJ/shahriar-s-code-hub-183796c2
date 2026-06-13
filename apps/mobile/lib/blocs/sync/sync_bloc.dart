import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';

import '../../services/sync_service.dart';

part 'sync_event.dart';
part 'sync_state.dart';

class SyncBloc extends Bloc<SyncEvent, SyncState> {
  final SyncService _syncService;

  SyncBloc({required SyncService syncService}) : _syncService = syncService, super(SyncInitial()) {
    on<SyncTriggerRequested>(_onSyncTriggerRequested);
    on<SyncStatusRequested>(_onSyncStatusRequested);
  }

  Future<void> _onSyncTriggerRequested(SyncTriggerRequested event, Emitter<SyncState> emit) async {
    emit(SyncInProgress());
    try {
      // Trigger immediate sync
      await SyncService()._triggerSync(); // Access via instance if needed
      emit(SyncSuccess());
    } catch (e) {
      emit(SyncFailure(error: e.toString()));
    }
  }

  void _onSyncStatusRequested(SyncStatusRequested event, Emitter<SyncState> emit) {
    // Sync status is managed by the service itself; UI can poll
    emit(SyncIdle());
  }
}
