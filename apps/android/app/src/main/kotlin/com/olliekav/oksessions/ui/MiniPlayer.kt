package com.olliekav.oksessions.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.FastForward
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.olliekav.oksessions.core.Formatting
import com.olliekav.oksessions.playback.PlayerConnection

/** The floating now-playing bar, in the mix's colours; tap to open the full player. */
@Composable
fun MiniPlayer(player: PlayerConnection, onOpen: () -> Unit, modifier: Modifier = Modifier) {
    val mix = player.current ?: return
    val foreground = hexColor(mix.theme.foreground)
    Surface(
        color = hexColor(mix.theme.background),
        contentColor = foreground,
        shape = CircleShape,
        shadowElevation = 8.dp,
        modifier = modifier.fillMaxWidth().testTag("mini-player"),
    ) {
        Row(
            Modifier.clickable(onClickLabel = "Open player", onClick = onOpen).padding(start = 8.dp, end = 12.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            MixArtwork(mix, Modifier.size(40.dp).clip(CircleShape), showsNumber = false)
            Column(Modifier.weight(1f)) {
                Text(mix.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    when {
                        player.error != null -> "Couldn't play"
                        player.isLoading && player.positionMs == 0L -> "Loading…"
                        else -> "${Formatting.time(player.positionMs / 1000.0)} / ${Formatting.time(mix.durationSeconds)}"
                    },
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = foreground.copy(alpha = 0.75f),
                )
            }
            PlayPauseButton(player, size = 32.dp)
            IconButton(onClick = { player.next() }, enabled = player.hasNext) { Icon(Icons.Rounded.FastForward, "Next") }
        }
    }
}

/** Play/pause; while loading, a spinner takes its place rather than sitting on top of it. */
@Composable
fun PlayPauseButton(player: PlayerConnection, size: Dp, modifier: Modifier = Modifier) {
    Box(modifier.size(size + 16.dp), contentAlignment = Alignment.Center) {
        if (player.isLoading) {
            CircularProgressIndicator(Modifier.size(size * 0.7f), color = LocalContentColor.current, strokeWidth = 2.dp)
        } else {
            IconButton(onClick = { player.togglePlayPause() }, modifier = Modifier.size(size + 16.dp).testTag("play-pause")) {
                Icon(
                    if (player.isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                    if (player.isPlaying) "Pause" else "Play",
                    Modifier.size(size),
                )
            }
        }
    }
}
