package com.olliekav.oksessions

import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.olliekav.oksessions.ui.MainActivity

/**
 * Receives new-mix pushes. In the background Android shows them itself and opens the app with
 * the `mix` extra; while the app's open they arrive here and are shown the same way.
 */
class PushService : FirebaseMessagingService() {
    private val app get() = application as OKSessionsApp

    override fun onNewToken(token: String) = app.newMixAlerts.tokenChanged()

    override fun onMessageReceived(message: RemoteMessage) {
        val notification = message.notification ?: return
        val mix = message.data[NewMixAlerts.EXTRA_MIX]?.toIntOrNull() ?: return
        val open = PendingIntent.getActivity(
            this, mix,
            Intent(this, MainActivity::class.java).putExtra(NewMixAlerts.EXTRA_MIX, mix.toString())
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val built = NotificationCompat.Builder(this, NewMixAlerts.CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(notification.title)
            .setContentText(notification.body)
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        if (app.newMixAlerts.hasPermission()) {
            @Suppress("MissingPermission")
            NotificationManagerCompat.from(this).notify("mix-$mix", 0, built)
        }
    }
}
