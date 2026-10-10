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
                        .font(.system(size: Self.numberSize * scale, weight: .heavy, design: .rounded))
                        .foregroundStyle(foreground)
                )
                let measured = text.measure(in: CGSize(width: CGFloat.infinity, height: .infinity))
                // Sit the text's baseline where the artwork's is
                let baseline = text.firstBaseline(in: measured)
                context.draw(text, in: CGRect(
                    x: square.minX + Self.numberOrigin.x * scale,
                    y: square.minY + Self.numberOrigin.y * scale - baseline,
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
    // SF Rounded Heavy is bigger and wider than the artwork's DIN Round, so it's set a little
    // smaller and further right; the baseline rises to keep it centred on the arrow
    private static let numberSize = Logo.numberSize * 0.88
    private static let numberOrigin = CGPoint(x: Logo.numberOrigin.x + 16, y: Logo.numberOrigin.y - 6)

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
