import MixKit
import PlayerKit
import SwiftUI

/// The full-screen player: the artwork on the mix's colour above, the controls on a plain
/// white (or black, in dark mode) panel below. Side by side in landscape.
struct PlayerView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    @State private var showsInfo = false
    @State private var isLandscape = false

    var body: some View {
        if let mix = model.player.current {
            let theme = mix.theme
            let sideBySide = isLandscape
            let layout = sideBySide ? AnyLayout(HStackLayout(spacing: 0)) : AnyLayout(VStackLayout(spacing: 0))
            NavigationStack {
                layout {
                    // The artwork on its own colour, running to the screen edges
                    MixArtwork(mix: mix)
                        .padding(.horizontal, 24)
                        .padding(.bottom, sideBySide ? 16 : 8)
                        .frame(maxWidth: 520)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background { theme.backgroundColor.ignoresSafeArea() }
                        .layoutPriority(1)

                    // Everything else, on a plain panel
                    PlayerControls(mix: mix, compact: verticalSizeClass == .compact)
                        .padding(.horizontal, 24)
                        .padding(.vertical, verticalSizeClass == .compact ? 8 : 28)
                        .frame(maxWidth: 560)
                        .frame(maxWidth: .infinity)
                }
                .background(Color(uiColor: .systemBackground).ignoresSafeArea())
                .onGeometryChange(for: Bool.self) { $0.size.width > $0.size.height } action: { isLandscape = $0 }
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        HeaderButton(tint: theme.foregroundColor, title: "Close", systemImage: "chevron.down") { dismiss() }
                            .accessibilityIdentifier("close-player")
                    }
                    .sharedBackgroundVisibility(.hidden)
                    ToolbarItem(placement: .topBarTrailing) {
                        HeaderButton(tint: theme.foregroundColor, title: "About this mix", systemImage: "info") { showsInfo = true }
                    }
                    .sharedBackgroundVisibility(.hidden)
                }
                .navigationBarTitleDisplayMode(.inline)
                // The bar takes the mix colour; its scheme sets the status bar to black or white.
                // Side by side it spans both halves (and there's no status bar), so it's clear
                .toolbarBackground(theme.backgroundColor, for: .navigationBar)
                .toolbarBackgroundVisibility(sideBySide ? .hidden : .visible, for: .navigationBar)
                .toolbarColorScheme(theme.hasDarkBackground ? .dark : .light, for: .navigationBar)
                .foregroundStyle(.primary)
            }
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

/// Title, waveform, times, transport and footer.
private struct PlayerControls: View {
    @Environment(AppModel.self) private var model
    @Environment(\.colorScheme) private var colorScheme
    let mix: Mix
    /// Tighter, for short screens
    var compact = false

    var body: some View {
        let player = model.player
        VStack(alignment: .leading, spacing: compact ? 10 : 20) {
            VStack(alignment: .leading, spacing: 2) {
                Text(mix.title)
                    .font(.system(.title2, design: .rounded, weight: .heavy))
                if let genre = mix.genre {
                    Text(genre)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            VStack(spacing: 6) {
                WaveformView(
                    waveform: player.waveform,
                    progress: player.progress,
                    played: mix.theme.waveformColor(onDarkPanel: colorScheme == .dark),
                    unplayed: WaveformView.unplayedColor
                ) { fraction in
                    player.seek(to: fraction * player.duration)
                }
                .frame(height: compact ? 44 : 60)
                HStack {
                    Text(Formatting.time(player.currentTime))
                    Spacer()
                    Text("-" + Formatting.time(player.duration - player.currentTime))
                }
                .font(.caption.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(.secondary)
            }

            if case .failed(let message) = player.status {
                Label(message, systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            TransportControls()

            HStack {
                Link(destination: mix.permalinkUrl) {
                    Label("Listen on SoundCloud", systemImage: "arrow.up.right")
                        .font(.footnote.weight(.semibold))
                }
                .foregroundStyle(.secondary)
                Spacer()
                ShuffleButton(accent: mix.theme.waveformColor(onDarkPanel: colorScheme == .dark))
                // The picker draws its icon small; scaled up to sit with the transport controls
                RoutePicker(tint: .label)
                    .frame(width: 44, height: 44)
                    .scaleEffect(1.5)
                    .accessibilityLabel("AirPlay")
            }
        }
        .foregroundStyle(.primary)
        .tint(.primary)
    }
}

private struct TransportControls: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let player = model.player
        HStack(spacing: 0) {
            TransportButton(title: "Back \(Int(NowPlaying.skipInterval)) seconds", systemImage: "gobackward.15", size: 22) {
                player.skip(by: -NowPlaying.skipInterval)
            }
            Spacer(minLength: 0)
            // Previous, play and next grouped in the centre
            HStack(spacing: 20) {
                TransportButton(title: "Previous", systemImage: "backward.fill", size: 30) { player.previous() }
                PlayPauseButton(size: .large)
                TransportButton(title: "Next", systemImage: "forward.fill", size: 30) { player.next() }
                    .disabled(!player.hasNext)
            }
            Spacer(minLength: 0)
            TransportButton(title: "Forward \(Int(NowPlaying.skipInterval)) seconds", systemImage: "goforward.15", size: 22) {
                player.skip(by: NowPlaying.skipInterval)
            }
        }
        .buttonStyle(.plain)
        .frame(minHeight: 80)
    }
}

/// Shuffle on or off; lit up in the mix's colour when on.
private struct ShuffleButton: View {
    @Environment(AppModel.self) private var model
    let accent: Color

    var body: some View {
        let isOn = model.player.isShuffled
        Button {
            model.toggleShuffle()
        } label: {
            Image(systemName: "shuffle")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(isOn ? accent : .primary)
                .frame(width: 44, height: 44)
                .background(accent.opacity(isOn ? 0.15 : 0), in: .circle)
                .contentShape(.circle)
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.2), value: isOn)
        .accessibilityLabel("Shuffle")
        .accessibilityValue(isOn ? "On" : "Off")
        .accessibilityAddTraits(isOn ? .isSelected : [])
        .accessibilityIdentifier("shuffle")
    }
}

/// A circular glass button, the same size whatever its symbol.
private struct HeaderButton: View {
    /// The mix's logo colour, for the icon
    let tint: Color
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.title3.weight(.semibold))
                .frame(width: 44, height: 44)
                // The whole circle is tappable, not just the glyph
                .contentShape(.circle)
        }
        .buttonStyle(.plain)
        .foregroundStyle(tint)
        .glassEffect(.clear.interactive(), in: .circle)
        .accessibilityLabel(title)
    }
}

private struct TransportButton: View {
    let title: String
    let systemImage: String
    var size: CGFloat
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: size, weight: .semibold))
                .frame(width: 56, height: 56)
                .contentShape(.rect)
        }
        .accessibilityLabel(title)
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
