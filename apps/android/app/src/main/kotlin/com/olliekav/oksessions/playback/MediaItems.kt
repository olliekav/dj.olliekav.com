package com.olliekav.oksessions.playback

import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.MimeTypes
import com.olliekav.oksessions.core.Mix

/** Media IDs and stream URIs for mixes, shared by the UI, the service and Android Auto. */
object MediaItems {
    const val ROOT_ID = "root"
    private const val MIX_PREFIX = "mix:"

    /** Stream URIs carry the track URN; [StreamResolver] swaps them for a fresh signed URL at load time. */
    const val STREAM_SCHEME = "oksessions"

    fun id(mix: Mix) = "$MIX_PREFIX${mix.number}"

    fun number(mediaId: String): Int? = mediaId.removePrefix(MIX_PREFIX).takeIf { mediaId.startsWith(MIX_PREFIX) }?.toIntOrNull()

    /** Just the ID: what a controller sends, since the service fills in the rest. */
    fun request(mix: Mix): MediaItem = MediaItem.Builder().setMediaId(id(mix)).build()

    /** A playable item with its stream URI and metadata, built in the service. */
    fun playable(mix: Mix): MediaItem = MediaItem.Builder()
        .setMediaId(id(mix))
        .setUri(Uri.Builder().scheme(STREAM_SCHEME).authority("stream").appendQueryParameter("urn", mix.urn).build())
        .setMimeType(MimeTypes.APPLICATION_M3U8)
        .setMediaMetadata(metadata(mix))
        .build()

    fun artworkUri(mix: Mix): Uri = Uri.Builder().scheme(STREAM_SCHEME).authority("artwork").appendPath("${mix.number}").build()

    fun metadata(mix: Mix): MediaMetadata = MediaMetadata.Builder()
        .setTitle(mix.title)
        .setDisplayTitle(mix.title)
        .setArtist("O:K")
        .setSubtitle(mix.genre)
        .setGenre(mix.genre)
        .setDurationMs(mix.durationMs)
        // Drawn only when something shows it (see ArtworkBitmapLoader), not for every queued mix
        .setArtworkUri(artworkUri(mix))
        .setIsBrowsable(false)
        .setIsPlayable(true)
        .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
        .build()
}
