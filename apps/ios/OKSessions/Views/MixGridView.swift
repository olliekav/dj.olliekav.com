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
                    Image(systemName: isPlaying ? "waveform" : "pause.fill")
                        .symbolEffect(.variableColor.iterative, isActive: isPlaying)
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(mix.theme.foregroundColor)
                        .padding(8)
                        .glassEffect(.regular.tint(mix.theme.backgroundColor.opacity(0.6)), in: .circle)
                        .padding(8)
                }
            }
            .contentShape(.rect)
    }
}

#Preview {
    @Previewable @Namespace var transition
    MixGridView(mixes: [.preview], transition: transition)
        .environment(AppModel.shared)
}
