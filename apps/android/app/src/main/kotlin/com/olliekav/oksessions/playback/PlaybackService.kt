package com.olliekav.oksessions.playback

import android.app.PendingIntent
import android.content.Intent
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSession.MediaItemsWithStartPosition
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.ListenableFuture
import com.olliekav.oksessions.OKSessionsApp
import com.olliekav.oksessions.core.MixApi
import com.olliekav.oksessions.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.guava.future

/**
 * Plays the mixes in the background: ExoPlayer streaming SoundCloud's HLS, a media session for
 * the notification, lock screen and Bluetooth controls, and a browse tree for Android Auto.
 */
class PlaybackService : MediaLibraryService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val app get() = application as OKSessionsApp
    private var session: MediaLibrarySession? = null

    override fun onCreate() {
        super.onCreate()
        val player = ExoPlayer.Builder(this)
            .setMediaSourceFactory(HlsMediaSource.Factory(StreamResolver.factory(app.api, OkHttpDataSource.Factory(app.http))))
            .setAudioAttributes(
                AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(),
                /* handleAudioFocus = */ true,
            )
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .setSeekBackIncrementMs(SKIP_MS)
            .setSeekForwardIncrementMs(SKIP_MS)
            .build()
        val openApp = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        session = MediaLibrarySession.Builder(this, player, Callback())
            .setSessionActivity(openApp)
            .build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo) = session

    /** Stop with the app when it's swiped away while paused; keep playing otherwise. */
    override fun onTaskRemoved(rootIntent: Intent?) {
        val player = session?.player
        if (player == null || !player.playWhenReady || player.mediaItemCount == 0) stopSelf()
    }

    override fun onDestroy() {
        session?.run {
            player.release()
            release()
        }
        session = null
        scope.cancel()
        super.onDestroy()
    }

    private inner class Callback : MediaLibrarySession.Callback {
        private val root = MediaItem.Builder()
            .setMediaId(MediaItems.ROOT_ID)
            .setMediaMetadata(
                MediaMetadata.Builder().setTitle("O:K Sessions").setIsBrowsable(true).setIsPlayable(false)
                    .setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_MIXED).build(),
            )
            .build()

        override fun onGetLibraryRoot(
            session: MediaLibrarySession, browser: MediaSession.ControllerInfo, params: LibraryParams?,
        ): ListenableFuture<LibraryResult<MediaItem>> = scope.future { LibraryResult.ofItem(root, params) }

        /** Android Auto's list: every mix, #1 first. */
        override fun onGetChildren(
            session: MediaLibrarySession, browser: MediaSession.ControllerInfo, parentId: String,
            page: Int, pageSize: Int, params: LibraryParams?,
        ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> = scope.future {
            if (parentId != MediaItems.ROOT_ID) return@future LibraryResult.ofError(LibraryResult.RESULT_ERROR_BAD_VALUE)
            val items = app.library.ensureLoaded().map(MediaItems::playable)
            val from = (page * pageSize).coerceAtMost(items.size)
            LibraryResult.ofItemList(items.subList(from, (from + pageSize).coerceAtMost(items.size)), params)
        }

        override fun onGetItem(
            session: MediaLibrarySession, browser: MediaSession.ControllerInfo, mediaId: String,
        ): ListenableFuture<LibraryResult<MediaItem>> = scope.future {
            app.library.ensureLoaded()
            MediaItems.number(mediaId)?.let(app.library::mix)?.let { LibraryResult.ofItem(MediaItems.playable(it), null) }
                ?: LibraryResult.ofError(LibraryResult.RESULT_ERROR_BAD_VALUE)
        }

        /**
         * Controllers (the app, Android Auto) send only media IDs. Picking one mix queues the whole
         * playlist in session order from there, so next, previous and auto-advance work everywhere.
         */
        override fun onSetMediaItems(
            mediaSession: MediaSession, controller: MediaSession.ControllerInfo,
            mediaItems: MutableList<MediaItem>, startIndex: Int, startPositionMs: Long,
        ): ListenableFuture<MediaItemsWithStartPosition> = scope.future {
            val mixes = app.library.ensureLoaded()
            val requested = mediaItems.mapNotNull { item -> MediaItems.number(item.mediaId)?.let(app.library::mix) }
            if (requested.size == 1) {
                val start = mixes.indexOfFirst { it.number == requested.single().number }
                MediaItemsWithStartPosition(mixes.map(MediaItems::playable), start, startPositionMs)
            } else {
                MediaItemsWithStartPosition(requested.map(MediaItems::playable), startIndex.coerceAtLeast(0), startPositionMs)
            }
        }

        override fun onAddMediaItems(
            mediaSession: MediaSession, controller: MediaSession.ControllerInfo, mediaItems: MutableList<MediaItem>,
        ): ListenableFuture<MutableList<MediaItem>> = scope.future {
            app.library.ensureLoaded()
            mediaItems.mapNotNull { item -> MediaItems.number(item.mediaId)?.let(app.library::mix)?.let(MediaItems::playable) }
                .toMutableList()
        }
    }

    companion object {
        const val SKIP_MS = 15_000L
    }
}

/**
 * Swaps `oksessions://stream?urn=…` for a fresh signed HLS URL from /api/stream when the player
 * loads it, so stream URLs (which expire, and count towards SoundCloud's daily limit) are only
 * requested for mixes that actually play. The playlists' segment URLs are absolute.
 */
object StreamResolver {
    fun factory(api: MixApi, upstream: OkHttpDataSource.Factory) = ResolvingDataSource.Factory(upstream) { spec: DataSpec ->
        val uri = spec.uri
        if (uri.scheme != MediaItems.STREAM_SCHEME) return@Factory spec
        val urn = uri.getQueryParameter("urn") ?: return@Factory spec
        spec.withUri(android.net.Uri.parse(api.streamBlocking(urn).url))
    }
}
