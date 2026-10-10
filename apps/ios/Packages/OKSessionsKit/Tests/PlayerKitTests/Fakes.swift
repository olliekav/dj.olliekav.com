import Foundation
import MixKit
@testable import PlayerKit

@MainActor
final class FakeEngine: AudioEngine {
    var onEvent: ((AudioEngineEvent) -> Void)?
    var currentTime: TimeInterval = 0
    private(set) var loaded: [(URL, TimeInterval)] = []
    private(set) var calls: [String] = []

    func load(_ url: URL, startingAt time: TimeInterval) {
        loaded.append((url, time))
        calls.append("load")
    }
    func play() { calls.append("play") }
    func pause() { calls.append("pause") }
    func seek(to time: TimeInterval) { calls.append("seek \(Int(time))") }
    func stop() { calls.append("stop") }

    func send(_ event: AudioEngineEvent) { onEvent?(event) }
}

final class FakeAPI: PlayerAPI, @unchecked Sendable {
    var failStreams = false
    var streamCount = 0
    var waveform: Waveform? = Waveform(width: 2, height: 10, samples: [5, 10])
    var waveformCount = 0
    /// Holds stream requests open, like a slow /api/stream
    var holdStreams = false

    func stream(for mix: Mix) async throws -> MixKit.Stream {
        while holdStreams { try await Task.sleep(for: .milliseconds(5)) }
        streamCount += 1
        if failStreams { throw URLError(.notConnectedToInternet) }
        return Stream(url: URL(string: "https://cdn.test/\(mix.id)-\(streamCount).m3u8")!, format: .hlsAac160)
    }

    func waveform(for mix: Mix) async throws -> Waveform? {
        waveformCount += 1
        return waveform
    }
}

func makeMix(_ n: Int, duration: Int = 600_000) -> Mix {
    Mix(id: n, urn: "soundcloud:tracks:\(n)", number: n, slug: "ok-sessions-\(n)", title: "OK Sessions #\(n)",
        genre: "House", durationMs: duration, permalinkUrl: URL(string: "https://soundcloud.com/x/\(n)")!,
        theme: Theme(background: "#000000", foreground: "#FFFFFF", accent: "#FFFFFF", dark: true))
}

/// Lets the controller's load task run until `condition` holds.
@MainActor
func until(_ condition: () -> Bool, sourceLocation: SourceLocation = #_sourceLocation) async {
    for _ in 0..<1000 where !condition() {
        await Task.yield()
    }
}

import Testing
