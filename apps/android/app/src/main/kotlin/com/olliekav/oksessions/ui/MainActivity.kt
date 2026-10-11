package com.olliekav.oksessions.ui

import android.Manifest
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.compose.LifecycleResumeEffect
import com.olliekav.oksessions.NewMixAlerts
import kotlinx.coroutines.delay
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.olliekav.oksessions.OKSessionsApp
import com.olliekav.oksessions.core.hasDarkBackground
import com.olliekav.oksessions.playback.PlayerConnection

class MainActivity : ComponentActivity() {
    /** A mix to open from a tapped notification */
    private val requestedMix = mutableStateOf<Int?>(null)

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        requestedMix.value = intent.mixNumber()
    }

    private fun Intent.mixNumber() = getStringExtra(NewMixAlerts.EXTRA_MIX)?.toIntOrNull()

    override fun onCreate(savedInstanceState: Bundle?) {
        if (savedInstanceState == null) requestedMix.value = intent.mixNumber()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val app = application as OKSessionsApp
        val alerts = app.newMixAlerts

        setContent {
            OKSessionsTheme {
                val scope = rememberCoroutineScope()
                val player = remember { PlayerConnection(applicationContext, app.library, app.api, scope) }
                val mixes by app.library.mixes.collectAsStateWithLifecycle()
                val state by app.library.state.collectAsStateWithLifecycle()
                var isPlayerOpen by rememberSaveable { mutableStateOf(false) }

                LaunchedEffect(Unit) {
                    player.connect()
                    app.library.refresh()
                }
                // Tapped a new-mix notification: play it once the list has it
                val requested by requestedMix
                LaunchedEffect(requested, mixes) {
                    val number = requested ?: return@LaunchedEffect
                    if (mixes.none { it.number == number }) {
                        app.library.refresh()
                        if (app.library.mix(number) == null) return@LaunchedEffect
                    }
                    app.library.mix(number)?.let {
                        player.play(it)
                        isPlayerOpen = true
                    }
                    requestedMix.value = null
                }
                // Listening time, for offering notifications
                LaunchedEffect(player.isPlaying) {
                    while (player.isPlaying) {
                        delay(10_000)
                        if (player.isPlaying) alerts.listened(10)
                    }
                }
                val askPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
                    alerts.choose(granted)
                    if (!granted) openNotificationSettings()
                }
                val turnOn = {
                    if (alerts.hasPermission()) alerts.choose(true)
                    else askPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
                DisposableEffect(Unit) { onDispose { player.release() } }
                BackHandler(isPlayerOpen) { isPlayerOpen = false }

                // Status bar icons follow what's under them: the mix's colour in the player
                val dark = isSystemInDarkTheme()
                val current = player.current
                LaunchedEffect(isPlayerOpen, current, dark) {
                    val lightIcons = if (isPlayerOpen && current != null) current.theme.hasDarkBackground else dark
                    enableEdgeToEdge(
                        statusBarStyle = if (lightIcons) SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
                        else SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT),
                    )
                }

                // Notifications switched on or off in Settings while away
                LifecycleResumeEffect(Unit) {
                    alerts.sync()
                    onPauseOrDispose {}
                }

                Box(Modifier.fillMaxSize()) {
                    LibraryScreen(
                        library = app.library,
                        player = player,
                        mixes = mixes,
                        state = state,
                        onOpen = { mix ->
                            player.play(mix)
                            isPlayerOpen = true
                        },
                        onShuffleAll = {
                            player.shuffleAll(mixes)
                            isPlayerOpen = true
                        },
                        bottomPadding = PaddingValues(bottom = if (current != null) 96.dp else 0.dp),
                        alertsOn = alerts.isOn.takeIf { alerts.isAvailable },
                        onToggleAlerts = { if (alerts.isOn) alerts.choose(false) else turnOn() },
                    )
                    if (alerts.showsPrompt && !isPlayerOpen) {
                        NewMixPrompt(
                            onNotNow = alerts::dismissPrompt,
                            onNotifyMe = turnOn,
                            modifier = Modifier.align(Alignment.BottomCenter).navigationBarsPadding()
                                .padding(start = 16.dp, end = 16.dp, bottom = if (current != null) 96.dp else 16.dp),
                        )
                    }
                    MiniPlayer(
                        player,
                        onOpen = { isPlayerOpen = true },
                        modifier = Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(16.dp),
                    )
                    AnimatedVisibility(
                        visible = isPlayerOpen && current != null,
                        enter = slideInVertically { it },
                        exit = slideOutVertically { it },
                    ) {
                        PlayerScreen(player, onClose = { isPlayerOpen = false })
                    }
                }
            }
        }
    }

    /** After a refusal, Android won't ask again; the switch lives in Settings */
    private fun openNotificationSettings() {
        startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName))
    }
}
