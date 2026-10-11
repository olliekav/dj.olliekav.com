package com.olliekav.oksessions

import android.content.ComponentName
import androidx.media3.common.Player
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaBrowser
import androidx.media3.session.SessionToken
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.olliekav.oksessions.playback.MediaItems
import com.olliekav.oksessions.playback.PlaybackService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.guava.await
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Talks to [PlaybackService] the way Android Auto does, with a MediaBrowser: browse the root,
 * list the mixes, play one. Runs against the live API.
 */
@RunWith(AndroidJUnit4::class)
class AndroidAutoTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private lateinit var browser: MediaBrowser

    @Before fun connect() = runBlocking(Dispatchers.Main) {
        val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
        browser = MediaBrowser.Builder(context, token).buildAsync().await()
    }

    @After fun disconnect() = runBlocking(Dispatchers.Main) {
        browser.stop()
        browser.release()
    }

    @Test fun browsesTheMixesAndPlaysOne() = runBlocking(Dispatchers.Main) {
        val root = browser.getLibraryRoot(null).await()
        assertEquals(LibraryResult.RESULT_SUCCESS, root.resultCode)
        assertEquals(MediaItems.ROOT_ID, root.value!!.mediaId)
        assertTrue(root.value!!.mediaMetadata.isBrowsable == true)

        val page = browser.getChildren(MediaItems.ROOT_ID, 0, 500, null).await()
        assertEquals(LibraryResult.RESULT_SUCCESS, page.resultCode)
        val mixes = page.value!!
        assertTrue("expected the playlist, got ${mixes.size}", mixes.size > 100)
        assertEquals("OK Sessions #1", mixes.first().mediaMetadata.title)
        assertTrue(mixes.all { it.mediaMetadata.isPlayable == true && it.mediaMetadata.artworkUri != null })

        // Paging, as Auto asks for big lists in pages
        val second = browser.getChildren(MediaItems.ROOT_ID, 1, 10, null).await().value!!
        assertEquals(mixes.subList(10, 20).map { it.mediaId }, second.map { it.mediaId })

        // Picking a mix queues the playlist from there and plays it
        browser.setMediaItem(mixes[1])
        browser.prepare()
        browser.play()
        withTimeout(30_000) {
            while (!browser.isPlaying) withContext(Dispatchers.Main) { delay(250) }
        }
        assertEquals(mixes[1].mediaId, browser.currentMediaItem?.mediaId)
        assertEquals(mixes.size, browser.mediaItemCount)
        assertTrue(browser.hasNextMediaItem())
        assertEquals(Player.STATE_READY, browser.playbackState)
    }
}
