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
    let alerts: NewMixAlerts
    /// The full-screen player is showing
    var isPlayerPresented = false
    /// What the player zooms from: a tile's mix id, or the mini player
    var playerSource: AnyHashable = AppModel.miniPlayerSource
    static let miniPlayerSource: AnyHashable = "mini-player"

    /// Plays a mix and opens the player, zooming from its tile.
    func open(_ mix: Mix) {
        play(mix)
        playerSource = mix.id
        isPlayerPresented = true
    }

    /// Plays a mix by session number, from a tapped notification. On a cold launch the
    /// list may still be loading, or may predate the new mix, so it's loaded again if needed.
    func openMix(number: Int) async {
        if library.mixes.first(where: { $0.number == number }) == nil {
            await library.refresh()
        }
        guard let mix = library.mixes.first(where: { $0.number == number }) else { return }
        open(mix)
    }

    /// Opens the player for what's playing, zooming from the mini player.
    func openPlayer() {
        playerSource = Self.miniPlayerSource
        isPlayerPresented = true
    }

    private init() {
        let api = Self.makeAPI()
        library = MixLibrary(api: api)
        player = PlayerController(engine: AVPlayerEngine(), api: api)
        alerts = Self.makeAlerts(api: api)
        player.onChange = { [weak self] in self?.updateNowPlaying() }
        NowPlaying.registerRemoteCommands(for: player)
        AudioSession.configure(player: player)
        startNowPlayingClock()
    }

    /// Plays `mix` with the rest of the playlist queued in session order (or shuffled).
    func play(_ mix: Mix) {
        AudioSession.activate()
        player.play(mix, in: sessionOrder)
    }

    /// Plays every mix in a random order and opens the player.
    func shuffleAll() {
        AudioSession.activate()
        player.shuffle(sessionOrder)
        playerSource = player.current?.id ?? Self.miniPlayerSource
        isPlayerPresented = player.current != nil
    }

    func toggleShuffle() {
        player.setShuffle(!player.isShuffled)
    }

    private var sessionOrder: [Mix] { library.mixes.sorted { $0.number < $1.number } }

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
    /// Listening time counts towards offering new-mix notifications.
    private func startNowPlayingClock() {
        Task { [weak self] in
            let tick: TimeInterval = 5
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(tick))
                guard let self, player.isPlaying else { continue }
                updateNowPlaying()
                alerts.recordListening(tick)
            }
        }
    }

    // MARK: API

    static var isUITesting: Bool { ProcessInfo.processInfo.arguments.contains("-ui-testing") }

    private static func makeAlerts(api: MixAPI) -> NewMixAlerts {
        guard isUITesting else { return NewMixAlerts(system: SystemNotifications(), registry: api) }
        // A clean slate each launch, without the system alert; `-prompt-after <seconds>` brings the prompt forward
        let defaults = UserDefaults(suiteName: "ui-testing")!
        defaults.removePersistentDomain(forName: "ui-testing")
        let arguments = UserDefaults.standard
        let delay = arguments.object(forKey: "prompt-after") == nil ? nil : arguments.double(forKey: "prompt-after")
        let system = UITestNotifications()
        let alerts = NewMixAlerts(system: system, registry: api, defaults: defaults,
                                  promptDelay: delay ?? NewMixAlerts.defaultPromptDelay)
        system.alerts = alerts
        return alerts
    }

    private static func makeAPI() -> MixAPI {
        if isUITesting {
            return MixAPI(baseURL: URL(string: "https://stub.test")!, client: UITestHTTPClient())
        }
        let configured = (Bundle.main.object(forInfoDictionaryKey: "OKAPIBaseURL") as? String).flatMap(URL.init(string:))
        let override = ProcessInfo.processInfo.environment["OK_API_BASE_URL"].flatMap(URL.init(string:))
        return MixAPI(baseURL: override ?? configured ?? MixAPI.production)
    }
}
