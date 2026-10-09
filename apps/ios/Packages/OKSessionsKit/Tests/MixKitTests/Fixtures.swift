import Foundation
@testable import MixKit

/// shared/fixtures/mixes.json: the API contract the website and functions test against too.
enum Fixtures {
    static let repoRoot = URL(filePath: #filePath)
        .deletingLastPathComponent() // MixKitTests
        .deletingLastPathComponent() // Tests
        .deletingLastPathComponent() // OKSessionsKit
        .deletingLastPathComponent() // Packages
        .deletingLastPathComponent() // ios
        .deletingLastPathComponent() // apps
        .deletingLastPathComponent() // repo

    static var mixesData: Data {
        get throws { try Data(contentsOf: repoRoot.appending(path: "shared/fixtures/mixes.json")) }
    }
}

/// An HTTPClient returning canned responses by URL, recording requests.
final class StubClient: HTTPClient, @unchecked Sendable {
    var responses: [String: (Int, Data)] = [:]
    private(set) var requested: [URL] = []

    func data(from url: URL) async throws -> (Data, URLResponse) {
        requested.append(url)
        guard let (status, data) = responses[url.absoluteString] else {
            throw URLError(.badURL)
        }
        let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: nil)!
        return (data, response)
    }
}
