package com.olliekav.oksessions.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.olliekav.oksessions.core.Formatting
import com.olliekav.oksessions.core.Mix
import com.olliekav.oksessions.core.MixDescription

/** About this mix: the intro, a numbered tracklist and the details. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MixInfoSheet(mix: Mix, onDismiss: () -> Unit) {
    val description = MixDescription.parse(mix.description)
    val secondary = LocalContentColor.current.copy(alpha = 0.6f)
    val uriHandler = LocalUriHandler.current
    ModalBottomSheet(onDismissRequest = onDismiss) {
        LazyColumn(Modifier.padding(horizontal = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item { Text(mix.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold) }
            if (description.intro.isNotEmpty()) item { Text(description.intro, style = MaterialTheme.typography.bodyMedium) }
            if (description.tracks.isNotEmpty()) {
                item { Text("Tracklist", style = MaterialTheme.typography.titleSmall, color = secondary, modifier = Modifier.padding(top = 8.dp)) }
                itemsIndexed(description.tracks) { index, track ->
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("${index + 1}", color = secondary, textAlign = TextAlign.End, modifier = Modifier.widthIn(min = 22.dp))
                        Text(track)
                    }
                }
            }
            item { HorizontalDivider(Modifier.padding(vertical = 8.dp)) }
            item { Detail("Length", Formatting.time(mix.durationSeconds)) }
            mix.genre?.let { item { Detail("Genre", it) } }
            mix.playbackCount?.let { item { Detail("Plays on SoundCloud", "%,d".format(it)) } }
            item { Text("Streaming from SoundCloud.", style = MaterialTheme.typography.bodySmall, color = secondary) }
            item {
                TextButton(onClick = { uriHandler.openUri(mix.permalinkUrl) }, modifier = Modifier.padding(bottom = 24.dp)) {
                    Text("Listen on SoundCloud")
                }
            }
        }
    }
}

@Composable
private fun Detail(label: String, value: String) {
    Row {
        Text(label, Modifier.weight(1f))
        Text(value, color = LocalContentColor.current.copy(alpha = 0.6f))
    }
}
