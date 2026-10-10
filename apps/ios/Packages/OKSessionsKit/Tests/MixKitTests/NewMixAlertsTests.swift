import Foundation
import Testing
@testable import MixKit

@MainActor
final class FakeNotificationSystem: NotificationSystem {
    var status: NewMixAlerts.Authorization = .notDetermined
    var allows = true
    private(set) var calls: [String] = []

    func authorization() async -> NewMixAlerts.Authorization { status }
    func requestAuthorization() async -> Bool {
        calls.append("request")
        status = allows ? .authorized : .denied
        return allows
    }
    func registerForRemoteNotifications() { calls.append("register") }
    func openSettings() { calls.append("settings") }
}

final class FakeRegistry: DeviceRegistry, @unchecked Sendable {
    var fails = false
    private(set) var calls: [String] = []

    func registerDevice(_ token: Data) async throws {
        calls.append("register \(token.hexEncoded)")
        if fails { throw URLError(.notConnectedToInternet) }
    }
    func unregisterDevice(_ token: Data) async throws {
        calls.append("unregister \(token.hexEncoded)")
        if fails { throw URLError(.notConnectedToInternet) }
    }
}

@MainActor
@Suite("NewMixAlerts")
struct NewMixAlertsTests {
    let system = FakeNotificationSystem()
    let registry = FakeRegistry()
    let defaults = UserDefaults(suiteName: "NewMixAlertsTests-\(UUID())")!
    let token = Data([0xAB, 0x01])
    let newToken = Data([0xCD, 0x02])

    func alerts() -> NewMixAlerts {
        NewMixAlerts(system: system, registry: registry, defaults: defaults, promptDelay: 120)
    }

    @Test func offersThePromptOnceAfterAWhileListening() async {
        let alerts = alerts()
        await alerts.refresh()
        #expect(!alerts.isPromptVisible)
        alerts.recordListening(115)
        #expect(!alerts.isPromptVisible)
        alerts.recordListening(5)
        #expect(alerts.isPromptVisible)

        alerts.dismissPrompt()
        #expect(!alerts.isPromptVisible)
        #expect(system.calls.isEmpty)
        // Not again, even after a relaunch
        let relaunched = self.alerts()
        await relaunched.refresh()
        relaunched.recordListening(600)
        #expect(!relaunched.isPromptVisible)
    }

    @Test func listeningIsRememberedAcrossLaunches() async {
        alerts().recordListening(100)
        let relaunched = alerts()
        await relaunched.refresh()
        relaunched.recordListening(20)
        #expect(relaunched.isPromptVisible)
    }

    @Test func doesNotPromptWhenTheSystemAlreadyDecided() async {
        system.status = .denied
        let alerts = alerts()
        await alerts.refresh()
        alerts.recordListening(600)
        #expect(!alerts.isPromptVisible)
    }

    @Test func acceptingAsksTheSystemThenSendsTheToken() async {
        let alerts = alerts()
        await alerts.refresh()
        alerts.recordListening(120)
        await alerts.acceptPrompt()
        #expect(!alerts.isPromptVisible)
        #expect(alerts.isOn)
        #expect(system.calls == ["request", "register"])

        await alerts.didRegister(token: token)
        #expect(registry.calls == ["register ab01"])
        #expect(NewMixAlerts(system: system, registry: registry, defaults: defaults).isWanted)
    }

    @Test func aDenialLeavesItOff() async {
        system.allows = false
        let alerts = alerts()
        await alerts.turnOn()
        #expect(!alerts.isOn)
        #expect(!alerts.isWanted)
        #expect(alerts.authorization == .denied)
        #expect(system.calls == ["request"])
    }

    @Test func theBellOpensSettingsAfterADenial() async {
        system.status = .denied
        let alerts = alerts()
        await alerts.refresh()
        await alerts.toggle()
        #expect(system.calls == ["settings"])
        #expect(alerts.isWanted)
        #expect(!alerts.isOn)

        // Allowed in Settings: registers when the app comes back
        system.status = .authorized
        await alerts.refresh()
        #expect(alerts.isOn)
        #expect(system.calls == ["settings", "register"])
    }

    @Test func turningOffRemovesTheTokenFromTheServer() async {
        system.status = .authorized
        let alerts = alerts()
        await alerts.toggle()
        await alerts.didRegister(token: token)
        await alerts.toggle()
        #expect(!alerts.isOn)
        #expect(registry.calls == ["register ab01", "unregister ab01"])
        // Nothing more to remove, and tokens that arrive now aren't sent
        await alerts.refresh()
        await alerts.didRegister(token: token)
        #expect(registry.calls.count == 2)
    }

    @Test func turningOffInSettingsRemovesTheTokenButKeepsTheWish() async {
        system.status = .authorized
        let alerts = alerts()
        await alerts.turnOn()
        await alerts.didRegister(token: token)
        system.status = .denied
        await alerts.refresh()
        #expect(alerts.isWanted)
        #expect(!alerts.isOn)
        #expect(registry.calls == ["register ab01", "unregister ab01"])
    }

    @Test func aNewTokenReplacesTheOldOne() async {
        system.status = .authorized
        let alerts = alerts()
        await alerts.turnOn()
        await alerts.didRegister(token: token)
        await alerts.didRegister(token: token)
        await alerts.didRegister(token: newToken)
        #expect(registry.calls == ["register ab01", "register ab01", "unregister ab01", "register cd02"])
    }

    @Test func retriesRemovingATokenWhenOffline() async {
        system.status = .authorized
        let alerts = alerts()
        await alerts.turnOn()
        await alerts.didRegister(token: token)
        registry.fails = true
        await alerts.turnOff()
        registry.fails = false
        await alerts.refresh()
        #expect(registry.calls == ["register ab01", "unregister ab01", "unregister ab01"])
        await alerts.refresh()
        #expect(registry.calls.count == 3)
    }

    @Test func readsTheMixNumberFromAPush() {
        let userInfo: [AnyHashable: Any] = ["aps": ["alert": ["title": "OK Sessions #3 is out"]], "mix": NSNumber(value: 3)]
        #expect(NewMixNotification.mixNumber(in: userInfo) == 3)
        #expect(NewMixNotification.mixNumber(in: ["aps": [:]]) == nil)
        #expect(NewMixNotification.mixNumber(in: ["mix": "three"]) == nil)
    }
}
