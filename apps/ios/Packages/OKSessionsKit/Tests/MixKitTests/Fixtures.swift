import Foundation
@testable import MixKit

/// shared/fixtures/mixes.json: the API contract the website and functions test against too.
/// It's bundled with the tests (Resources/mixes.json links to it).
enum Fixtures {
    static var mixesData: Data {
        get throws {
            guard let url = Bundle.module.url(forResource: "mixes", withExtension: "json") else {
                throw CocoaError(.fileNoSuchFile)
            }
            return try Data(contentsOf: url)
        }
    }
}

/// An HTTPClient returning canned responses by URL, recording requests.
final class StubClient: HTTPClient, @unchecked Sendable {
    var responses: [String: (Int, Data)] = [:]
    private(set) var requested: [URL] = []
    private(set) var requests: [URLRequest] = []

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        requests.append(request)
        return try await data(from: request.url!)
    }

    func data(from url: URL) async throws -> (Data, URLResponse) {
        requested.append(url)
        guard let (status, data) = responses[url.absoluteString] else {
            throw URLError(.badURL)
        }
        let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: nil)!
        return (data, response)
    }
}
