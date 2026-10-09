import MixKit
import SwiftUI

/// SoundCloud's waveform as bars, filled up to the playhead; drag or tap to seek.
struct WaveformView: View {
    let waveform: Waveform?
    let progress: Double
    let played: Color
    let unplayed: Color
    var onSeek: (Double) -> Void

    @State private var dragProgress: Double?
    @State private var width: CGFloat = 1

    var body: some View {
        Canvas { context, size in
            let barWidth: CGFloat = 3
            let gap: CGFloat = 2
            let count = max(1, Int(size.width / (barWidth + gap)))
            let peaks = waveform?.peaks(count: count) ?? Array(repeating: 0.08, count: count)
            let shown = dragProgress ?? progress
            for (i, peak) in peaks.enumerated() {
                let height = max(2, CGFloat(peak) * size.height)
                let rect = CGRect(x: CGFloat(i) * (barWidth + gap), y: (size.height - height) / 2, width: barWidth, height: height)
                let isPlayed = Double(i) / Double(count) < shown
                context.fill(Path(roundedRect: rect, cornerRadius: barWidth / 2), with: .color(isPlayed ? played : unplayed))
            }
        }
        .contentShape(.rect)
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { value in dragProgress = fraction(at: value.location.x) }
                .onEnded { value in
                    onSeek(fraction(at: value.location.x))
                    dragProgress = nil
                }
        )
        .accessibilityElement()
        .accessibilityLabel("Position")
        .accessibilityValue("\(Int(progress * 100)) percent")
        .accessibilityAdjustableAction { direction in
            onSeek(min(1, max(0, progress + (direction == .increment ? 0.02 : -0.02))))
        }
        .accessibilityIdentifier("waveform")
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
    }

    private func fraction(at x: CGFloat) -> Double {
        Double(min(1, max(0, x / max(width, 1))))
    }
}
