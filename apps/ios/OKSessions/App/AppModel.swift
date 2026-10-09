import MediaPlayer
import MixKit
import PlayerKit
import SwiftUI

/// App-wide state, shared by the phone UI and the CarPlay scene.
@MainActor
@Observable
final class AppModel {
    static let shared = AppModel()

    let library: MixLibrary
    let player: PlayerController
    /// The full-screen player is showing
    var isPlayerPresented = false

    private init() {
        let api = Self.makeAPI()
        library = MixLibrary(api: api)
        player = PlayerController(engine: AVPlayerEngine(), api: api)
        player.onChange = { [weak self] in self?.updateNowPlaying() }
        NowPlaying.registerRemoteCommands(for: player)
        AudioSession.configure(player: player)
        startNowPlayingClock()
    }

    /// Plays `mix` with the rest of the playlist queued in session order.
    func play(_ mix: Mix) {
        AudioSession.activate()
        player.play(mix, in: library.mixes.sorted { $0.number < $1.number })
    }

    // MARK: Lock screen, Control Center and CarPlay

    private var artworkFor: (id: Int, artwork: MPMediaItemArtwork)?

    func updateNowPlaying() {
        guard var info = NowPlaying.info(for: player), let mix = player.current else {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            MPNowPlayingInfoCenter.default().playbackState = .stopped
            return
        }
        if artworkFor?.id != mix.id, let image = MixArtwork.image(for: mix, size: 600) {
            artworkFor = (mix.id, Self.artwork(image))
        }
        info[MPMediaItemPropertyArtwork] = artworkFor?.artwork
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        MPNowPlayingInfoCenter.default().playbackState = player.isPlaying ? .playing : .paused
    }

    /// MediaPlayer calls the handler on its own queue, so it mustn't inherit main-actor isolation.
    nonisolated private static func artwork(_ image: UIImage) -> MPMediaItemArtwork {
        MPMediaItemArtwork(boundsSize: image.size) { @Sendable _ in image }
    }

    /// Elapsed time is extrapolated by the system while playing; resync it now and then.
    private func startNowPlayingClock() {
        Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(5))
                if self?.player.isPlaying == true { self?.updateNowPlaying() }
            }
        }
    }

    // MARK: API

    private static func makeAPI() -> MixAPI {
        if ProcessInfo.processInfo.arguments.contains("-ui-testing") {
            return MixAPI(baseURL: URL(string: "https://stub.test")!, client: UITestHTTPClient())
        }
        let configured = (Bundle.main.object(forInfoDictionaryKey: "OKAPIBaseURL") as? String).flatMap(URL.init(string:))
        let override = ProcessInfo.processInfo.environment["OK_API_BASE_URL"].flatMap(URL.init(string:))
        return MixAPI(baseURL: override ?? configured ?? MixAPI.production)
    }
}
