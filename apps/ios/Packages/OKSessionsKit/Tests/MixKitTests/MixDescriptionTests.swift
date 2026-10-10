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

    @Test func findsABareTracklistAtTheEnd() {
        let text = """
        Recorded live - all vinyl.

        Bruce - Post Rave Wrestle
        Cadans - 1 Bar FU (TOOL)
        Wen - BLIPS
        Thanks for listening
        Yak - Mido
        """
        #expect(MixDescription(text) == MixDescription(
            intro: "Recorded live - all vinyl.",
            tracks: ["Bruce - Post Rave Wrestle", "Cadans - 1 Bar FU (TOOL)", "Wen - BLIPS", "Thanks for listening", "Yak - Mido"]
        ))
    }

    @Test func needsThreeTracksWithoutAHeading() {
        #expect(MixDescription("Intro\n\nA - B\nC - D").tracks.isEmpty)
        #expect(MixDescription("One - two - three, a sentence.").tracks.isEmpty)
    }
}
