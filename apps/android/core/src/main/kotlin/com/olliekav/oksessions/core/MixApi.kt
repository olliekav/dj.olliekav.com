package com.olliekav.oksessions.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException

class MixApiException(message: String) : IOException(message)

/** Client for dj.olliekav.com/api: the mix list, streams and SoundCloud waveforms. */
class MixApi(
    val baseUrl: HttpUrl = PRODUCTION,
    private val client: OkHttpClient = OkHttpClient(),
) {
    /** Mixes in session order. */
    suspend fun mixes(): List<Mix> =
        get<MixList>(baseUrl.newBuilder().addPathSegments("api/mixes").build()).mixes.sortedBy { it.number }

    /** A fresh HLS URL for the mix. Request it when playback starts: URLs expire after a few hours. */
    suspend fun stream(urn: String): Stream {
        if (!urn.startsWith("soundcloud:tracks:")) throw MixApiException("That isn't an OK Sessions mix.")
        return get(baseUrl.newBuilder().addPathSegments("api/stream").addQueryParameter("urn", urn).build())
    }

    suspend fun waveform(mix: Mix): Waveform? = mix.waveformUrl?.let { get(it.toHttpUrl()) }

    /** Registers this device's FCM token for new-mix notifications. */
    suspend fun registerDevice(token: String) = send("POST", token, platform = "android")

    /** Stops new-mix notifications for this device. */
    suspend fun unregisterDevice(token: String) = send("DELETE", token, platform = null)

    private suspend fun send(method: String, token: String, platform: String?) = withContext(Dispatchers.IO) {
        val body = json.encodeToString(DeviceRegistration(token, platform)).toRequestBody(JSON)
        val request = Request.Builder().url(baseUrl.newBuilder().addPathSegments("api/devices").build()).method(method, body).build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw MixApiException("The server returned an error (${response.code}).")
        }
    }

    /** Blocking version of [stream], for Media3's loader threads. */
    fun streamBlocking(urn: String): Stream = kotlinx.coroutines.runBlocking { stream(urn) }

    private suspend inline fun <reified T> get(url: HttpUrl): T = withContext(Dispatchers.IO) {
        client.newCall(Request.Builder().url(url).build()).execute().use { response ->
            if (!response.isSuccessful) throw MixApiException("The server returned an error (${response.code}).")
            json.decodeFromString<T>(response.body.string())
        }
    }

    companion object {
        val PRODUCTION = "https://dj.olliekav.com".toHttpUrl()
        val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
        private val JSON = "application/json".toMediaType()
    }
}
