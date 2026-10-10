import XCTest

/// Runs the app against the bundled API fixture (`-ui-testing`), with a local tone instead of streams.
// XCUIApplication and its elements are main-actor APIs; UI tests run on the main thread anyway
@MainActor
final class OKSessionsUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUp() async throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-ui-testing"]
    }

    func testBrowsePlayAndControlAMix() {
        app.launch()
        // In session order: the fixture has sessions #1 and #2
        let second = app.buttons["mix-2"]
        XCTAssertTrue(second.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["mix-1"].exists)

        // Tapping a mix plays it and opens the player
        second.tap()
        XCTAssertTrue(element("waveform").waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["OK Sessions #2"].waitForExistence(timeout: 5))
        XCTAssertTrue(labeled("Listen on SoundCloud").exists)

        // Closing leaves the mini player, which pauses and reopens the player
        app.buttons["close-player"].tap()
        let mini = element("mini-player")
        XCTAssertTrue(mini.waitForExistence(timeout: 5))
        let playPause = app.buttons["play-pause"].firstMatch
        XCTAssertTrue(playPause.waitForExistence(timeout: 5))
        waitFor(playPause, label: "Pause")
        playPause.tap()
        waitFor(playPause, label: "Play")
        app.buttons["open-player"].tap()
        XCTAssertTrue(element("waveform").waitForExistence(timeout: 5))

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

    func testShuffleAllAndToggle() {
        app.launch()
        let shuffleAll = app.buttons["shuffle-all"]
        XCTAssertTrue(shuffleAll.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["mix-2"].waitForExistence(timeout: 10))

        // Shuffle all plays a random mix and opens the player with shuffle on
        shuffleAll.tap()
        XCTAssertTrue(element("waveform").waitForExistence(timeout: 10))
        let shuffle = app.buttons["shuffle"]
        XCTAssertTrue(shuffle.waitForExistence(timeout: 5))
        XCTAssertEqual(shuffle.value as? String, "On")

        shuffle.tap()
        waitFor(shuffle, value: "Off")
        shuffle.tap()
        waitFor(shuffle, value: "On")
    }

    func testSearchByNumber() {
        app.launch()
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

    func testOffersNotificationsAfterListening() {
        // The prompt waits for 5 seconds of listening here, rather than minutes
        app.launchArguments += ["-prompt-after", "5"]
        app.launch()
        let bell = app.buttons["notifications"]
        XCTAssertTrue(bell.waitForExistence(timeout: 10))
        XCTAssertEqual(bell.value as? String, "Off")
        let prompt = element("notification-prompt")
        XCTAssertFalse(prompt.exists)

        app.buttons["mix-1"].tap()
        XCTAssertTrue(element("waveform").waitForExistence(timeout: 10))
        app.buttons["close-player"].tap()
        XCTAssertTrue(prompt.waitForExistence(timeout: 20))

        // UI tests stand in for the system request, which allows them
        app.buttons["prompt-notify"].tap()
        waitFor(bell, value: "On")
        XCTAssertFalse(prompt.exists)
        bell.tap()
        waitFor(bell, value: "Off")
    }

    func testOpensTheMixFromANotification() {
        // Takes the same path as tapping a new-mix notification on a cold launch
        app.launchArguments += ["-open-mix", "2"]
        app.launch()
        XCTAssertTrue(element("waveform").waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["OK Sessions #2"].waitForExistence(timeout: 5))
    }

    private func labeled(_ label: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
    }

    private func element(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier].firstMatch
    }

    private func waitFor(_ element: XCUIElement, value: String, file: StaticString = #filePath, line: UInt = #line) {
        let predicate = NSPredicate(format: "value == %@", value)
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
        XCTAssertEqual(XCTWaiter().wait(for: [expectation], timeout: 10), .completed, "Expected \(value)", file: file, line: line)
    }

    private func waitFor(_ element: XCUIElement, label: String, file: StaticString = #filePath, line: UInt = #line) {
        let predicate = NSPredicate(format: "label == %@", label)
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
        XCTAssertEqual(XCTWaiter().wait(for: [expectation], timeout: 10), .completed, "Expected \(label)", file: file, line: line)
    }
}
