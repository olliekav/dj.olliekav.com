import Foundation
import MediaPlayer
import MixKit

/// What the lock screen, Control Center and CarPlay show for the player.
public enum NowPlaying {
    public static let artist = "O:K"
    public static let album = "OK Sessions"
    public static let skipInterval: TimeInterval = 15

    /// MPNowPlayingInfoCenter info for the current mix, or nil when stopped.
    @MainActor
    public static func info(for player: PlayerController) -> [String: Any]? {
        guard let mix = player.current else { return nil }
        return [
            MPMediaItemPropertyTitle: mix.title,
            MPMediaItemPropertyArtist: artist,
            MPMediaItemPropertyAlbumTitle: album,
            MPMediaItemPropertyAlbumTrackNumber: mix.number,
            MPMediaItemPropertyPlaybackDuration: mix.duration,
            MPMediaItemPropertyGenre: mix.genre ?? "",
            MPNowPlayingInfoPropertyElapsedPlaybackTime: player.currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: player.isPlaying ? 1.0 : 0.0,
            MPNowPlayingInfoPropertyDefaultPlaybackRate: 1.0,
            MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
            MPNowPlayingInfoPropertyIsLiveStream: false,
            MPNowPlayingInfoPropertyPlaybackQueueIndex: player.index ?? 0,
            MPNowPlayingInfoPropertyPlaybackQueueCount: player.queue.count
        ]
    }

    public enum Action: Equatable, Sendable {
        case play, pause, toggle, next, previous
        case seek(TimeInterval)
        case skip(TimeInterval)
    }

    /// Applies a remote command; false when it can't apply (e.g. nothing loaded).
    @MainActor @discardableResult
    public static func perform(_ action: Action, on player: PlayerController) -> Bool {
        guard player.current != nil else { return false }
        switch action {
        case .play: player.resume()
        case .pause: player.pause()
        case .toggle: player.togglePlayPause()
        case .next:
            guard player.hasNext else { return false }
            player.next()
        case .previous: player.previous()
        case .seek(let time): player.seek(to: time)
        case .skip(let seconds): player.skip(by: seconds)
        }
        return true
    }

    /// Wires the system's remote commands (headphones, lock screen, CarPlay) to the player.
    @MainActor
    public static func registerRemoteCommands(for player: PlayerController, center: MPRemoteCommandCenter = .shared()) {
        func handle(_ command: MPRemoteCommand, _ action: @escaping @MainActor (MPRemoteCommandEvent) -> Action?) {
            command.isEnabled = true
            command.addTarget { event in
                MainActor.assumeIsolated {
                    guard let action = action(event) else { return .commandFailed }
                    return perform(action, on: player) ? .success : .noActionableNowPlayingItem
                }
            }
        }
        handle(center.playCommand) { _ in .play }
        handle(center.pauseCommand) { _ in .pause }
        handle(center.togglePlayPauseCommand) { _ in .toggle }
        handle(center.nextTrackCommand) { _ in .next }
        handle(center.previousTrackCommand) { _ in .previous }
        handle(center.changePlaybackPositionCommand) { event in
            (event as? MPChangePlaybackPositionCommandEvent).map { .seek($0.positionTime) }
        }
        center.skipForwardCommand.preferredIntervals = [NSNumber(value: skipInterval)]
        center.skipBackwardCommand.preferredIntervals = [NSNumber(value: skipInterval)]
        handle(center.skipForwardCommand) { _ in .skip(skipInterval) }
        handle(center.skipBackwardCommand) { _ in .skip(-skipInterval) }
    }
}
