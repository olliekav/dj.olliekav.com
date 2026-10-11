package com.olliekav.oksessions

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.olliekav.oksessions.core.MixApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/**
 * New-mix notifications, as on iOS: offered once after a couple of minutes' listening (never on
 * first launch), switched with the bell, and kept in step with the server: registered while the
 * listener wants them and Android allows them, removed otherwise.
 */
class NewMixAlerts(private val context: Context, private val api: MixApi) {
    private val prefs = context.getSharedPreferences("new-mix-alerts", Context.MODE_PRIVATE)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    /** False until the Firebase project is set up (google-services.json) */
    val isAvailable: Boolean = BuildConfig.HAS_FIREBASE && FirebaseApp.getApps(context).isNotEmpty()

    var isOn by mutableStateOf(prefs.getBoolean(KEY_ON, false) && hasPermission())
        private set
    /** Show the "Get a notification when a new mix is out?" card */
    var showsPrompt by mutableStateOf(false)
        private set

    init {
        createChannel()
        // Settings may have changed while the app was closed
        sync()
    }

    fun hasPermission() = Build.VERSION.SDK_INT < 33 ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    /** Called while something's playing; offers notifications once enough has been listened to. */
    fun listened(seconds: Long) {
        if (!isAvailable || isOn || prefs.getBoolean(KEY_OFFERED, false)) return
        val total = prefs.getLong(KEY_LISTENED, 0) + seconds
        prefs.edit { putLong(KEY_LISTENED, total) }
        if (total >= PROMPT_AFTER_SECONDS) showsPrompt = true
    }

    fun dismissPrompt() {
        showsPrompt = false
        prefs.edit { putBoolean(KEY_OFFERED, true) }
    }

    /** After "Notify me" or the bell, once the system permission has been answered. */
    fun choose(on: Boolean) {
        dismissPrompt()
        prefs.edit { putBoolean(KEY_ON, on) }
        sync()
    }

    /** Registers or removes this device on the server to match what the listener wants. */
    fun sync() {
        if (!isAvailable) return
        val wanted = prefs.getBoolean(KEY_ON, false) && hasPermission()
        isOn = wanted
        scope.launch {
            runCatching {
                val token = FirebaseMessaging.getInstance().token.await()
                val registered = prefs.getString(KEY_REGISTERED, null)
                when {
                    wanted && registered != token -> {
                        registered?.let { runCatching { api.unregisterDevice(it) } }
                        api.registerDevice(token)
                        prefs.edit { putString(KEY_REGISTERED, token) }
                    }
                    !wanted && registered != null -> {
                        api.unregisterDevice(registered)
                        prefs.edit { remove(KEY_REGISTERED) }
                    }
                }
            }
        }
    }

    /** Firebase rotated the token: register the new one if notifications are on. */
    fun tokenChanged() = sync()

    private fun createChannel() {
        val channel = NotificationChannel(CHANNEL, "New mixes", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "When a new OK Sessions mix is out"
        }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    companion object {
        /** Matches channel_id in the server's FCM messages */
        const val CHANNEL = "new-mixes"
        const val EXTRA_MIX = "mix"
        private const val PROMPT_AFTER_SECONDS = 120L
        private const val KEY_ON = "on"
        private const val KEY_OFFERED = "offered"
        private const val KEY_LISTENED = "listened"
        private const val KEY_REGISTERED = "registered"
    }
}
