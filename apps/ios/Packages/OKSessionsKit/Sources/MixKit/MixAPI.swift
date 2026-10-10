import Foundation

/// Loads data over HTTP; injectable so tests and UI tests can stub the network.
public protocol HTTPClient: Sendable {
    func data(from url: URL) async throws -> (Data, URLResponse)
}

extension URLSession: HTTPClient {
    public func data(from url: URL) async throws -> (Data, URLResponse) {
        try await data(from: url, delegate: nil)
    }
}

public enum MixAPIError: Error, Equatable, LocalizedError {
    case http(status: Int)
    case invalidURN

    public var errorDescription: String? {
        switch self {
        case .http(let status): "The server returned an error (\(status))."
        case .invalidURN: "That isn't an OK Sessions mix."
        }
    }
}

/// Client for dj.olliekav.com/api: the mix list, streams and SoundCloud waveforms.
public struct MixAPI: Sendable {
    public static let production = URL(string: "https://dj.olliekav.com")!

    public var baseURL: URL
    public var client: HTTPClient

    public init(baseURL: URL = MixAPI.production, client: HTTPClient = URLSession.shared) {
        self.baseURL = baseURL
        self.client = client
    }

    /// Mixes in session order.
    public func mixes() async throws -> [Mix] {
        let list: MixList = try await get(baseURL.appending(path: "api/mixes"))
        return list.mixes.sorted { $0.number < $1.number }
    }

    /// A fresh HLS URL for the mix. Request it when playback starts: URLs expire after a few hours.
    public func stream(for mix: Mix) async throws -> Stream {
        guard mix.urn.hasPrefix("soundcloud:tracks:") else { throw MixAPIError.invalidURN }
        let url = baseURL.appending(path: "api/stream").appending(queryItems: [URLQueryItem(name: "urn", value: mix.urn)])
        return try await get(url)
    }

    public func waveform(for mix: Mix) async throws -> Waveform? {
        guard let url = mix.waveformUrl else { return nil }
        return try await get(url)
    }

    private func get<T: Decodable>(_ url: URL) async throws -> T {
        let (data, response) = try await client.data(from: url)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw MixAPIError.http(status: http.statusCode)
        }
        return try JSONDecoder.api.decode(T.self, from: data)
    }
}
