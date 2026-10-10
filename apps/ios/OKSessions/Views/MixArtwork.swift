import MixKit
import SwiftUI
import UIKit

/// The mix's artwork, drawn natively: the OK logo and "#<number>" in the theme's colours,
/// laid out like the SoundCloud artwork. Square; fills its frame.
struct MixArtwork: View {
    let mix: Mix
    var showsNumber = true

    var body: some View {
        Canvas { context, size in
            // A centred square, whatever space the canvas is given
            let side = min(size.width, size.height)
            let square = CGRect(x: (size.width - side) / 2, y: (size.height - side) / 2, width: side, height: side)
            let scale = side / Logo.canvas
            let foreground = mix.theme.foregroundColor

            context.fill(Path(square), with: .color(mix.theme.backgroundColor))
            context.fill(LogoShape().path(in: square), with: .color(foreground))

            if showsNumber {
                let text = context.resolve(
                    Text(verbatim: "#\(mix.number)")
                        .font(.system(size: Logo.numberSize * scale, weight: .heavy, design: .rounded))
                        .foregroundStyle(foreground)
                )
                let measured = text.measure(in: CGSize(width: CGFloat.infinity, height: .infinity))
                // Sit the text's baseline where the artwork's is
                let baseline = text.firstBaseline(in: measured)
                context.draw(text, in: CGRect(
                    x: square.minX + Logo.numberOrigin.x * scale,
                    y: square.minY + Logo.numberOrigin.y * scale - baseline,
                    width: measured.width,
                    height: measured.height
                ))
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityHidden(true)
    }

    /// Rendered artwork for the lock screen and CarPlay.
    @MainActor
    static func image(for mix: Mix, size: CGFloat) -> UIImage? {
        let renderer = ImageRenderer(content: MixArtwork(mix: mix).frame(width: size, height: size))
        renderer.scale = 1
        return renderer.uiImage
    }
}

#Preview {
    MixArtwork(mix: .preview)
        .frame(width: 300)
}
