import Foundation

/// Loads data over HTTP; injectable so tests and UI tests can stub the network.
public protocol HTTPClient: Sendable {
    func data(from url: URL) async throws -> (Data, URLResponse)
    func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

extension URLSession: HTTPClient {
    public func data(from url: URL) async throws -> (Data, URLResponse) {
        try await data(from: url, delegate: nil)
    }

    public func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await data(for: request, delegate: nil)
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

/// Client for dj.olliekav.com/api: the mix list, streams, SoundCloud waveforms and push registration.
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

    /// Asks for new-mix notifications on this device, by its APNs token.
    public func registerDevice(_ token: Data) async throws {
        try await send("POST", DeviceRegistration(token: token.hexEncoded, platform: "ios"))
    }

    /// Stops new-mix notifications; the server forgets the token.
    public func unregisterDevice(_ token: Data) async throws {
        try await send("DELETE", DeviceRegistration(token: token.hexEncoded, platform: "ios"))
    }

    private func get<T: Decodable>(_ url: URL) async throws -> T {
        let (data, response) = try await client.data(from: url)
        try check(response)
        return try JSONDecoder.api.decode(T.self, from: data)
    }

    private func send(_ method: String, _ registration: DeviceRegistration) async throws {
        var request = URLRequest(url: baseURL.appending(path: "api/devices"))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(registration)
        let (_, response) = try await client.data(for: request)
        try check(response)
    }

    private func check(_ response: URLResponse) throws {
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw MixAPIError.http(status: http.statusCode)
        }
    }
}

/// Body of POST and DELETE /api/devices.
struct DeviceRegistration: Codable, Equatable {
    var token: String
    var platform: String
}

extension Data {
    /// Lowercase hex, how APNs and the server write device tokens.
    var hexEncoded: String {
        map { String(format: "%02x", $0) }.joined()
    }
}
