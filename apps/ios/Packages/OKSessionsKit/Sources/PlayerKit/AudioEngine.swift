import AVFoundation
import Foundation

public enum AudioEngineEvent: Equatable, Sendable {
    /// The item is ready to play
    case ready
    case time(TimeInterval)
    /// Actually producing sound (false while paused or buffering)
    case playing(Bool)
    case buffering(Bool)
    /// A seek has completed (or was superseded); times reported before this are stale
    case seeked
    case finished
    case failed(String)
}

/// Plays one URL at a time. AVPlayer in the app; a fake in tests.
@MainActor
public protocol AudioEngine: AnyObject {
    var onEvent: ((AudioEngineEvent) -> Void)? { get set }
    var currentTime: TimeInterval { get }
    func load(_ url: URL, startingAt time: TimeInterval)
    func play()
    func pause()
    func seek(to time: TimeInterval)
    func stop()
}

/// AVPlayer-backed engine; plays SoundCloud's HLS streams natively.
@MainActor
public final class AVPlayerEngine: AudioEngine {
    public var onEvent: ((AudioEngineEvent) -> Void)?
    public let player = AVPlayer()
    private var timeObserver: Any?
    private var statusObservation: NSKeyValueObservation?
    private var itemObservation: NSKeyValueObservation?
    private var endObserver: NSObjectProtocol?

    public init() {
        player.automaticallyWaitsToMinimizeStalling = true
        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.5, preferredTimescale: 600),
            queue: .main
        ) { [weak self] time in
            MainActor.assumeIsolated { self?.onEvent?(.time(time.seconds)) }
        }
        statusObservation = player.observe(\.timeControlStatus, options: [.new]) { [weak self] player, _ in
            let status = player.timeControlStatus
            Task { @MainActor in
                self?.onEvent?(.playing(status == .playing))
                self?.onEvent?(.buffering(status == .waitingToPlayAtSpecifiedRate))
            }
        }
    }

    public var currentTime: TimeInterval {
        let seconds = player.currentTime().seconds
        return seconds.isFinite ? seconds : 0
    }

    public func load(_ url: URL, startingAt time: TimeInterval) {
        let item = AVPlayerItem(url: url)
        itemObservation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            let status = item.status
            let message = item.error?.localizedDescription ?? "Playback failed"
            Task { @MainActor in
                switch status {
                case .readyToPlay: self?.onEvent?(.ready)
                case .failed: self?.onEvent?(.failed(message))
                default: break
                }
            }
        }
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        endObserver = NotificationCenter.default.addObserver(
            forName: AVPlayerItem.didPlayToEndTimeNotification, object: item, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.onEvent?(.finished) }
        }
        player.replaceCurrentItem(with: item)
        if time > 0 {
            player.seek(to: CMTime(seconds: time, preferredTimescale: 600))
        }
    }

    public func play() { player.play() }
    public func pause() { player.pause() }

    public func seek(to time: TimeInterval) {
        player.seek(
            to: CMTime(seconds: max(0, time), preferredTimescale: 600),
            toleranceBefore: .zero,
            toleranceAfter: .zero
        ) { [weak self] _ in
            Task { @MainActor in self?.onEvent?(.seeked) }
        }
    }

    public func stop() {
        player.pause()
        player.replaceCurrentItem(with: nil)
    }
}
