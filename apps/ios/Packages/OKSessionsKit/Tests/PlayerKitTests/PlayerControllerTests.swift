import Foundation
import MediaPlayer
import MixKit
import Testing
@testable import PlayerKit

@MainActor
@Suite("PlayerController")
struct PlayerControllerTests {
    let engine = FakeEngine()
    let api = FakeAPI()
    let mixes = [makeMix(1), makeMix(2), makeMix(3)]

    func player() -> PlayerController { PlayerController(engine: engine, api: api) }

    @Test func playsAMixFromAFreshStream() async {
        let player = player()
        var changes = 0
        player.onChange = { changes += 1 }
        player.play(mixes[1], in: mixes)

        #expect(player.status == .loading)
        #expect(player.current?.id == 2)
        await until { engine.loaded.count == 1 && player.waveform != nil }
        #expect(engine.loaded.first?.0.absoluteString == "https://cdn.test/2-1.m3u8")
        #expect(engine.calls == ["load", "play"])
        #expect(player.waveform == api.waveform)
        #expect(changes > 0)

        engine.send(.ready)
        engine.send(.playing(true))
        #expect(player.status == .playing)
        #expect(player.isPlaying)
    }

    @Test func tracksTimeAndBuffering() async {
        let player = player()
        player.play(mixes[0], in: mixes)
        await until { !engine.loaded.isEmpty }
        engine.send(.playing(true))
        engine.send(.time(120))
        engine.send(.buffering(true))
        #expect(player.currentTime == 120)
        #expect(player.progress == 0.2)
        #expect(player.isBuffering)
    }

    @Test func pausesResumesAndToggles() async {
        let player = player()
        player.play(mixes[0], in: mixes)
        await until { !engine.loaded.isEmpty }
        engine.send(.playing(true))

        player.togglePlayPause()
        #expect(player.status == .paused)
        #expect(engine.calls.last == "pause")
        engine.send(.playing(false))
        #expect(player.status == .paused)

        player.togglePlayPause()
        #expect(engine.calls.last == "play")
        engine.send(.playing(true))
        #expect(player.status == .playing)
    }

    @Test func tappingTheCurrentMixResumesInsteadOfReloading() async {
        let player = player()
        player.play(mixes[0], in: mixes)
        await until { !engine.loaded.isEmpty }
        engine.send(.playing(true))
        player.pause()
        player.play(mixes[0], in: mixes)
        #expect(engine.loaded.count == 1)
        #expect(engine.calls.last == "play")
    }

    @Test func movesThroughTheQueue() async {
        let player = player()
        player.play(mixes[0], in: mixes)
        #expect(!player.hasPrevious)
        #expect(player.hasNext)
        player.next()
        #expect(player.current?.id == 2)
        player.next()
        player.next() // already last
        #expect(player.current?.id == 3)
        #expect(!player.hasNext)
    }

    @Test func previousRestartsUnlessNearTheStart() async {
        let player = player()
        player.play(mixes[1], in: mixes)
        await until { !engine.loaded.isEmpty }
        engine.send(.time(30))
        player.previous()
        #expect(player.current?.id == 2)
        #expect(engine.calls.last == "seek 0")

        engine.send(.time(1))
        player.previous()
        #expect(player.current?.id == 1)

        // At the first mix, previous always restarts
        player.previous()
        #expect(player.current?.id == 1)
    }

    @Test func autoAdvancesAndStopsAfterTheLastMix() async {
        let player = player()
        player.play(mixes[1], in: mixes)
        engine.send(.finished)
        #expect(player.current?.id == 3)
        engine.send(.finished)
        #expect(player.current?.id == 3)
        #expect(player.status == .paused)
        #expect(player.currentTime == 0)
    }

    @Test func seeksWithinTheMix() async {
        let player = player()
        player.play(mixes[0], in: mixes)
        player.seek(to: 9999)
        #expect(player.currentTime == 600)
        player.seek(to: 100)
        player.skip(by: -15)
        #expect(player.currentTime == 85)
        player.skip(by: -500)
        #expect(player.currentTime == 0)
    }

    @Test func refetchesAnExpiredStreamOnceFromTheSamePosition() async {
        let player = player()
        player.play(mixes[0], in: mixes)
        await until { engine.loaded.count == 1 }
        engine.send(.playing(true))
        engine.currentTime = 1800

        engine.send(.failed("403"))
        await until { engine.loaded.count == 2 }
        #expect(engine.loaded.last?.0.absoluteString == "https://cdn.test/1-2.m3u8")
        #expect(engine.loaded.last?.1 == 1800)

        engine.send(.failed("403"))
        #expect(player.status == .failed("403"))
    }

    @Test func retriesAFailedMixWhenResumed() async {
        let player = player()
        api.failStreams = true
        player.play(mixes[0], in: mixes)
        await until { if case .failed = player.status { true } else { false } }
        #expect(engine.loaded.isEmpty)

        api.failStreams = false
        player.resume()
        await until { !engine.loaded.isEmpty }
        #expect(engine.loaded.count == 1)
    }

    @Test func staysPausedWhenLoadedWithoutAutoplay() async {
        let player = player()
        player.play(mixes[0], in: mixes)
        player.pause()
        engine.send(.ready)
        #expect(player.status == .paused)
    }

    @Test func playsAMixMissingFromTheQueueOnItsOwn() async {
        let player = player()
        player.play(makeMix(9), in: mixes)
        #expect(player.queue.map(\.id) == [9])
        player.play(makeMix(8), in: [])
        #expect(player.queue.map(\.id) == [8])
    }

    @Test func stopsAndClears() async {
        let player = player()
        player.play(mixes[0], in: mixes)
        player.stop()
        #expect(player.current == nil)
        #expect(player.status == .idle)
        #expect(engine.calls.last == "stop")
        player.resume() // nothing to resume
        #expect(engine.calls.last == "stop")
    }
}

@MainActor
@Suite("NowPlaying")
struct NowPlayingTests {
    @Test func describesTheCurrentMix() async {
        let engine = FakeEngine()
        let player = PlayerController(engine: engine, api: FakeAPI())
        #expect(NowPlaying.info(for: player) == nil)

        player.play(makeMix(2), in: [makeMix(1), makeMix(2)])
        await until { !engine.loaded.isEmpty }
        engine.send(.playing(true))
        engine.send(.time(42))
        let info = try! #require(NowPlaying.info(for: player))
        #expect(info[MPMediaItemPropertyTitle] as? String == "OK Sessions #2")
        #expect(info[MPMediaItemPropertyArtist] as? String == "O:K")
        #expect(info[MPMediaItemPropertyAlbumTitle] as? String == "OK Sessions")
        #expect(info[MPMediaItemPropertyPlaybackDuration] as? TimeInterval == 600)
        #expect(info[MPNowPlayingInfoPropertyElapsedPlaybackTime] as? TimeInterval == 42)
        #expect(info[MPNowPlayingInfoPropertyPlaybackRate] as? Double == 1)
        #expect(info[MPNowPlayingInfoPropertyPlaybackQueueIndex] as? Int == 1)
        #expect(info[MPNowPlayingInfoPropertyPlaybackQueueCount] as? Int == 2)
    }

    @Test func performsRemoteActions() async {
        let engine = FakeEngine()
        let player = PlayerController(engine: engine, api: FakeAPI())
        #expect(!NowPlaying.perform(.play, on: player))

        let mixes = [makeMix(1), makeMix(2)]
        player.play(mixes[0], in: mixes)
        engine.send(.playing(true))
        #expect(NowPlaying.perform(.pause, on: player))
        #expect(player.status == .paused)
        #expect(NowPlaying.perform(.play, on: player))
        #expect(NowPlaying.perform(.toggle, on: player))
        #expect(NowPlaying.perform(.seek(100), on: player))
        #expect(player.currentTime == 100)
        #expect(NowPlaying.perform(.skip(NowPlaying.skipInterval), on: player))
        #expect(player.currentTime == 115)
        #expect(NowPlaying.perform(.next, on: player))
        #expect(player.current?.id == 2)
        #expect(!NowPlaying.perform(.next, on: player))
        #expect(NowPlaying.perform(.previous, on: player))
    }

    @Test func registersRemoteCommands() {
        let player = PlayerController(engine: FakeEngine(), api: FakeAPI())
        let center = MPRemoteCommandCenter.shared()
        NowPlaying.registerRemoteCommands(for: player, center: center)
        #expect(center.nextTrackCommand.isEnabled)
        #expect(center.skipForwardCommand.preferredIntervals == [15])
    }
}
