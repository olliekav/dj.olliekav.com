package com.olliekav.oksessions.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.olliekav.oksessions.core.argb

/** A colour from "#RRGGBB". */
fun hexColor(hex: String) = Color(argb(hex))

/** The website's unplayed waveform bars: light grey, or near black in dark mode. */
val unplayedLight = Color(0xFFCCCCCC)
val unplayedDark = Color(0xFF262626)

@Composable
fun OKSessionsTheme(content: @Composable () -> Unit) {
    // Black and white, like the site: the colour comes from the mixes themselves
    val colors = if (isSystemInDarkTheme()) {
        darkColorScheme(
            primary = Color.White, onPrimary = Color.Black,
            background = Color.Black, surface = Color.Black, onBackground = Color.White, onSurface = Color.White,
        )
    } else {
        lightColorScheme(
            primary = Color.Black, onPrimary = Color.White,
            background = Color.White, surface = Color.White, onBackground = Color.Black, onSurface = Color.Black,
        )
    }
    MaterialTheme(colorScheme = colors, content = content)
}
