package com.olliekav.oksessions.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlin.math.abs
import kotlin.math.sin

private val speeds = doubleArrayOf(6.3, 8.1, 5.2, 7.4, 6.8)
private val phases = doubleArrayOf(0.4, 2.1, 0.0, 3.3, 1.2)
// Outer bars stay shorter, so the shape reads as a waveform
private val reach = doubleArrayOf(0.55, 0.85, 1.0, 0.85, 0.55)

/** Level bars for the mix that's playing, like the iOS Dynamic Island's; they settle when paused. */
@Composable
fun PlayingBars(isPlaying: Boolean, color: Color, modifier: Modifier = Modifier) {
    var time by remember { mutableLongStateOf(0L) }
    LaunchedEffect(isPlaying) {
        while (isPlaying) withFrameMillis { time = it }
    }
    Canvas(modifier.size(20.dp, 14.dp)) {
        val barWidth = 2.5.dp.toPx()
        val spacing = 2.dp.toPx()
        val seconds = time / 1000.0
        for (bar in 0 until 5) {
            val level = if (!isPlaying) reach[bar] * 0.3 else {
                val wave = sin(seconds * speeds[bar] + phases[bar]) * 0.6 + sin(seconds * speeds[bar] * 1.7 + phases[bar] * 2) * 0.4
                reach[bar] * (0.25 + 0.75 * abs(wave))
            }
            val height = maxOf(barWidth, (size.height * level).toFloat())
            drawRoundRect(
                color,
                topLeft = Offset(bar * (barWidth + spacing), (size.height - height) / 2),
                size = Size(barWidth, height),
                cornerRadius = CornerRadius(barWidth / 2),
            )
        }
    }
}
