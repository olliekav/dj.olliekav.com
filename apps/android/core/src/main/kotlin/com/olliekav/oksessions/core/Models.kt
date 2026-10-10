package com.olliekav.oksessions.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** A mix's two-colour theme ("#RRGGBB"), as in shared/mix-themes.json. */
@Serializable
data class Theme(
    val background: String,
    val foreground: String,
    val accent: String,
    /** The accent is the foreground (the background is the darker, plainer colour) */
    val dark: Boolean,
)

/** An OK Sessions mix: a track in the SoundCloud playlist plus its theme. Mirrors `Mix` in shared/api-types.ts. */
@Serializable
data class Mix(
    val id: Long,
    /** SoundCloud track URN, used to request a stream */
    val urn: String,
    /** Position in the playlist, which is the session number */
    val number: Int,
    val slug: String,
    val title: String,
    val description: String = "",
    val genre: String? = null,
    @SerialName("duration_ms") val durationMs: Long,
    @SerialName("published_at") val publishedAt: String? = null,
    @SerialName("artwork_url") val artworkUrl: String? = null,
    @SerialName("artwork_original_url") val artworkOriginalUrl: String? = null,
    @SerialName("waveform_url") val waveformUrl: String? = null,
    /** The track on SoundCloud, for attribution */
    @SerialName("permalink_url") val permalinkUrl: String,
    @SerialName("playback_count") val playbackCount: Long? = null,
    val theme: Theme,
) {
    val durationSeconds: Double get() = durationMs / 1000.0
}

@Serializable
data class MixList(val mixes: List<Mix>)

/** A short-lived HLS URL from /api/stream. */
@Serializable
data class Stream(val url: String, val format: String)

/** SoundCloud's waveform JSON. */
@Serializable
data class Waveform(val width: Int, val height: Int, val samples: List<Int>) {
    /** [count] peaks between 0 and 1, taking the maximum within each bucket. */
    fun peaks(count: Int): List<Double> {
        if (count <= 0) return emptyList()
        if (samples.isEmpty() || height <= 0) return List(count) { 0.0 }
        return List(count) { bar ->
            val start = bar * samples.size / count
            val end = maxOf(start + 1, (bar + 1) * samples.size / count).coerceAtMost(samples.size)
            samples.subList(start, end).max().toDouble() / height
        }
    }
}
