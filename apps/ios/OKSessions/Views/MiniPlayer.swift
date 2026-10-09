import MixKit
import PlayerKit
import SwiftUI

/// The now-playing bar above the tab bar.
struct MiniPlayer: View {
    @Environment(AppModel.self) private var model
    @Environment(\.tabViewBottomAccessoryPlacement) private var placement

    var body: some View {
        if let mix = model.player.current {
            HStack(spacing: 12) {
                MixArtwork(mix: mix, showsNumber: false)
                    .frame(width: 32, height: 32)
                    .clipShape(.rect(cornerRadius: 6))
                VStack(alignment: .leading, spacing: 0) {
                    Text(mix.title)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                    if placement != .inline {
                        Text(NowPlayingSubtitle(player: model.player).text)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                }
                Spacer(minLength: 0)
                PlayPauseButton(size: .small)
                if placement != .inline {
                    Button("Next", systemImage: "forward.fill") { model.player.next() }
                        .labelStyle(.iconOnly)
                        .disabled(!model.player.hasNext)
                }
            }
            .padding(.horizontal)
            .contentShape(.rect)
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("mini-player")
        }
    }
}

@MainActor
struct NowPlayingSubtitle {
    let player: PlayerController

    var text: String {
        switch player.status {
        case .loading: "Loading…"
        case .failed: "Couldn't play"
        default: "\(Formatting.time(player.currentTime)) / \(Formatting.time(player.duration))"
        }
    }
}

struct PlayPauseButton: View {
    enum Size { case small, large }
    @Environment(AppModel.self) private var model
    var size: Size

    var body: some View {
        let player = model.player
        Button(player.isPlaying ? "Pause" : "Play", systemImage: player.isPlaying ? "pause.fill" : "play.fill") {
            AudioSession.activate()
            player.togglePlayPause()
        }
        .labelStyle(.iconOnly)
        .contentTransition(.symbolEffect(.replace))
        .font(size == .large ? .system(size: 34) : .body)
        .frame(width: size == .large ? 80 : 32, height: size == .large ? 80 : 32)
        .overlay {
            if player.status == .loading || player.isBuffering {
                ProgressView().controlSize(size == .large ? .large : .small)
                    .allowsHitTesting(false)
                    .opacity(0.6)
            }
        }
        .accessibilityIdentifier("play-pause")
    }
}
