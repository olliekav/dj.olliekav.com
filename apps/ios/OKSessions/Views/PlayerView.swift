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
            // Text and controls in the mix's lighter colour, over the darkened artwork
            let ink = theme.lighterColor
            VStack(spacing: 24) {
                HStack {
                    HeaderButton(title: "Close", systemImage: "chevron.down") { dismiss() }
                        .accessibilityIdentifier("close-player")
                    Spacer()
                    HeaderButton(title: "About this mix", systemImage: "info") { showsInfo = true }
                }

                MixArtwork(mix: mix)
                    .clipShape(.rect(cornerRadius: 24))
                    .shadow(color: .black.opacity(0.35), radius: 30, y: 12)
                    .frame(maxWidth: 420)
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
                        played: ink,
                        unplayed: .white.opacity(0.25)
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
                    RoutePicker(tint: UIColor(ink))
                        .frame(width: 44, height: 44)
                        .accessibilityLabel("AirPlay")
                }
            }
            .padding(24)
            .foregroundStyle(ink)
            .tint(ink)
            .background { BlurredArtwork(mix: mix) }
            .preferredColorScheme(.dark)
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
                    .glassEffect(.mixTinted(player.current?.theme).interactive(), in: .circle)
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

/// The artwork enlarged and blurred to fill the screen, darkened so the player reads over it.
private struct BlurredArtwork: View {
    let mix: Mix

    var body: some View {
        GeometryReader { proxy in
            let side = max(proxy.size.width, proxy.size.height) * 1.2
            MixArtwork(mix: mix)
                .frame(width: side, height: side)
                .position(x: proxy.size.width / 2, y: proxy.size.height / 2)
                .blur(radius: 60, opaque: true)
        }
        .overlay(Color.black.opacity(0.45))
        .ignoresSafeArea()
        .animation(.easeInOut(duration: 0.6), value: mix.id)
        .accessibilityHidden(true)
    }
}

/// A circular glass button, the same size whatever its symbol.
private struct HeaderButton: View {
    @Environment(AppModel.self) private var model
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.body.weight(.semibold))
                .frame(width: 44, height: 44)
                // The whole circle is tappable, not just the glyph
                .contentShape(.circle)
        }
        .buttonStyle(.plain)
        .glassEffect(.mixTinted(model.player.current?.theme).interactive(), in: .circle)
        .accessibilityLabel(title)
    }
}

extension Glass {
    /// Glass faintly tinted with the mix's foreground, so it reads against its background
    static func mixTinted(_ theme: Theme?) -> Glass {
        guard let theme else { return .regular }
        return .regular.tint(theme.lighterColor.opacity(0.18))
    }
}

private struct TransportButton: View {
    @Environment(AppModel.self) private var model
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
            .glassEffect(glass ? .mixTinted(model.player.current?.theme).interactive() : .identity, in: .circle)
    }
}

struct MixInfoView: View {
    let mix: Mix

    var body: some View {
        let description = MixDescription(mix.description)
        NavigationStack {
            List {
                if !description.intro.isEmpty {
                    Section {
                        Text(Formatting.description(description.intro))
                            .textSelection(.enabled)
                    }
                }
                if !description.tracks.isEmpty {
                    Section("Tracklist") {
                        ForEach(Array(description.tracks.enumerated()), id: \.offset) { index, track in
                            HStack(alignment: .firstTextBaseline, spacing: 12) {
                                Text("\(index + 1)")
                                    .foregroundStyle(.secondary)
                                    .monospacedDigit()
                                    .frame(minWidth: 22, alignment: .trailing)
                                Text(track)
                            }
                        }
                    }
                }
                Section {
                    LabeledContent("Length", value: Formatting.time(mix.duration))
                    if let genre = mix.genre {
                        LabeledContent("Genre", value: genre)
                    }
                    if let plays = mix.playbackCount {
                        LabeledContent("Plays on SoundCloud", value: plays.formatted())
                    }
                } footer: {
                    Text("Streaming from SoundCloud.")
                }
                Section {
                    Link(destination: mix.permalinkUrl) {
                        Label("Listen on SoundCloud", systemImage: "arrow.up.right")
                    }
                }
            }
            .navigationTitle(mix.title)
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

#Preview("Info") {
    MixInfoView(mix: .preview)
}
