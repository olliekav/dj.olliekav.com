package com.olliekav.oksessions.core

import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

object Formatting {
    /** H:MM:SS, as on the website. */
    fun time(seconds: Double): String {
        if (!seconds.isFinite() || seconds <= 0) return "0:00:00"
        val total = seconds.toLong()
        return "%d:%02d:%02d".format(total / 3600, total % 3600 / 60, total % 60)
    }

    /** Columns for a width in dp, one per ~185dp: two on phones in portrait, more on tablets. */
    fun gridColumns(widthDp: Float, minimumTileWidth: Float = 185f): Int =
        if (!widthDp.isFinite() || widthDp <= 0) 2 else max(1, (widthDp / minimumTileWidth).toInt())
}

/** "#RRGGBB" as 0xAARRGGBB; transparent if malformed. */
fun argb(hex: String): Long {
    val value = hex.removePrefix("#")
    val rgb = if (value.length == 6) value.toLongOrNull(16) else null
    return if (rgb == null) 0L else 0xFF000000L or rgb
}

/** Relative luminance (WCAG) of "#RRGGBB"; null if malformed. */
fun luminance(hex: String): Double? {
    val value = hex.removePrefix("#")
    val rgb = (if (value.length == 6) value.toLongOrNull(16) else null) ?: return null
    fun linear(channel: Long): Double {
        val c = channel / 255.0
        return if (c <= 0.04045) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)
    }
    return 0.2126 * linear(rgb shr 16 and 0xFF) + 0.7152 * linear(rgb shr 8 and 0xFF) + 0.0722 * linear(rgb and 0xFF)
}

/** Whether the background is dark, so the status bar and controls should be light. */
val Theme.hasDarkBackground: Boolean get() = (luminance(background) ?: 1.0) < 0.179

/**
 * The colour for the played part of the waveform on a plain white (or black) panel: the accent,
 * like the website, unless it nearly disappears there; then whichever theme colour stands out more.
 */
fun Theme.waveformColor(onDarkPanel: Boolean): String {
    val panel = if (onDarkPanel) 0.0 else 1.0
    fun contrast(hex: String): Double {
        val l = luminance(hex) ?: 0.5
        return (max(l, panel) + 0.05) / (min(l, panel) + 0.05)
    }
    if (contrast(accent) >= 2) return accent
    return if (contrast(foreground) >= contrast(background)) foreground else background
}

/** The OK logo (ring and chevron) as SVG path data, on a 1024-unit canvas like the artwork. */
object Logo {
    const val CANVAS = 1024f
    const val RING =
        "M512 962C263.87 962 62 760.13 62 512C62 263.87 263.87 62 512 62C760.13 62 962 263.87 962 512C962 760.13 760.13 962 512 962ZM512 154.44C314.84 154.44 154.44 314.84 154.44 512C154.44 709.16 314.84 869.56 512 869.56C709.16 869.56 869.56 709.16 869.56 512C869.56 314.84 709.16 154.44 512 154.44Z"
    const val CHEVRON =
        "M511.26 715.481C499.43 715.481 487.6 710.971 478.58 701.941L321.32 544.681C312.65 536.011 307.78 524.261 307.78 512.001C307.78 499.741 312.65 487.981 321.32 479.321L478.58 322.061C496.63 304.011 525.89 304.011 543.95 322.061C562 340.111 562 369.381 543.95 387.431L419.37 512.011L543.95 636.591C562 654.641 562 683.911 543.95 701.961C534.93 710.981 523.09 715.501 511.27 715.501L511.26 715.481Z"

    /** Where "#<number>" sits: left edge and baseline, and its size (tuned for a rounded system font, as on iOS). */
    const val NUMBER_X = 497f + 16f
    const val NUMBER_BASELINE = 558.5f - 6f
    const val NUMBER_SIZE = 140f * 0.88f
}
