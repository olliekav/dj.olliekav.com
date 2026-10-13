import Foundation
import SwiftUI

extension Color {
    /// A colour from "#RRGGBB"; clear if malformed.
    public init(hex: String) {
        let value = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard value.count == 6, let rgb = UInt32(value, radix: 16) else {
            self = .clear
            return
        }
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}

extension Theme {
    public var backgroundColor: Color { Color(hex: background) }
    public var foregroundColor: Color { Color(hex: foreground) }
    public var accentColor: Color { Color(hex: accent) }
}

public enum GridLayout {
    /// Columns for a width, one per ~185pt: two on every iPhone in portrait, 4–5 in
    /// landscape and on iPads, and one in very narrow spaces like iPad Slide Over.
    public static func columns(for width: CGFloat, minimumTileWidth: CGFloat = 185) -> Int {
        guard width.isFinite, width > 0 else { return 2 }
        return max(1, Int(width / minimumTileWidth))
    }
}

public enum Formatting {
    /// H:MM:SS, as on the website.
    public static func time(_ seconds: TimeInterval) -> String {
        guard seconds.isFinite, seconds > 0 else { return "0:00:00" }
        let total = Int(seconds)
        return String(format: "%d:%02d:%02d", total / 3600, total % 3600 / 60, total % 60)
    }

    /// The description with URLs and @mentions (SoundCloud profiles) as links.
    public static func description(_ text: String) -> AttributedString {
        var result = AttributedString(text)
        let ns = text as NSString
        let full = NSRange(location: 0, length: ns.length)

        var links: [(NSRange, URL)] = []
        if let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) {
            for match in detector.matches(in: text, range: full) {
                if let url = match.url, url.scheme?.hasPrefix("http") == true {
                    links.append((match.range, url))
                }
            }
        }
        // @mentions, but not email addresses or parts of words
        if let mention = try? NSRegularExpression(pattern: "(?<![\\w@])@([A-Za-z0-9_-]+)") {
            for match in mention.matches(in: text, range: full) {
                let range = match.range
                let username = ns.substring(with: match.range(at: 1))
                guard !links.contains(where: { NSIntersectionRange($0.0, range).length > 0 }),
                      let url = URL(string: "https://soundcloud.com/\(username)") else { continue }
                links.append((range, url))
            }
        }

        for (range, url) in links {
            if let swiftRange = Range(range, in: text), let attributed = Range(swiftRange, in: result) {
                result[attributed].link = url
            }
        }
        return result
    }
}

/// `amount` of one "#RRGGBB" colour mixed into another, like CSS `color-mix(in srgb, …)`;
/// the second colour if either is malformed.
func mixHex(_ hex: String, into base: String, amount: Double) -> String {
    func rgb(_ hex: String) -> UInt32? {
        let value = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        return value.count == 6 ? UInt32(value, radix: 16) : nil
    }
    guard let a = rgb(hex), let b = rgb(base) else { return base }
    let channels = [16, 8, 0].map { shift -> Int in
        let x = Double(a >> UInt32(shift) & 0xFF), y = Double(b >> UInt32(shift) & 0xFF)
        return Int((x * amount + y * (1 - amount)).rounded())
    }
    return String(format: "#%02X%02X%02X", channels[0], channels[1], channels[2])
}

/// Relative luminance (WCAG) of "#RRGGBB"; nil if malformed.
func luminance(_ hex: String) -> Double? {
    let value = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
    guard value.count == 6, let rgb = UInt32(value, radix: 16) else { return nil }
    func linear(_ channel: UInt32) -> Double {
        let c = Double(channel) / 255
        return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * linear(rgb >> 16 & 0xFF) + 0.7152 * linear(rgb >> 8 & 0xFF) + 0.0722 * linear(rgb & 0xFF)
}

extension Theme {
    /// Whether the background is dark, so status bar and controls should be light
    public var hasDarkBackground: Bool {
        // Above this, black text has more contrast than white
        (luminance(background) ?? 1) < 0.179
    }

    /// The player's accent, as on the website: the theme's accent, unless that's the background
    /// the player sits on; then the foreground, so the played waveform and shuffle still show.
    public var playerAccent: String {
        accent.caseInsensitiveCompare(background) == .orderedSame ? foreground : accent
    }

    public var playerAccentColor: Color { Color(hex: playerAccent) }

    /// Lines between the parts of the player, as on the website: the foreground mixed 30% into
    /// the background, a solid colour rather than a translucent one.
    public var playerLine: String { mixHex(foreground, into: background, amount: 0.3) }

    public var playerLineColor: Color { Color(hex: playerLine) }

    /// The lighter of the two colours, for text and controls on a darkened background
    public var lighterColor: Color {
        (luminance(foreground) ?? 0) >= (luminance(background) ?? 0) ? foregroundColor : backgroundColor
    }
}
