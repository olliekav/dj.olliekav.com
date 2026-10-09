import Foundation

/// A mix's two-colour theme (hex strings), as in shared/mix-themes.json.
public struct Theme: Codable, Hashable, Sendable {
    public var background: String
    public var foreground: String
    public var accent: String
    /// The accent is the foreground (the background is the darker, plainer colour)
    public var dark: Bool

    public init(background: String, foreground: String, accent: String, dark: Bool) {
        self.background = background
        self.foreground = foreground
        self.accent = accent
        self.dark = dark
    }
}

/// An OK Sessions mix: a track in the SoundCloud playlist plus its theme.
/// Mirrors `Mix` in shared/api-types.ts.
public struct Mix: Codable, Hashable, Identifiable, Sendable {
    public var id: Int
    /// SoundCloud track URN, used to request a stream
    public var urn: String
    /// Position in the playlist, which is the session number
    public var number: Int
    public var slug: String
    public var title: String
    public var description: String
    public var genre: String?
    public var durationMs: Int
    public var publishedAt: Date?
    public var artworkUrl: URL?
    public var artworkOriginalUrl: URL?
    public var waveformUrl: URL?
    /// The track on SoundCloud, for attribution
    public var permalinkUrl: URL
    public var playbackCount: Int?
    public var theme: Theme

    public var duration: TimeInterval { TimeInterval(durationMs) / 1000 }

    public init(
        id: Int, urn: String, number: Int, slug: String, title: String, description: String = "",
        genre: String? = nil, durationMs: Int, publishedAt: Date? = nil, artworkUrl: URL? = nil,
        artworkOriginalUrl: URL? = nil, waveformUrl: URL? = nil, permalinkUrl: URL,
        playbackCount: Int? = nil, theme: Theme
    ) {
        self.id = id
        self.urn = urn
        self.number = number
        self.slug = slug
        self.title = title
        self.description = description
        self.genre = genre
        self.durationMs = durationMs
        self.publishedAt = publishedAt
        self.artworkUrl = artworkUrl
        self.artworkOriginalUrl = artworkOriginalUrl
        self.waveformUrl = waveformUrl
        self.permalinkUrl = permalinkUrl
        self.playbackCount = playbackCount
        self.theme = theme
    }
}

public struct MixList: Codable, Sendable {
    public var mixes: [Mix]
}

/// A short-lived HLS URL from /api/stream.
public struct Stream: Codable, Hashable, Sendable {
    public enum Format: String, Codable, Sendable {
        case hlsAac160 = "hls_aac_160"
        case hlsMp3128 = "hls_mp3_128"
    }

    public var url: URL
    public var format: Format

    public init(url: URL, format: Format) {
        self.url = url
        self.format = format
    }
}

/// SoundCloud's waveform JSON.
public struct Waveform: Codable, Hashable, Sendable {
    public var width: Int
    public var height: Int
    public var samples: [Int]

    public init(width: Int, height: Int, samples: [Int]) {
        self.width = width
        self.height = height
        self.samples = samples
    }

    /// `count` peaks between 0 and 1, taking the maximum within each bucket.
    public func peaks(count: Int) -> [Double] {
        guard count > 0, !samples.isEmpty, height > 0 else { return Array(repeating: 0, count: max(count, 0)) }
        let scale = Double(height)
        return (0..<count).map { bar in
            let start = bar * samples.count / count
            let end = max(start + 1, (bar + 1) * samples.count / count)
            let bucket = samples[start..<min(end, samples.count)]
            return Double(bucket.max() ?? 0) / scale
        }
    }
}

extension JSONDecoder {
    /// Decodes API responses: snake_case keys and ISO 8601 dates with fractional seconds.
    public static var api: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .custom { decoder in
            let value = try decoder.singleValueContainer().decode(String.self)
            if let date = try? Date(value, strategy: .iso8601.year().month().day().time(includingFractionalSeconds: true)) {
                return date
            }
            if let date = try? Date(value, strategy: .iso8601) {
                return date
            }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Invalid date \(value)"))
        }
        return decoder
    }
}
