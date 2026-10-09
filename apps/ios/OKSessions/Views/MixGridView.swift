import MixKit
import SwiftUI

/// All sessions as a grid of artwork tiles, newest first.
struct MixGridView: View {
    @Environment(AppModel.self) private var model
    var mixes: [Mix]

    private let columns = [GridItem(.adaptive(minimum: 150, maximum: 260), spacing: 2)]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 2) {
            ForEach(mixes) { mix in
                MixTile(mix: mix, isCurrent: model.player.current?.id == mix.id, isPlaying: model.player.isPlaying)
                    .onTapGesture { model.play(mix) }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(mix.title), \(Formatting.time(mix.duration))\(mix.genre.map { ", \($0)" } ?? "")")
                    .accessibilityAddTraits(.isButton)
                    .accessibilityIdentifier("mix-\(mix.number)")
            }
        }
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
                        .glassEffect(.regular, in: .circle)
                        .padding(8)
                }
            }
            .contentShape(.rect)
    }
}

#Preview {
    MixGridView(mixes: [.preview])
        .environment(AppModel.shared)
}
