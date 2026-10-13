package com.olliekav.oksessions.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.unit.dp
import com.olliekav.oksessions.core.Waveform

/** SoundCloud's waveform as bars, filled up to the playhead; tap or drag to seek. */
@Composable
fun WaveformBar(
    waveform: Waveform?,
    progress: Float,
    played: Color,
    unplayed: Color,
    onSeek: (Float) -> Unit,
    modifier: Modifier = Modifier,
) {
    var dragProgress by remember { mutableStateOf<Float?>(null) }
    Canvas(
        modifier
            .semantics {
                contentDescription = "Position"
                progressBarRangeInfo = ProgressBarRangeInfo(progress, 0f..1f)
                setProgress { onSeek(it.coerceIn(0f, 1f)); true }
            }
            .pointerInput(Unit) { detectTapGestures { onSeek((it.x / size.width).coerceIn(0f, 1f)) } }
            .pointerInput(Unit) {
                detectHorizontalDragGestures(
                    onDragEnd = { dragProgress?.let(onSeek); dragProgress = null },
                    onDragCancel = { dragProgress = null },
                ) { change, _ -> dragProgress = (change.position.x / size.width).coerceIn(0f, 1f) }
            },
    ) {
        // Matches the website's wavesurfer bars: 2dp with a 1dp gap, scaled to the loudest peak,
        // and centred, with any space left over split between the two ends
        val barWidth = 2.dp.toPx()
        val gap = 1.dp.toPx()
        val count = maxOf(1, ((size.width + gap) / (barWidth + gap)).toInt())
        val inset = (size.width - (count * (barWidth + gap) - gap)) / 2
        val raw = waveform?.peaks(count) ?: List(count) { 0.08 }
        val loudest = raw.maxOrNull() ?: 0.0
        val peaks = if (loudest > 0) raw.map { it / loudest } else raw
        val shown = dragProgress ?: progress
        peaks.forEachIndexed { i, peak ->
            val height = maxOf(2.dp.toPx(), peak.toFloat() * size.height)
            drawRoundRect(
                color = if (i.toFloat() / count < shown) played else unplayed,
                topLeft = Offset(inset + i * (barWidth + gap), (size.height - height) / 2),
                size = Size(barWidth, height),
                cornerRadius = CornerRadius(1.dp.toPx()),
            )
        }
    }
}
