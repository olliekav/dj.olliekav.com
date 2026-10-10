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

    /// The lighter of the two colours, for text and controls on a darkened background
    public var lighterColor: Color {
        (luminance(foreground) ?? 0) >= (luminance(background) ?? 0) ? foregroundColor : backgroundColor
    }
}
