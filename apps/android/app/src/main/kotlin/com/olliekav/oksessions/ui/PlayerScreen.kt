package com.olliekav.oksessions.ui

import android.content.Context
import android.content.Intent
import android.media.MediaRouter2
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.OpenInNew
import androidx.compose.material.icons.rounded.Cast
import androidx.compose.material.icons.rounded.FastForward
import androidx.compose.material.icons.rounded.FastRewind
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.Replay
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.olliekav.oksessions.core.Formatting
import com.olliekav.oksessions.core.Mix
import com.olliekav.oksessions.core.waveformColor
import com.olliekav.oksessions.playback.PlayerConnection

/**
 * The full-screen player: the artwork on the mix's colour above, the controls on a plain white
 * (or black, in dark mode) panel below. Side by side when the window is wider than it is tall.
 */
@Composable
fun PlayerScreen(player: PlayerConnection, onClose: () -> Unit) {
    val mix = player.current ?: return
    var showsInfo by rememberSaveable { mutableStateOf(false) }
    val panel = MaterialTheme.colorScheme.background

    BoxWithConstraints(Modifier.fillMaxSize().background(panel).testTag("player")) {
        val sideBySide = maxWidth > maxHeight
        val artwork: @Composable (Modifier) -> Unit = { modifier ->
            Box(modifier.background(hexColor(mix.theme.background)), contentAlignment = Alignment.Center) {
                MixArtwork(mix, Modifier.widthIn(max = 520.dp).padding(horizontal = 24.dp).padding(top = 56.dp, bottom = 8.dp).statusBarsPadding())
                HeaderButtons(mix, onClose = onClose, onInfo = { showsInfo = true }, modifier = Modifier.align(Alignment.TopCenter))
            }
        }
        val controls: @Composable (Modifier) -> Unit = { modifier ->
            Box(modifier, contentAlignment = Alignment.Center) {
                Controls(player, mix, compact = sideBySide, modifier = Modifier.widthIn(max = 560.dp).navigationBarsPadding())
            }
        }
        if (sideBySide) {
            Row(Modifier.fillMaxSize()) {
                artwork(Modifier.weight(1f).fillMaxHeight())
                controls(Modifier.weight(1f).fillMaxHeight().padding(horizontal = 24.dp, vertical = 8.dp))
            }
        } else {
            Column(Modifier.fillMaxSize()) {
                artwork(Modifier.weight(1f).fillMaxWidth())
                controls(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 28.dp))
            }
        }
    }
    if (showsInfo) MixInfoSheet(mix, onDismiss = { showsInfo = false })
}

/** Close and info: translucent circles with icons in the mix's logo colour. */
@Composable
private fun HeaderButtons(mix: Mix, onClose: () -> Unit, onInfo: () -> Unit, modifier: Modifier) {
    val colors = IconButtonDefaults.filledIconButtonColors(
        containerColor = Color.White.copy(alpha = 0.14f),
        contentColor = hexColor(mix.theme.foreground),
    )
    Row(modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 4.dp)) {
        androidx.compose.material3.FilledIconButton(onClick = onClose, colors = colors, modifier = Modifier.size(44.dp).testTag("close-player")) {
            Icon(Icons.Rounded.KeyboardArrowDown, "Close")
        }
        Spacer(Modifier.weight(1f))
        androidx.compose.material3.FilledIconButton(onClick = onInfo, colors = colors, modifier = Modifier.size(44.dp)) {
            Icon(Icons.Rounded.Info, "About this mix")
        }
    }
}

@Composable
private fun Controls(player: PlayerConnection, mix: Mix, compact: Boolean, modifier: Modifier) {
    val dark = isSystemInDarkTheme()
    val accent = hexColor(mix.theme.waveformColor(onDarkPanel = dark))
    val secondary = LocalContentColor.current.copy(alpha = 0.55f)
    val uriHandler = LocalUriHandler.current
    val context = LocalContext.current

    Column(modifier, verticalArrangement = Arrangement.spacedBy(if (compact) 10.dp else 20.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(mix.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
            mix.genre?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = secondary) }
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            WaveformBar(
                player.waveform, player.progress,
                played = accent, unplayed = if (dark) unplayedDark else unplayedLight,
                onSeek = player::seek,
                modifier = Modifier.fillMaxWidth().height(if (compact) 44.dp else 60.dp).testTag("waveform"),
            )
            Row {
                Text(Formatting.time(player.positionMs / 1000.0), style = MaterialTheme.typography.labelMedium, color = secondary)
                Spacer(Modifier.weight(1f))
                Text("-" + Formatting.time((player.durationMs - player.positionMs) / 1000.0), style = MaterialTheme.typography.labelMedium, color = secondary)
            }
        }
        player.error?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = secondary) }

        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { player.skipBack() }) { SkipIcon(forward = false) }
            Spacer(Modifier.weight(1f))
            Row(horizontalArrangement = Arrangement.spacedBy(20.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { player.previous() }, Modifier.size(56.dp)) { Icon(Icons.Rounded.FastRewind, "Previous", Modifier.size(36.dp)) }
                PlayPauseButton(player, size = 56.dp)
                IconButton(onClick = { player.next() }, enabled = player.hasNext, modifier = Modifier.size(56.dp)) {
                    Icon(Icons.Rounded.FastForward, "Next", Modifier.size(36.dp))
                }
            }
            Spacer(Modifier.weight(1f))
            IconButton(onClick = { player.skipForward() }) { SkipIcon(forward = true) }
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = { uriHandler.openUri(mix.permalinkUrl) }) {
                Icon(Icons.AutoMirrored.Rounded.OpenInNew, null, Modifier.size(16.dp), tint = secondary)
                Text("  Listen on SoundCloud", color = secondary, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.weight(1f))
            val shuffled = player.isShuffled
            IconButton(
                onClick = { player.toggleShuffle() },
                colors = IconButtonDefaults.iconButtonColors(
                    containerColor = if (shuffled) accent.copy(alpha = 0.15f) else Color.Transparent,
                    contentColor = if (shuffled) accent else LocalContentColor.current,
                ),
                modifier = Modifier.testTag("shuffle").semantics {
                    selected = shuffled
                    stateDescription = if (shuffled) "On" else "Off"
                },
            ) { Icon(Icons.Rounded.Shuffle, "Shuffle") }
            IconButton(onClick = { showOutputSwitcher(context) }) { Icon(Icons.Rounded.Cast, "Play on another device", Modifier.size(26.dp)) }
        }
    }
}

/** A circular arrow with "15": Material's skip icons only come in 5, 10 and 30. */
@Composable
private fun SkipIcon(forward: Boolean) {
    Box(contentAlignment = Alignment.Center) {
        Icon(
            Icons.Rounded.Replay,
            if (forward) "Forward 15 seconds" else "Back 15 seconds",
            Modifier.size(32.dp).graphicsLayer { scaleX = if (forward) -1f else 1f },
        )
        Text("15", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 3.dp))
    }
}

/** The system's output picker (speakers, Bluetooth, cast devices), like AirPlay's on iOS. */
private fun showOutputSwitcher(context: Context) {
    if (Build.VERSION.SDK_INT >= 34 && MediaRouter2.getInstance(context).showSystemOutputSwitcher()) return
    context.startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}
