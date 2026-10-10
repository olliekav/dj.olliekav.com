package com.olliekav.oksessions.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.core.graphics.PathParser
import androidx.core.graphics.createBitmap
import com.olliekav.oksessions.core.Logo
import com.olliekav.oksessions.core.Mix
import com.olliekav.oksessions.core.argb

/**
 * Draws a mix's artwork natively: the OK logo and "#<number>" in the theme's colours, like the
 * SoundCloud artwork. One renderer for the app's views, the notification and Android Auto.
 */
object ArtworkRenderer {
    private val logo: Path by lazy {
        Path().apply {
            addPath(PathParser.createPathFromPathData(Logo.RING).apply { fillType = Path.FillType.EVEN_ODD })
            addPath(PathParser.createPathFromPathData(Logo.CHEVRON))
        }
    }
    private val numberTypeface: Typeface = Typeface.create(Typeface.DEFAULT, 900, false)

    fun draw(canvas: Canvas, mix: Mix, size: Float, showsNumber: Boolean = true) {
        val scale = size / Logo.CANVAS
        // Fill just the square: drawColor would flood whatever the canvas is clipped to
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = argb(mix.theme.background).toInt() }
        canvas.drawRect(0f, 0f, size, size, paint)
        paint.color = argb(mix.theme.foreground).toInt()
        canvas.save()
        canvas.scale(scale, scale)
        canvas.drawPath(logo, paint)
        if (showsNumber) {
            paint.typeface = numberTypeface
            paint.textSize = Logo.NUMBER_SIZE
            canvas.drawText("#${mix.number}", Logo.NUMBER_X, Logo.NUMBER_BASELINE, paint)
        }
        canvas.restore()
    }

    fun bitmap(mix: Mix, size: Int): Bitmap = createBitmap(size, size).also { draw(Canvas(it), mix, size.toFloat()) }
}

@Composable
fun MixArtwork(mix: Mix, modifier: Modifier = Modifier, showsNumber: Boolean = true) {
    Canvas(modifier.aspectRatio(1f).clipToBounds()) {
        drawIntoCanvas { ArtworkRenderer.draw(it.nativeCanvas, mix, size.minDimension, showsNumber) }
    }
}
