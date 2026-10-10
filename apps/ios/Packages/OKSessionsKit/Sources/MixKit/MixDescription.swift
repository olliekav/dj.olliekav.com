import Foundation

/// A mix description split into its intro and tracklist, which the descriptions write as
/// a "Tracklist" heading (often underlined with ===) followed by one track per line.
public struct MixDescription: Equatable, Sendable {
    public var intro: String
    public var tracks: [String]

    public init(intro: String, tracks: [String]) {
        self.intro = intro
        self.tracks = tracks
    }

    public init(_ text: String) {
        let lines = text.components(separatedBy: .newlines)
        guard let heading = lines.firstIndex(where: Self.isTracklistHeading) else {
            self.init(intro: text.trimmingCharacters(in: .whitespacesAndNewlines), tracks: [])
            return
        }
        let intro = lines[..<heading].joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        let tracks = lines[(heading + 1)...]
            .map { Self.stripNumbering($0.trimmingCharacters(in: .whitespaces)) }
            .filter { !$0.isEmpty && !Self.isRule($0) }
        self.init(intro: intro, tracks: tracks)
    }

    private static func isTracklistHeading(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces).trimmingCharacters(in: CharacterSet(charactersIn: ":"))
        return trimmed.compare("tracklist", options: .caseInsensitive) == .orderedSame
            || trimmed.compare("track list", options: .caseInsensitive) == .orderedSame
    }

    /// Lines of =, - or _ used as underlines and dividers
    private static func isRule(_ line: String) -> Bool {
        line.count >= 3 && line.allSatisfy { "=-_—".contains($0) }
    }

    /// "1. Artist - Title" or "01) Artist - Title" → "Artist - Title"; the list numbers itself
    private static func stripNumbering(_ line: String) -> String {
        guard let match = line.firstMatch(of: /^\d{1,3}[.)]\s+/) else { return line }
        return String(line[match.range.upperBound...])
    }
}
