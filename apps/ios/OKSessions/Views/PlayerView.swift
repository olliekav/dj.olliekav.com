import MixKit
import PlayerKit
import SwiftUI

/// The full-screen player in the mix's colours.
struct PlayerView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var showsInfo = false

    var body: some View {
        if let mix = model.player.current {
            let player = model.player
            let theme = mix.theme
            VStack(spacing: 24) {
                HStack {
                    Button("Close", systemImage: "chevron.down") { dismiss() }
                        .labelStyle(.iconOnly)
                        .buttonStyle(.glass)
                        .accessibilityIdentifier("close-player")
                    Spacer()
                    Button("About this mix", systemImage: "info.circle") { showsInfo = true }
                        .labelStyle(.iconOnly)
                        .buttonStyle(.glass)
                }

                MixArtwork(mix: mix)
                    .frame(maxWidth: 420)
                    .clipShape(.rect(cornerRadius: 24))
                    .shadow(color: .black.opacity(0.3), radius: 30, y: 12)
                    .scaleEffect(player.isPlaying ? 1 : 0.92)
                    .animation(.spring(duration: 0.5), value: player.isPlaying)
                    .layoutPriority(-1)

                VStack(alignment: .leading, spacing: 4) {
                    Text(mix.title)
                        .font(.title2.weight(.bold))
                    if let genre = mix.genre {
                        Text(genre)
                            .font(.subheadline)
                            .opacity(0.75)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                VStack(spacing: 6) {
                    WaveformView(
                        waveform: player.waveform,
                        progress: player.progress,
                        played: theme.foregroundColor,
                        unplayed: theme.foregroundColor.opacity(0.3)
                    ) { fraction in
                        player.seek(to: fraction * player.duration)
                    }
                    .frame(height: 56)
                    HStack {
                        Text(Formatting.time(player.currentTime))
                        Spacer()
                        Text("-" + Formatting.time(player.duration - player.currentTime))
                    }
                    .font(.caption.weight(.semibold))
                    .monospacedDigit()
                    .opacity(0.8)
                }

                if case .failed(let message) = player.status {
                    Label(message, systemImage: "exclamationmark.triangle")
                        .font(.footnote)
                }

                TransportControls()

                HStack {
                    Link(destination: mix.permalinkUrl) {
                        Label("Listen on SoundCloud", systemImage: "arrow.up.right")
                            .font(.footnote.weight(.semibold))
                    }
                    Spacer()
                    RoutePicker(tint: UIColor(theme.foregroundColor))
                        .frame(width: 44, height: 44)
                        .accessibilityLabel("AirPlay")
                }
            }
            .padding(24)
            .foregroundStyle(theme.foregroundColor)
            .tint(theme.foregroundColor)
            .background(theme.backgroundColor.ignoresSafeArea())
            .sheet(isPresented: $showsInfo) {
                MixInfoView(mix: mix)
                    .presentationDetents([.medium, .large])
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("player")
        } else {
            Color.clear.onAppear { dismiss() }
        }
    }
}

private struct TransportControls: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let player = model.player
        GlassEffectContainer(spacing: 16) {
            HStack(spacing: 16) {
                TransportButton(title: "Previous", systemImage: "backward.fill") { player.previous() }
                TransportButton(title: "Back \(Int(NowPlaying.skipInterval)) seconds", systemImage: "gobackward.15", glass: false) {
                    player.skip(by: -NowPlaying.skipInterval)
                }
                PlayPauseButton(size: .large)
                    .glassEffect(.regular.interactive(), in: .circle)
                TransportButton(title: "Forward \(Int(NowPlaying.skipInterval)) seconds", systemImage: "goforward.15", glass: false) {
                    player.skip(by: NowPlaying.skipInterval)
                }
                TransportButton(title: "Next", systemImage: "forward.fill") { player.next() }
                    .disabled(!player.hasNext)
            }
            .buttonStyle(.plain)
            .frame(minHeight: 80)
        }
        .controlSize(.large)
    }
}

private struct TransportButton: View {
    let title: String
    let systemImage: String
    var glass = true
    let action: () -> Void

    var body: some View {
        Button(title, systemImage: systemImage, action: action)
            .labelStyle(.iconOnly)
            .font(.title2)
            .frame(width: 56, height: 56)
            .contentShape(.circle)
            .glassEffect(glass ? .regular.interactive() : .identity, in: .circle)
    }
}

struct MixInfoView: View {
    let mix: Mix

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(Formatting.description(mix.description))
                        .textSelection(.enabled)
                    LabeledContent("Length", value: Formatting.time(mix.duration))
                    if let genre = mix.genre {
                        LabeledContent("Genre", value: genre)
                    }
                    if let plays = mix.playbackCount {
                        LabeledContent("Plays on SoundCloud", value: plays.formatted())
                    }
                    Link("Listen on SoundCloud", destination: mix.permalinkUrl)
                        .buttonStyle(.glassProminent)
                    Text("Streaming from SoundCloud.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
            }
            .navigationTitle(mix.title)
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

#Preview("Info") {
    MixInfoView(mix: .preview)
}
