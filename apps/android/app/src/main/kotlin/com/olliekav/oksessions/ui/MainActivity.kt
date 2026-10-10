package com.olliekav.oksessions.ui

import android.os.Bundle
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
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val app = application as OKSessionsApp

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
                    )
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
}
