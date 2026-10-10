package com.olliekav.oksessions

import android.app.Application
import com.olliekav.oksessions.core.Mix
import com.olliekav.oksessions.core.MixApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient

class OKSessionsApp : Application() {
    val http = OkHttpClient()
    val api by lazy { MixApi(BuildConfig.API_BASE_URL.toHttpUrl(), http) }
    val library by lazy { MixLibrary(api) }
}

/** The list of mixes, shared by the UI and the playback service (Android Auto browses it too). */
class MixLibrary(private val api: MixApi) {
    sealed interface State {
        data object Idle : State
        data object Loading : State
        data object Loaded : State
        data class Failed(val message: String) : State
    }

    private val _mixes = MutableStateFlow<List<Mix>>(emptyList())
    val mixes: StateFlow<List<Mix>> = _mixes.asStateFlow()
    private val _state = MutableStateFlow<State>(State.Idle)
    val state: StateFlow<State> = _state.asStateFlow()

    /** Loads the mixes; on failure keeps any already loaded. */
    suspend fun refresh() {
        if (_mixes.value.isEmpty()) _state.value = State.Loading
        try {
            _mixes.value = api.mixes()
            _state.value = State.Loaded
        } catch (e: Exception) {
            _state.value = State.Failed(e.message ?: "Couldn't load the mixes.")
        }
    }

    /** Loads once if nothing's loaded yet (for the playback service and Android Auto). */
    suspend fun ensureLoaded(): List<Mix> {
        if (_mixes.value.isEmpty()) refresh()
        return _mixes.value
    }

    fun mix(number: Int): Mix? = _mixes.value.firstOrNull { it.number == number }
}
