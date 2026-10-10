import XCTest

/// Runs the app against the bundled API fixture (`-ui-testing`), with a local tone instead of streams.
final class OKSessionsUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-ui-testing"]
        app.launch()
    }

    func testBrowsePlayAndControlAMix() {
        // In session order: the fixture has sessions #1 and #2
        let second = app.buttons["mix-2"]
        XCTAssertTrue(second.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["mix-1"].exists)

        second.tap()
        let mini = element("mini-player")
        XCTAssertTrue(mini.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["OK Sessions #2"].waitForExistence(timeout: 5))

        // Pausing from the mini player
        let playPause = app.buttons["play-pause"].firstMatch
        XCTAssertTrue(playPause.waitForExistence(timeout: 5))
        waitFor(playPause, label: "Pause")
        playPause.tap()
        waitFor(playPause, label: "Play")

        // The full player
        app.buttons["open-player"].tap()
        XCTAssertTrue(element("waveform").waitForExistence(timeout: 5))
        XCTAssertTrue(labeled("Listen on SoundCloud").exists)

        // Previous restarts the mix after a few seconds, then goes to #1 (the queue is in session order)
        app.buttons["Previous"].tap()
        app.buttons["Previous"].tap()
        XCTAssertTrue(app.staticTexts["OK Sessions #1"].waitForExistence(timeout: 5))

        app.buttons["About this mix"].tap()
        XCTAssertTrue(app.staticTexts["Streaming from SoundCloud."].waitForExistence(timeout: 5))
        app.swipeDown(velocity: .fast)

        app.buttons["close-player"].tap()
        XCTAssertTrue(mini.waitForExistence(timeout: 5))
    }

    func testSearchByNumber() {
        XCTAssertTrue(app.buttons["mix-2"].waitForExistence(timeout: 10))
        // Search opens from the header as an overlay, already focused
        app.buttons["search-button"].tap()
        let field = app.textFields["search-field"]
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.typeText("#1")
        XCTAssertTrue(app.buttons["mix-1"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["mix-2"].exists)

        // Closing clears the search; tap near the edge of the button, not just its glyph
        app.buttons["close-search"].coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap()
        XCTAssertTrue(app.buttons["mix-2"].waitForExistence(timeout: 5))
    }

    private func labeled(_ label: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
    }

    private func element(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier].firstMatch
    }

    private func waitFor(_ element: XCUIElement, label: String, file: StaticString = #filePath, line: UInt = #line) {
        let predicate = NSPredicate(format: "label == %@", label)
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
        XCTAssertEqual(XCTWaiter().wait(for: [expectation], timeout: 10), .completed, "Expected \(label)", file: file, line: line)
    }
}
