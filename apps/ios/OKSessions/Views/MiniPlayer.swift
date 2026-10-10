import MixKit
import PlayerKit
import SwiftUI

/// The floating now-playing bar; tap to open the full player.
struct MiniPlayer: View {
    @Environment(AppModel.self) private var model
    var open: () -> Void

    var body: some View {
        if let mix = model.player.current {
            HStack(spacing: 12) {
                // The glass is interactive, so opening needs a real button inside it
                Button(action: open) {
                    HStack(spacing: 12) {
                        MixArtwork(mix: mix, showsNumber: false)
                            .frame(width: 40, height: 40)
                            .clipShape(.rect(cornerRadius: 8))
                        VStack(alignment: .leading, spacing: 1) {
                            Text(mix.title)
                                .font(.subheadline.weight(.semibold))
                                .lineLimit(1)
                            Text(NowPlayingSubtitle(player: model.player).text)
                                .font(.caption)
                                .opacity(0.75)
                                .monospacedDigit()
                        }
                        Spacer(minLength: 0)
                    }
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Open player, \(mix.title)")
                .accessibilityIdentifier("open-player")
                PlayPauseButton(size: .small)
                Button("Next", systemImage: "forward.fill") { model.player.next() }
                    .labelStyle(.iconOnly)
                    .frame(width: 32, height: 32)
                    .disabled(!model.player.hasNext)
            }
            // In the mix's colours: glass tinted with its background, content in its foreground
            .foregroundStyle(mix.theme.foregroundColor)
            .tint(mix.theme.foregroundColor)
            .padding(.leading, 8)
            .padding(.trailing, 16)
            .padding(.vertical, 8)
            .contentShape(.capsule)
            .glassEffect(.regular.tint(mix.theme.backgroundColor.opacity(0.8)).interactive(), in: .capsule)
            .animation(.easeInOut(duration: 0.4), value: mix.id)
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
        .font(size == .large ? .system(size: 34) : .title3)
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
