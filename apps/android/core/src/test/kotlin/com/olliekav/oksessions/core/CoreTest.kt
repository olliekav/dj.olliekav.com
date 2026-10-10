package com.olliekav.oksessions.core

import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File

/** shared/fixtures/mixes.json: the API contract the website and iOS app test against too. */
private val fixture: String by lazy { File(System.getProperty("fixtures"), "mixes.json").readText() }
private val mixes: List<Mix> by lazy { MixApi.json.decodeFromString<MixList>(fixture).mixes }

class ModelsTest {
    @Test fun decodesTheSharedFixture() {
        assertEquals(listOf(1, 2), mixes.map { it.number })
        val first = mixes.first()
        assertEquals("soundcloud:tracks:101", first.urn)
        assertEquals("House", first.genre)
        assertNull(mixes[1].genre)
        assertTrue(first.durationSeconds > 0)
    }

    @Test fun peaksTakeTheLoudestSampleInEachBucket() {
        val waveform = Waveform(width = 4, height = 10, samples = listOf(1, 5, 10, 2))
        assertEquals(listOf(0.5, 1.0), waveform.peaks(2))
        assertEquals(List(3) { 0.0 }, Waveform(1, 10, emptyList()).peaks(3))
        assertEquals(emptyList<Double>(), waveform.peaks(0))
    }
}

class SearchTest {
    private val many = (1..20).map { mixes.first().copy(id = it.toLong(), number = it, title = "OK Sessions #$it") }

    @Test fun matchesSessionNumbersByPrefix() {
        assertEquals(listOf(1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19), search(many, "#1").map { it.number })
        assertEquals(listOf(2, 20), search(many, "2").map { it.number })
    }

    @Test fun matchesTitleAndGenreAndKeepsSessionOrder() {
        assertEquals(listOf(1), search(mixes, "house").map { it.number })
        assertEquals(listOf(1, 2), search(mixes.reversed(), "  ").map { it.number })
    }
}

class MixDescriptionTest {
    @Test fun splitsIntroAndTracklist() {
        val text = """
            Ft tracks by @paradox-music-uk @3024world

            Tracklist
            ================================
            Paradox - Trident
            1. Martyn - Hypnotoxic Laser
            02) Lutsu & Mercy System - Law
        """.trimIndent()
        assertEquals(
            MixDescription(
                "Ft tracks by @paradox-music-uk @3024world",
                listOf("Paradox - Trident", "Martyn - Hypnotoxic Laser", "Lutsu & Mercy System - Law"),
            ),
            MixDescription.parse(text),
        )
    }

    @Test fun findsABareTracklistAtTheEnd() {
        val text = "Recorded live - all vinyl.\n\nBruce - Post Rave Wrestle\nCadans - 1 Bar FU (TOOL)\nWen - BLIPS\nThanks for listening\nYak - Mido"
        val parsed = MixDescription.parse(text)
        assertEquals("Recorded live - all vinyl.", parsed.intro)
        assertEquals(5, parsed.tracks.size)
    }

    @Test fun needsThreeTracksWithoutAHeading() {
        assertTrue(MixDescription.parse("Intro\n\nA - B\nC - D").tracks.isEmpty())
        assertEquals(MixDescription("Just vibes.", emptyList()), MixDescription.parse("  Just vibes.\n"))
    }
}

class FormattingTest {
    @Test fun formatsTimesLikeTheWebsite() {
        assertEquals("0:00:00", Formatting.time(0.0))
        assertEquals("1:09:32", Formatting.time(4172.4))
        assertEquals("0:00:00", Formatting.time(Double.NaN))
    }

    @Test fun picksColumnsForTheWidth() {
        assertEquals(2, Formatting.gridColumns(412f))
        assertEquals(4, Formatting.gridColumns(834f))
        assertEquals(1, Formatting.gridColumns(150f))
    }

    @Test fun waveformKeepsTheAccentUnlessItDisappears() {
        val pinkOnPurple = Theme("#2A10A6", "#EC00A5", "#EC00A5", dark = true)
        assertEquals("#EC00A5", pinkOnPurple.waveformColor(onDarkPanel = false))
        val purpleOnYellow = Theme("#FFF100", "#652D90", "#FFF100", dark = false)
        assertEquals("#652D90", purpleOnYellow.waveformColor(onDarkPanel = false))
        assertEquals("#FFF100", purpleOnYellow.waveformColor(onDarkPanel = true))
        assertTrue(pinkOnPurple.hasDarkBackground)
        assertFalse(purpleOnYellow.hasDarkBackground)
    }

    @Test fun parsesHexColours() {
        assertEquals(0xFF2A10A6, argb("#2A10A6"))
        assertEquals(0L, argb("nope"))
    }
}

class MixApiTest {
    private lateinit var server: MockWebServer
    private lateinit var api: MixApi

    @Before fun start() {
        server = MockWebServer().apply { start() }
        api = MixApi(baseUrl = server.url("/"))
    }

    @After fun stop() = server.close()

    @Test fun loadsMixesInSessionOrder() = runTest {
        val reversed = MixApi.json.encodeToString(MixList(mixes.reversed()))
        server.enqueue(MockResponse.Builder().body(reversed).build())
        assertEquals(listOf(1, 2), api.mixes().map { it.number })
        assertEquals("/api/mixes", server.takeRequest().url.encodedPath)
    }

    @Test fun requestsAStreamByUrn() = runTest {
        server.enqueue(MockResponse.Builder().body("""{"url":"https://cdn.test/a.m3u8","format":"hls_aac_160"}""").build())
        assertEquals("https://cdn.test/a.m3u8", api.stream("soundcloud:tracks:101").url)
        assertEquals("soundcloud:tracks:101", server.takeRequest().url.queryParameter("urn"))
    }

    @Test(expected = MixApiException::class)
    fun refusesUrnsThatArentTracks() = runTest { api.stream("soundcloud:playlists:1") }

    @Test(expected = MixApiException::class)
    fun reportsServerErrors() = runTest {
        server.enqueue(MockResponse.Builder().code(502).build())
        api.mixes()
    }
}
