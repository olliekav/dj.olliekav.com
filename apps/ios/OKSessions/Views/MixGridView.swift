import MixKit
import SwiftUI

/// All sessions as a grid of artwork tiles, newest first.
struct MixGridView: View {
    @Environment(AppModel.self) private var model
    var mixes: [Mix]
    var transition: Namespace.ID

    @State private var width: CGFloat = 0

    private var columns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 0), count: GridLayout.columns(for: width))
    }

    var body: some View {
        LazyVGrid(columns: columns, spacing: 0) {
            ForEach(mixes) { mix in
                MixTile(mix: mix, isCurrent: model.player.current?.id == mix.id, isPlaying: model.player.isPlaying)
                    .matchedTransitionSource(id: mix.id, in: transition)
                    .onTapGesture { model.open(mix) }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(mix.title), \(Formatting.time(mix.duration))\(mix.genre.map { ", \($0)" } ?? "")")
                    .accessibilityAddTraits(.isButton)
                    .accessibilityIdentifier("mix-\(mix.number)")
            }
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
    }
}

struct MixTile: View {
    let mix: Mix
    var isCurrent = false
    var isPlaying = false

    var body: some View {
        MixArtwork(mix: mix)
            .overlay(alignment: .topTrailing) {
                if isCurrent {
                    PlayingBars(isPlaying: isPlaying)
                        .foregroundStyle(mix.theme.foregroundColor)
                        .shadow(color: .black.opacity(0.25), radius: 3, y: 1)
                        .padding(10)
                }
            }
            .contentShape(.rect)
    }
}

/// Level bars for the mix that's playing, like the Dynamic Island's: thin bars that swell
/// from the middle, the outer ones shorter. They settle when paused.
struct PlayingBars: View {
    var isPlaying: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // Each bar moves at its own pace so they never fall into step
    private static let speeds: [Double] = [6.3, 8.1, 5.2, 7.4, 6.8]
    private static let phases: [Double] = [0.4, 2.1, 0, 3.3, 1.2]
    // Outer bars stay shorter, so the shape reads as a waveform
    private static let reach: [Double] = [0.55, 0.85, 1, 0.85, 0.55]
    private static let height: CGFloat = 14

    var body: some View {
        TimelineView(.animation(paused: !isPlaying || reduceMotion)) { context in
            let time = context.date.timeIntervalSinceReferenceDate
            HStack(alignment: .center, spacing: 2) {
                ForEach(0..<5, id: \.self) { bar in
                    Capsule()
                        .frame(width: 2.5, height: max(2.5, Self.height * level(bar, at: time)))
                }
            }
            .frame(width: 20, height: Self.height)
        }
        .accessibilityHidden(true)
    }

    private func level(_ bar: Int, at time: TimeInterval) -> Double {
        let reach = Self.reach[bar]
        guard isPlaying, !reduceMotion else { return reach * 0.3 }
        let speed = Self.speeds[bar], phase = Self.phases[bar]
        // Two sines at different rates read as music rather than a metronome
        let wave = sin(time * speed + phase) * 0.6 + sin(time * speed * 1.7 + phase * 2) * 0.4
        return reach * (0.25 + 0.75 * abs(wave))
    }
}

#Preview {
    @Previewable @Namespace var transition
    MixGridView(mixes: [.preview], transition: transition)
        .environment(AppModel.shared)
}
