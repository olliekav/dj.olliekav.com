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
                        .padding(16)
                }
            }
            .contentShape(.rect)
    }
}

/// Bouncing level bars for the mix that's playing, like Music's; they settle when paused.
struct PlayingBars: View {
    var isPlaying: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // Each bar moves at its own pace so they never fall into step
    private static let speeds: [Double] = [5.1, 7.3, 4.4, 6.2]
    private static let phases: [Double] = [0, 1.7, 3.1, 0.9]
    private static let resting: [Double] = [0.35, 0.6, 0.45, 0.3]

    var body: some View {
        TimelineView(.animation(paused: !isPlaying || reduceMotion)) { context in
            let time = context.date.timeIntervalSinceReferenceDate
            HStack(alignment: .bottom, spacing: 2.5) {
                ForEach(0..<4, id: \.self) { bar in
                    RoundedRectangle(cornerRadius: 1.5)
                        .frame(width: 3.5, height: 18 * level(bar, at: time))
                }
            }
            .frame(width: 22, height: 18, alignment: .bottom)
        }
        .accessibilityHidden(true)
    }

    private func level(_ bar: Int, at time: TimeInterval) -> Double {
        guard isPlaying, !reduceMotion else { return Self.resting[bar] }
        let speed = Self.speeds[bar], phase = Self.phases[bar]
        // Two sines at different rates read as music rather than a metronome
        let wave = sin(time * speed + phase) * 0.6 + sin(time * speed * 1.7 + phase * 2) * 0.4
        return 0.2 + 0.8 * abs(wave)
    }
}

#Preview {
    @Previewable @Namespace var transition
    MixGridView(mixes: [.preview], transition: transition)
        .environment(AppModel.shared)
}
