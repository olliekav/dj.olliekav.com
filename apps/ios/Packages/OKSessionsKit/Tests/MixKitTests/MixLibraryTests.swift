import Foundation
import Testing
@testable import MixKit

@MainActor
@Suite("MixLibrary")
struct MixLibraryTests {
    static func mix(_ n: Int, genre: String? = nil) -> Mix {
        Mix(id: n, urn: "soundcloud:tracks:\(n)", number: n, slug: "ok-sessions-\(n)", title: "OK Sessions #\(n)",
            genre: genre, durationMs: 1000, permalinkUrl: URL(string: "https://soundcloud.com/x")!,
            theme: Theme(background: "#000000", foreground: "#FFFFFF", accent: "#FFFFFF", dark: true))
    }

    let mixes = [mix(1, genre: "House"), mix(2, genre: "Techno"), mix(12, genre: "Deep House"), mix(21)]

    @Test func loadsAndOrdersNewestFirst() async {
        let library = MixLibrary { [mixes] in mixes }
        #expect(library.state == .idle)
        await library.refresh()
        #expect(library.state == .loaded)
        #expect(library.latestFirst.map(\.number) == [21, 12, 2, 1])
    }

    @Test func keepsLoadedMixesWhenARefreshFails() async {
        final class Flaky: @unchecked Sendable { var fail = false }
        let flaky = Flaky()
        let library = MixLibrary { [mixes] in
            if flaky.fail { throw URLError(.notConnectedToInternet) }
            return mixes
        }
        await library.refresh()
        flaky.fail = true
        await library.refresh()
        #expect(library.mixes.count == 4)
        if case .failed = library.state {} else { Issue.record("expected failure state") }
    }

    @Test func searchesByNumberTitleAndGenre() async {
        let library = MixLibrary { [mixes] in mixes }
        await library.refresh()
        #expect(library.search("").map(\.number) == [21, 12, 2, 1])
        #expect(library.search("#1").map(\.number) == [12, 1])
        #expect(library.search("2").map(\.number) == [21, 2])
        #expect(library.search("house").map(\.number) == [12, 1])
        #expect(library.search("Sessions #21").map(\.number) == [21])
    }

    @Test func usesTheAPI() async {
        let client = StubClient()
        client.responses["https://example.test/api/mixes"] = (200, try! Fixtures.mixesData)
        let library = MixLibrary(api: MixAPI(baseURL: URL(string: "https://example.test")!, client: client))
        await library.refresh()
        #expect(library.mixes.count == 2)
    }
}
