import Foundation
import Observation

/// The list of mixes: loading, refreshing and searching.
@MainActor
@Observable
public final class MixLibrary {
    public enum State: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    public private(set) var mixes: [Mix] = []
    public private(set) var state: State = .idle

    @ObservationIgnored private let load: @Sendable () async throws -> [Mix]

    public init(load: @escaping @Sendable () async throws -> [Mix]) {
        self.load = load
    }

    public convenience init(api: MixAPI) {
        self.init(load: { try await api.mixes() })
    }

    /// Loads the mixes; on failure keeps any already loaded.
    public func refresh() async {
        if mixes.isEmpty { state = .loading }
        do {
            mixes = try await load()
            state = .loaded
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    /// In session order, #1 first, as on the website.
    public var inOrder: [Mix] { mixes.sorted { $0.number < $1.number } }

    /// Matches "#12" or "12" to the session number, otherwise title and genre.
    public func search(_ query: String) -> [Mix] {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return inOrder }
        let digits = trimmed.hasPrefix("#") ? String(trimmed.dropFirst()) : trimmed
        if let number = Int(digits) {
            return inOrder.filter { String($0.number).hasPrefix(String(number)) }
        }
        return inOrder.filter {
            $0.title.localizedStandardContains(trimmed) || ($0.genre?.localizedStandardContains(trimmed) ?? false)
        }
    }
}
