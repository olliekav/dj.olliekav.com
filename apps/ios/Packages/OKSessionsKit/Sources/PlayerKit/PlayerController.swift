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
    /// Whether the queue plays in a random order; next, previous and auto-advance follow it
    public private(set) var isShuffled = false

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
    @ObservationIgnored private var waveformTask: Task<Void, Never>?
    /// Waveforms already fetched, so reopening a mix shows its waveform straight away
    @ObservationIgnored private var waveforms: [Int: Waveform] = [:]
    /// Seeks the engine hasn't finished; while any are pending, its reported times are stale
    @ObservationIgnored private var pendingSeeks = 0
    @ObservationIgnored private var playWhenReady = true
    @ObservationIgnored private var retriedStream = false
    /// The queue in session order, so shuffle can be turned off again
    @ObservationIgnored private var orderedQueue: [Mix] = []
    /// Puts mixes in a random order; replaceable so tests are predictable
    @ObservationIgnored public var shuffler: ([Mix]) -> [Mix] = { $0.shuffled() }

    /// Restart the current mix instead of going back if it has played this long
    public static let restartThreshold: TimeInterval = 3

    public init(engine: AudioEngine, api: PlayerAPI) {
        self.engine = engine
        self.api = api
        engine.onEvent = { [weak self] event in self?.handle(event) }
    }

    /// Plays `mix`, with `queue` (in order) for next/previous and auto-advance. When
    /// shuffled, the rest of the queue follows in a random order.
    public func play(_ mix: Mix, in queue: [Mix]) {
        orderedQueue = queue.contains(where: { $0.id == mix.id }) ? queue : [mix]
        if current?.id == mix.id, status != .idle {
            // Already playing: carry on, keeping the shuffled order if there is one
            if !isShuffled {
                self.queue = orderedQueue
                index = orderedQueue.firstIndex { $0.id == mix.id }
            }
            return resume()
        }
        self.queue = arranged(startingWith: mix)
        load(index: self.queue.firstIndex { $0.id == mix.id } ?? 0, autoplay: true)
    }

    /// Plays all of `mixes` in a random order.
    public func shuffle(_ mixes: [Mix]) {
        guard !mixes.isEmpty else { return }
        isShuffled = true
        orderedQueue = mixes
        queue = shuffler(mixes)
        load(index: 0, autoplay: true)
    }

    /// Turns shuffle on or off without interrupting the current mix.
    public func setShuffle(_ shuffled: Bool) {
        guard shuffled != isShuffled else { return }
        isShuffled = shuffled
        guard let mix = current else {
            queue = shuffled ? shuffler(orderedQueue) : orderedQueue
            return
        }
        queue = arranged(startingWith: mix)
        index = queue.firstIndex { $0.id == mix.id }
        onChange?()
    }

    /// The queue for playing `mix`: in session order, or `mix` then the rest shuffled.
    private func arranged(startingWith mix: Mix) -> [Mix] {
        guard isShuffled else { return orderedQueue }
        return [mix] + shuffler(orderedQueue.filter { $0.id != mix.id })
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
        pendingSeeks += 1
        engine.seek(to: clamped)
        onChange?()
    }

    public func skip(by seconds: TimeInterval) {
        seek(to: currentTime + seconds)
    }

    public func stop() {
        loadTask?.cancel()
        waveformTask?.cancel()
        engine.stop()
        pendingSeeks = 0
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
        pendingSeeks = 0
        let mix = queue[index]
        loadWaveform(for: mix)
        onChange?()

        loadTask = Task { [api, engine] in
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
        }
    }

    /// Shows the waveform as soon as it arrives, without waiting for the stream.
    private func loadWaveform(for mix: Mix) {
        waveformTask?.cancel()
        if let cached = waveforms[mix.id] {
            waveform = cached
            return
        }
        waveform = nil
        waveformTask = Task { [api] in
            guard let peaks = try? await api.waveform(for: mix), !Task.isCancelled else { return }
            self.waveforms[mix.id] = peaks
            if self.current?.id == mix.id {
                self.waveform = peaks
            }
        }
    }

    /// Fetches a fresh stream (they expire) and continues from `time`.
    private func reload(at time: TimeInterval) {
        guard let index else { return }
        load(index: index, autoplay: true, at: time)
    }

    private func handle(_ event: AudioEngineEvent) {
        switch event {
        case .ready:
            if status == .loading {
                status = playWhenReady ? .loading : .paused
            }
        case .time(let time):
            // Mid-seek the engine still reports the old position; ignore it
            if pendingSeeks == 0, status != .loading || time > 0 {
                currentTime = time
            }
        case .seeked:
            pendingSeeks = max(0, pendingSeeks - 1)
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
