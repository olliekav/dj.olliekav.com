package com.olliekav.oksessions.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.material3.Typography
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import com.olliekav.oksessions.core.argb

/** A colour from "#RRGGBB". */
fun hexColor(hex: String) = Color(argb(hex))

/**
 * Nunito, a rounded sans like iOS's SF Rounded (the artwork's DIN Round can't be bundled).
 * One variable font file in assets, with each weight picked on its wght axis.
 */
@OptIn(ExperimentalTextApi::class)
@Composable
private fun nunito(): FontFamily {
    val assets = LocalContext.current.assets
    return remember(assets) {
        FontFamily(
            listOf(FontWeight.Normal, FontWeight.Medium, FontWeight.SemiBold, FontWeight.Bold, FontWeight.ExtraBold, FontWeight.Black)
                .map { weight ->
                    Font(NUNITO, assets, weight, variationSettings = FontVariation.Settings(FontVariation.weight(weight.weight)))
                },
        )
    }
}

const val NUNITO = "fonts/Nunito.ttf"

/** Every Material text style in Nunito, a touch heavier, as rounded faces read light. */
private fun Typography.rounded(family: FontFamily) = Typography(
    displayLarge = displayLarge.copy(fontFamily = family),
    displayMedium = displayMedium.copy(fontFamily = family),
    displaySmall = displaySmall.copy(fontFamily = family),
    headlineLarge = headlineLarge.copy(fontFamily = family, fontWeight = FontWeight.ExtraBold),
    headlineMedium = headlineMedium.copy(fontFamily = family, fontWeight = FontWeight.ExtraBold),
    headlineSmall = headlineSmall.copy(fontFamily = family, fontWeight = FontWeight.ExtraBold),
    titleLarge = titleLarge.copy(fontFamily = family, fontWeight = FontWeight.Bold),
    titleMedium = titleMedium.copy(fontFamily = family, fontWeight = FontWeight.Bold),
    titleSmall = titleSmall.copy(fontFamily = family, fontWeight = FontWeight.Bold),
    bodyLarge = bodyLarge.copy(fontFamily = family, fontWeight = FontWeight.Medium),
    bodyMedium = bodyMedium.copy(fontFamily = family, fontWeight = FontWeight.Medium),
    bodySmall = bodySmall.copy(fontFamily = family, fontWeight = FontWeight.Medium),
    labelLarge = labelLarge.copy(fontFamily = family, fontWeight = FontWeight.Bold),
    labelMedium = labelMedium.copy(fontFamily = family, fontWeight = FontWeight.Bold),
    labelSmall = labelSmall.copy(fontFamily = family, fontWeight = FontWeight.Bold),
)

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
    MaterialTheme(colorScheme = colors, typography = Typography().rounded(nunito()), content = content)
}
