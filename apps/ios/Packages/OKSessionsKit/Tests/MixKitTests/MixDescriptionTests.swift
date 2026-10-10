import Testing
@testable import MixKit

@Suite("MixDescription")
struct MixDescriptionTests {
    @Test func splitsIntroAndTracklist() {
        let text = """
        Ft tracks by @paradox-music-uk @3024world

        Tracklist
        ================================
        Paradox - Trident
        1. Martyn - Hypnotoxic Laser
        02) Lutsu & Mercy System - Law

        """
        #expect(MixDescription(text) == MixDescription(
            intro: "Ft tracks by @paradox-music-uk @3024world",
            tracks: ["Paradox - Trident", "Martyn - Hypnotoxic Laser", "Lutsu & Mercy System - Law"]
        ))
    }

    @Test(arguments: ["Tracklist:", "TRACK LIST", "  tracklist  "])
    func recognisesHeadings(heading: String) {
        #expect(MixDescription("Intro\n\(heading)\nA - B").tracks == ["A - B"])
    }

    @Test func keepsDescriptionsWithoutATracklist() {
        #expect(MixDescription("  Just vibes.\n") == MixDescription(intro: "Just vibes.", tracks: []))
        #expect(MixDescription("") == MixDescription(intro: "", tracks: []))
    }

    @Test func skipsRulesButKeepsShortDashes() {
        #expect(MixDescription("Tracklist\n---\nA - B\n-\n___").tracks == ["A - B", "-"])
    }
}
