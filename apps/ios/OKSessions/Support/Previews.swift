import Foundation
import MixKit

extension Mix {
    static let preview = Mix(
        id: 1, urn: "soundcloud:tracks:1", number: 21, slug: "ok-sessions-21", title: "OK Sessions #21",
        description: "Balearic, cosmic and slow disco.\nTracklist: https://dj.olliekav.com @olliekav",
        genre: "Balearic", durationMs: 5_400_000, permalinkUrl: URL(string: "https://soundcloud.com/olliekav")!,
        playbackCount: 1234,
        theme: Theme(background: "#41C5DA", foreground: "#794910", accent: "#41C5DA", dark: false)
    )
}
