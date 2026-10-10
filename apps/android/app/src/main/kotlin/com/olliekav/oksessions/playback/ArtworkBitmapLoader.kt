package com.olliekav.oksessions.playback

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.LruCache
import androidx.media3.common.util.BitmapLoader
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.ListeningExecutorService
import com.google.common.util.concurrent.MoreExecutors
import com.olliekav.oksessions.MixLibrary
import com.olliekav.oksessions.ui.ArtworkRenderer
import java.util.concurrent.Executors

/**
 * Draws a mix's artwork for `oksessions://artwork/<number>` when the notification, lock screen or
 * Android Auto asks for it, off the main thread, keeping the last few.
 */
class ArtworkBitmapLoader(private val library: MixLibrary) : BitmapLoader {
    private val executor: ListeningExecutorService = MoreExecutors.listeningDecorator(Executors.newSingleThreadExecutor())
    private val cache = LruCache<Int, Bitmap>(8)

    override fun supportsMimeType(mimeType: String) = mimeType.startsWith("image/")

    override fun decodeBitmap(data: ByteArray): ListenableFuture<Bitmap> = executor.submit<Bitmap> {
        BitmapFactory.decodeByteArray(data, 0, data.size) ?: error("Not an image")
    }

    override fun loadBitmap(uri: Uri): ListenableFuture<Bitmap> {
        val number = uri.lastPathSegment?.toIntOrNull()
        if (uri.scheme != MediaItems.STREAM_SCHEME || uri.authority != "artwork" || number == null) {
            return Futures.immediateFailedFuture(IllegalArgumentException("Unknown artwork $uri"))
        }
        cache.get(number)?.let { return Futures.immediateFuture(it) }
        return executor.submit<Bitmap> {
            val mix = library.mix(number) ?: error("No mix #$number")
            ArtworkRenderer.bitmap(mix, SIZE).also { cache.put(number, it) }
        }
    }

    companion object {
        const val SIZE = 512
    }
}
