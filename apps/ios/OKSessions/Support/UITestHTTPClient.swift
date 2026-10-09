import Foundation
import MixKit

/// Serves the bundled API fixture and a short local tone, so UI tests run without the network.
struct UITestHTTPClient: HTTPClient {
    func data(from url: URL) async throws -> (Data, URLResponse) {
        let ok = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil)!
        switch url.path() {
        case "/api/mixes":
            let fixture = Bundle.main.url(forResource: "mixes", withExtension: "json")!
            return (try Data(contentsOf: fixture), ok)
        case "/api/stream":
            let tone = Bundle.main.url(forResource: "ui-test-tone", withExtension: "m4a")!
            return (try JSONEncoder().encode(["url": tone.absoluteString, "format": "hls_aac_160"]), ok)
        default:
            // Waveforms
            let samples = (0..<300).map { 40 + ($0 * 7919) % 100 }
            return (try JSONEncoder().encode(Waveform(width: 300, height: 140, samples: samples)), ok)
        }
    }
}
