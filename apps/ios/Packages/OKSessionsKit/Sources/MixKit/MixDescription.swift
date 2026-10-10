import Foundation

/// A mix description split into its intro and tracklist, which the descriptions write as
/// a "Tracklist" heading (often underlined with ===) followed by one track per line, or as a
/// bare closing block of "Artist - Title" lines.
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
            self.init(withoutHeading: lines)
            return
        }
        let intro = lines[..<heading].joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        let tracks = lines[(heading + 1)...]
            .map { Self.stripNumbering($0.trimmingCharacters(in: .whitespaces)) }
            .filter { !$0.isEmpty && !Self.isRule($0) }
        self.init(intro: intro, tracks: tracks)
    }

    /// Without a heading, the closing paragraphs are the tracklist if they're mostly
    /// "Artist - Title" lines (at least three in all). A one-line paragraph before them stays
    /// in the intro, since a sentence can have a dash in it too.
    private init(withoutHeading lines: [String]) {
        let trimmed = lines.map { $0.trimmingCharacters(in: .whitespaces) }
        // Paragraphs as ranges of non-empty lines
        var paragraphs: [Range<Int>] = []
        var index = 0
        while index < trimmed.count {
            if trimmed[index].isEmpty { index += 1; continue }
            let start = index
            while index < trimmed.count, !trimmed[index].isEmpty { index += 1 }
            paragraphs.append(start..<index)
        }
        var start = trimmed.count
        for (position, paragraph) in paragraphs.enumerated().reversed() {
            let block = trimmed[paragraph]
            let isLast = position == paragraphs.count - 1
            guard block.filter(Self.looksLikeTrack).count * 5 >= block.count * 4,
                  block.count > 1 || isLast
            else { break }
            start = paragraph.lowerBound
        }
        let tracks = trimmed[start...].filter { !$0.isEmpty }.map(Self.stripNumbering)
        guard tracks.count >= 3 else {
            self.init(intro: lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines), tracks: [])
            return
        }
        let intro = lines[..<start].joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        self.init(intro: intro, tracks: tracks)
    }

    private static func looksLikeTrack(_ line: String) -> Bool {
        line.contains(" - ") || line.contains(" – ") || line.contains(" — ")
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
