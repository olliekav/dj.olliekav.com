import Foundation
import MixKit
import Observation

/// Loads streams and waveforms for the player; `MixAPI` in the app.
public protocol PlayerAPI: Sendable {
    func stream(for mix: Mix) async throws -> MixKit.Stream
    func waveform(for mix: Mix) async throws -> Waveform?
}

extension MixAPI: PlayerAPI {}

/// The app's playback state: a queue of mixes, the current one, and transport controls.
@MainActor
@Observable
public final class PlayerController {
    public enum Status: Equatable, Sendable {
        case idle
        case loading
        case playing
        case paused
        case failed(String)
    }

    public private(set) var queue: [Mix] = []
    public private(set) var index: Int?
    public private(set) var status: Status = .idle
    public private(set) var isBuffering = false
    public private(set) var currentTime: TimeInterval = 0
    public private(set) var waveform: Waveform?

    public var current: Mix? { index.map { queue[$0] } }
    public var duration: TimeInterval { current?.duration ?? 0 }
    public var isPlaying: Bool { status == .playing }
    public var hasNext: Bool { index.map { $0 < queue.count - 1 } ?? false }
    public var hasPrevious: Bool { index.map { $0 > 0 } ?? false }
    public var progress: Double { duration > 0 ? min(1, currentTime / duration) : 0 }

    /// Called whenever what's playing changes, for the lock screen and CarPlay
    @ObservationIgnored public var onChange: (() -> Void)?

    @ObservationIgnored private let engine: AudioEngine
    @ObservationIgnored private let api: PlayerAPI
    @ObservationIgnored private var loadTask: Task<Void, Never>?
    @ObservationIgnored private var playWhenReady = true
    @ObservationIgnored private var retriedStream = false

    /// Restart the current mix instead of going back if it has played this long
    public static let restartThreshold: TimeInterval = 3

    public init(engine: AudioEngine, api: PlayerAPI) {
        self.engine = engine
        self.api = api
        engine.onEvent = { [weak self] event in self?.handle(event) }
    }

    /// Plays `mix`, with `queue` (in order) for next/previous and auto-advance.
    public func play(_ mix: Mix, in queue: [Mix]) {
        self.queue = queue.isEmpty ? [mix] : queue
        guard let position = self.queue.firstIndex(where: { $0.id == mix.id }) else {
            self.queue = [mix]
            return load(index: 0, autoplay: true)
        }
        if position == index, status != .idle {
            return resume()
        }
        load(index: position, autoplay: true)
    }

    public func togglePlayPause() {
        isPlaying ? pause() : resume()
    }

    public func resume() {
        guard index != nil else { return }
        switch status {
        case .paused:
            engine.play()
        case .failed:
            reload(at: currentTime)
        default:
            playWhenReady = true
        }
    }

    public func pause() {
        playWhenReady = false
        engine.pause()
        if status == .playing || status == .loading {
            status = .paused
        }
        onChange?()
    }

    public func next() {
        guard let index, index < queue.count - 1 else { return }
        load(index: index + 1, autoplay: true)
    }

    /// Back to the start of the mix, or the previous mix if near the start.
    public func previous() {
        guard let index else { return }
        if currentTime > Self.restartThreshold || index == 0 {
            seek(to: 0)
        } else {
            load(index: index - 1, autoplay: true)
        }
    }

    public func seek(to time: TimeInterval) {
        let clamped = min(max(0, time), duration)
        currentTime = clamped
        engine.seek(to: clamped)
        onChange?()
    }

    public func skip(by seconds: TimeInterval) {
        seek(to: currentTime + seconds)
    }

    public func stop() {
        loadTask?.cancel()
        engine.stop()
        index = nil
        status = .idle
        currentTime = 0
        waveform = nil
        onChange?()
    }

    private func load(index: Int, autoplay: Bool, at time: TimeInterval = 0) {
        loadTask?.cancel()
        self.index = index
        status = .loading
        currentTime = time
        playWhenReady = autoplay
        retriedStream = false
        waveform = nil
        onChange?()

        let mix = queue[index]
        loadTask = Task { [api, engine] in
            async let waveform = try? api.waveform(for: mix)
            do {
                let stream = try await api.stream(for: mix)
                guard !Task.isCancelled else { return }
                engine.load(stream.url, startingAt: time)
                if self.playWhenReady { engine.play() }
            } catch {
                guard !Task.isCancelled else { return }
                self.status = .failed(error.localizedDescription)
                self.onChange?()
            }
            let peaks = await waveform
            if !Task.isCancelled, self.current?.id == mix.id {
                self.waveform = peaks ?? nil
            }
        }
    }

    /// Fetches a fresh stream (they expire) and continues from `time`.
    private func reload(at time: TimeInterval) {
        guard let index else { return }
        let waveform = self.waveform
        load(index: index, autoplay: true, at: time)
        self.waveform = waveform
    }

    private func handle(_ event: AudioEngineEvent) {
        switch event {
        case .ready:
            if status == .loading {
                status = playWhenReady ? .loading : .paused
            }
        case .time(let time):
            if status != .loading || time > 0 {
                currentTime = time
            }
        case .playing(let playing):
            if playing {
                status = .playing
            } else if status == .playing {
                status = .paused
            }
            onChange?()
        case .buffering(let buffering):
            isBuffering = buffering
        case .finished:
            if hasNext {
                next()
            } else {
                status = .paused
                seek(to: 0)
            }
        case .failed(let message):
            // Signed stream URLs expire; get a fresh one once before giving up
            if !retriedStream, index != nil {
                retriedStream = true
                let time = engine.currentTime > 0 ? engine.currentTime : currentTime
                reload(at: time)
                retriedStream = true
            } else {
                status = .failed(message)
                onChange?()
            }
        }
    }
}
