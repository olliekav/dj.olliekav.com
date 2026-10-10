package com.olliekav.oksessions.playback

import android.content.ComponentName
import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.olliekav.oksessions.MixLibrary
import com.olliekav.oksessions.core.Mix
import com.olliekav.oksessions.core.MixApi
import com.olliekav.oksessions.core.Waveform
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.guava.await
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/** The UI's view of playback: a MediaController on [PlaybackService], as Compose state. */
class PlayerConnection(
    private val context: Context,
    private val library: MixLibrary,
    private val api: MixApi,
    private val scope: CoroutineScope,
) {
    private var controller: MediaController? = null
    private var ticker: Job? = null
    private val waveforms = mutableMapOf<Int, Waveform>()
    /** The mix just asked for, shown until the service reports it, so the player opens at once */
    private var pending: Mix? = null

    var current by mutableStateOf<Mix?>(null)
        private set
    var isPlaying by mutableStateOf(false)
        private set
    /** Waiting for the stream, at the start or after a seek */
    var isLoading by mutableStateOf(false)
        private set
    var isShuffled by mutableStateOf(false)
        private set
    var hasNext by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var positionMs by mutableLongStateOf(0L)
        private set
    var waveform by mutableStateOf<Waveform?>(null)
        private set

    val durationMs: Long get() = current?.durationMs ?: 0L
    val progress: Float get() = if (durationMs > 0) (positionMs.toFloat() / durationMs).coerceIn(0f, 1f) else 0f

    private val listener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) = sync(player)
    }

    suspend fun connect() {
        if (controller != null) return
        val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
        controller = MediaController.Builder(context, token).buildAsync().await().also {
            it.addListener(listener)
            sync(it)
        }
        // Position isn't an event; poll it while connected
        ticker = scope.launch {
            while (isActive) {
                if (pending == null) controller?.let { positionMs = it.currentPosition.coerceAtLeast(0) }
                delay(250)
            }
        }
    }

    fun release() {
        ticker?.cancel()
        controller?.removeListener(listener)
        controller?.release()
        controller = null
    }

    /** Plays [mix] with the rest of the playlist queued (in session order, or shuffled if on). */
    fun play(mix: Mix) {
        val player = controller ?: return
        if (current?.number == mix.number && player.playbackState != Player.STATE_IDLE) {
            player.play()
            return
        }
        // Show it now; the service takes a moment to queue the playlist and report back
        pending = mix
        show(mix)
        isLoading = true
        isPlaying = false
        positionMs = 0
        error = null
        player.setMediaItem(MediaItems.request(mix))
        player.prepare()
        player.play()
    }

    /** Plays every mix in a random order. */
    fun shuffleAll(mixes: List<Mix>) {
        val player = controller ?: return
        if (mixes.isEmpty()) return
        player.shuffleModeEnabled = true
        play(mixes.random())
    }

    fun togglePlayPause() {
        val player = controller ?: return
        if (player.isPlaying) player.pause() else {
            if (player.playbackState == Player.STATE_IDLE) player.prepare()
            player.play()
        }
    }

    fun next() = controller?.seekToNextMediaItem()
    /** Restarts the mix, or the previous one if near the start (Media3's default: 3s). */
    fun previous() = controller?.seekToPrevious()
    fun skipBack() = controller?.seekBack()
    fun skipForward() = controller?.seekForward()
    fun seek(fraction: Float) {
        val target = (durationMs * fraction).toLong()
        positionMs = target
        controller?.seekTo(target)
    }
    fun toggleShuffle() {
        controller?.let { it.shuffleModeEnabled = !it.shuffleModeEnabled }
    }

    private fun sync(player: Player) {
        val reported = player.currentMediaItem?.mediaId?.let(MediaItems::number)?.let(library::mix)
        val waiting = pending
        if (waiting != null && reported?.number != waiting.number && player.playerError == null) {
            // The service hasn't caught up with the mix just picked; keep showing it as loading
            return
        }
        pending = null
        show(reported)
        isPlaying = player.isPlaying
        isLoading = player.playbackState == Player.STATE_BUFFERING
        isShuffled = player.shuffleModeEnabled
        hasNext = player.hasNextMediaItem()
        error = player.playerError?.let { "Couldn't play this mix." }
        if (player.duration != C.TIME_UNSET) positionMs = player.currentPosition.coerceAtLeast(0)
    }

    private fun show(mix: Mix?) {
        if (mix?.number == current?.number) return
        current = mix
        loadWaveform(mix)
    }

    /** Shown as soon as it arrives, and kept so reopening a mix shows it straight away. */
    private fun loadWaveform(mix: Mix?) {
        waveform = mix?.let { waveforms[it.number] }
        if (mix == null || waveform != null) return
        scope.launch {
            val peaks = runCatching { api.waveform(mix) }.getOrNull() ?: return@launch
            waveforms[mix.number] = peaks
            if (current?.number == mix.number) waveform = peaks
        }
    }
}
