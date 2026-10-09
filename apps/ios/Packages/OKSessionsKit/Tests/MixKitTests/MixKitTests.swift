import Foundation
import SwiftUI
import Testing
@testable import MixKit

@Suite("API contract")
struct ContractTests {
    @Test func decodesTheSharedFixture() throws {
        let list = try JSONDecoder.api.decode(MixList.self, from: Fixtures.mixesData)
        #expect(list.mixes.count == 2)
        let first = try #require(list.mixes.first)
        #expect(first.urn == "soundcloud:tracks:101")
        #expect(first.number == 1)
        #expect(first.durationMs == 3_600_000)
        #expect(first.duration == 3600)
        #expect(first.publishedAt == Date(timeIntervalSince1970: 1_552_219_200))
        #expect(first.artworkUrl?.absoluteString == "https://i1.sndcdn.com/artworks-abc-t500x500.jpg")
        #expect(first.waveformUrl?.absoluteString == "https://wave.sndcdn.com/abc_m.json")
        #expect(first.theme == Theme(background: "#2A10A6", foreground: "#EC00A5", accent: "#EC00A5", dark: true))

        let second = try #require(list.mixes.last)
        #expect(second.genre == nil)
        #expect(second.artworkUrl == nil)
        #expect(second.playbackCount == nil)
    }

    @Test func rejectsMalformedDates() {
        let json = #"{"value":"yesterday"}"#.data(using: .utf8)!
        struct Box: Decodable { var value: Date }
        #expect(throws: DecodingError.self) { try JSONDecoder.api.decode(Box.self, from: json) }
    }

    @Test func acceptsDatesWithoutFractionalSeconds() throws {
        struct Box: Decodable { var value: Date }
        let box = try JSONDecoder.api.decode(Box.self, from: #"{"value":"2019-03-10T12:00:00Z"}"#.data(using: .utf8)!)
        #expect(box.value == Date(timeIntervalSince1970: 1_552_219_200))
    }
}

@Suite("MixAPI")
struct MixAPITests {
    let base = URL(string: "https://example.test")!

    func mix(urn: String = "soundcloud:tracks:101", waveform: String? = "https://wave.test/w.json") -> Mix {
        Mix(id: 1, urn: urn, number: 1, slug: "ok-sessions-1", title: "OK Sessions #1", durationMs: 1000,
            waveformUrl: waveform.flatMap(URL.init(string:)), permalinkUrl: URL(string: "https://soundcloud.com/x")!,
            theme: Theme(background: "#000000", foreground: "#FFFFFF", accent: "#FFFFFF", dark: true))
    }

    @Test func loadsMixesInSessionOrder() async throws {
        let client = StubClient()
        // Serve the fixture's mixes in reverse to check they come back sorted
        var json = try #require(JSONSerialization.jsonObject(with: Fixtures.mixesData) as? [String: Any])
        json["mixes"] = (json["mixes"] as? [Any]).map { Array($0.reversed()) }
        client.responses["https://example.test/api/mixes"] = (200, try JSONSerialization.data(withJSONObject: json))
        let mixes = try await MixAPI(baseURL: base, client: client).mixes()
        #expect(mixes.map(\.number) == [1, 2])
    }

    @Test func requestsAStreamForTheTrack() async throws {
        let client = StubClient()
        client.responses["https://example.test/api/stream?urn=soundcloud:tracks:101"] =
            (200, #"{"url":"https://cdn.test/a.m3u8","format":"hls_aac_160"}"#.data(using: .utf8)!)
        let stream = try await MixAPI(baseURL: base, client: client).stream(for: mix())
        #expect(stream == Stream(url: URL(string: "https://cdn.test/a.m3u8")!, format: .hlsAac160))
    }

    @Test func refusesNonSoundCloudURNs() async {
        await #expect(throws: MixAPIError.invalidURN) {
            try await MixAPI(baseURL: base, client: StubClient()).stream(for: mix(urn: "spotify:1"))
        }
    }

    @Test func surfacesHTTPErrors() async {
        let client = StubClient()
        client.responses["https://example.test/api/mixes"] = (502, Data())
        await #expect(throws: MixAPIError.http(status: 502)) {
            try await MixAPI(baseURL: base, client: client).mixes()
        }
        #expect(MixAPIError.http(status: 502).errorDescription == "The server returned an error (502).")
        #expect(MixAPIError.invalidURN.errorDescription != nil)
    }

    @Test func loadsWaveforms() async throws {
        let client = StubClient()
        client.responses["https://wave.test/w.json"] = (200, #"{"width":3,"height":140,"samples":[0,70,140]}"#.data(using: .utf8)!)
        let api = MixAPI(baseURL: base, client: client)
        #expect(try await api.waveform(for: mix()) == Waveform(width: 3, height: 140, samples: [0, 70, 140]))
        #expect(try await api.waveform(for: mix(waveform: nil)) == nil)
    }

    @Test func defaultsToProduction() {
        #expect(MixAPI().baseURL.absoluteString == "https://dj.olliekav.com")
    }
}

@Suite("Waveform")
struct WaveformTests {
    @Test func reducesToPeaksByBucketMaximum() {
        let waveform = Waveform(width: 6, height: 100, samples: [10, 50, 20, 100, 0, 30])
        #expect(waveform.peaks(count: 3) == [0.5, 1.0, 0.3])
        #expect(waveform.peaks(count: 6) == [0.1, 0.5, 0.2, 1.0, 0, 0.3])
    }

    @Test func handlesMoreBarsThanSamplesAndEmptyData() {
        #expect(Waveform(width: 2, height: 10, samples: [5, 10]).peaks(count: 4) == [0.5, 0.5, 1.0, 1.0])
        #expect(Waveform(width: 0, height: 10, samples: []).peaks(count: 2) == [0, 0])
        #expect(Waveform(width: 1, height: 10, samples: [5]).peaks(count: 0) == [])
    }
}

@Suite("SVG and logo")
struct LogoTests {
    @Test func parsesAbsoluteCommandsAndImplicitRepeats() throws {
        let commands = try SVGPath.parse("M0 0 10 0H20V5C1 2 3 4 5 6L7 8Z")
        #expect(commands == [
            .move(.init(x: 0, y: 0)),
            .line(.init(x: 10, y: 0)),
            .line(.init(x: 20, y: 0)),
            .line(.init(x: 20, y: 5)),
            .curve(.init(x: 1, y: 2), .init(x: 3, y: 4), .init(x: 5, y: 6)),
            .line(.init(x: 7, y: 8)),
            .close
        ])
    }

    @Test func rejectsUnsupportedCommandsAndMissingNumbers() {
        #expect(throws: SVGPath.ParseError.unsupported("Q")) { try SVGPath.parse("M0 0Q1 1 2 2") }
        #expect(throws: SVGPath.ParseError.missingNumbers("C")) { try SVGPath.parse("M0 0C1 2") }
    }

    @Test func logoSpansTheRing() throws {
        #expect(try SVGPath.parse(Logo.ringData).count > 10)
        #expect(try SVGPath.parse(Logo.chevronData).count > 10)
        let box = Logo.path.boundingBoxOfPath
        #expect(abs(box.minX - 62) < 0.5)
        #expect(abs(box.maxX - 962) < 0.5)
        #expect(abs(box.minY - 62) < 0.5)
        #expect(abs(box.maxY - 962) < 0.5)
    }

    @Test func shapeScalesToItsFrame() {
        let box = LogoShape().path(in: CGRect(x: 10, y: 20, width: 512, height: 600)).boundingRect
        #expect(abs(box.minX - 41) < 0.5)
        #expect(abs(box.maxX - 491) < 0.5)
        #expect(abs(box.minY - 51) < 0.5)
    }
}

@Suite("Formatting")
struct FormattingTests {
    @Test(arguments: [(0.0, "0:00:00"), (59.9, "0:00:59"), (3725, "1:02:05"), (-1, "0:00:00"), (.nan, "0:00:00")])
    func formatsTime(seconds: Double, expected: String) {
        #expect(Formatting.time(seconds) == expected)
    }

    @Test func linksURLsAndMentionsButNotEmails() {
        let text = "Tracklist: https://dj.olliekav.com/x thanks @olliekav, mail me@example.com"
        let links = Formatting.description(text).runs.compactMap { run -> (String, String)? in
            guard let link = run.link else { return nil }
            return (String(Formatting.description(text)[run.range].characters), link.absoluteString)
        }
        #expect(links.map(\.1) == ["https://dj.olliekav.com/x", "https://soundcloud.com/olliekav"])
        #expect(links.map(\.0) == ["https://dj.olliekav.com/x", "@olliekav"])
    }

    @Test func parsesHexColours() {
        #expect(Color(hex: "#FF0000") == Color(red: 1, green: 0, blue: 0))
        #expect(Color(hex: "00FF00") == Color(red: 0, green: 1, blue: 0))
        #expect(Color(hex: "nope") == .clear)
        let theme = Theme(background: "#000000", foreground: "#FFFFFF", accent: "#FF0000", dark: true)
        #expect(theme.accentColor == Color(red: 1, green: 0, blue: 0))
        #expect(theme.backgroundColor == Color(red: 0, green: 0, blue: 0))
        #expect(theme.foregroundColor == Color(red: 1, green: 1, blue: 1))
    }
}
