import Foundation
import Observation

/// The system side of notifications, so `NewMixAlerts` can be tested: UserNotifications and UIApplication in the app.
@MainActor
public protocol NotificationSystem: AnyObject {
    func authorization() async -> NewMixAlerts.Authorization
    /// Shows the system permission request; true if allowed.
    func requestAuthorization() async -> Bool
    /// Asks APNs for a device token, which arrives in `NewMixAlerts.didRegister(token:)`.
    func registerForRemoteNotifications()
    /// The app's notification settings, where a denial can be undone.
    func openSettings()
}

/// Where the device token goes; `MixAPI` in the app.
public protocol DeviceRegistry: Sendable {
    func registerDevice(_ token: Data) async throws
    func unregisterDevice(_ token: Data) async throws
}

extension MixAPI: DeviceRegistry {}

/// Notifications when a new mix is out: the one-off prompt, the user's choice, and
/// keeping the server's copy of the device token in step with both.
///
/// Never asked on first launch: the prompt is offered once, after a mix has played for a while.
/// The token is only on the server while the user wants notifications and the system allows them.
@MainActor
@Observable
public final class NewMixAlerts {
    public enum Authorization: Sendable, Equatable {
        case notDetermined
        case denied
        case authorized
    }

    /// Listening needed before the prompt is offered
    public static let defaultPromptDelay: TimeInterval = 120

    public private(set) var authorization: Authorization = .notDetermined
    /// The in-app prompt is showing
    public private(set) var isPromptVisible = false
    /// The user asked for notifications, whether or not the system currently allows them
    public private(set) var isWanted: Bool {
        didSet { defaults.set(isWanted, forKey: Keys.wanted) }
    }

    /// Notifications are on: wanted, and allowed in Settings.
    public var isOn: Bool { isWanted && authorization == .authorized }

    @ObservationIgnored private let system: NotificationSystem
    @ObservationIgnored private let registry: DeviceRegistry
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let promptDelay: TimeInterval

    private enum Keys {
        static let wanted = "newMixAlerts.wanted"
        static let offered = "newMixAlerts.offered"
        static let listened = "newMixAlerts.listened"
        static let registeredToken = "newMixAlerts.registeredToken"
    }

    public init(
        system: NotificationSystem,
        registry: DeviceRegistry,
        defaults: UserDefaults = .standard,
        promptDelay: TimeInterval = NewMixAlerts.defaultPromptDelay
    ) {
        self.system = system
        self.registry = registry
        self.defaults = defaults
        self.promptDelay = promptDelay
        isWanted = defaults.bool(forKey: Keys.wanted)
    }

    /// The token the server has, so it can be removed or replaced
    private var registeredToken: Data? {
        get { defaults.data(forKey: Keys.registeredToken) }
        set { defaults.set(newValue, forKey: Keys.registeredToken) }
    }

    private var hasOffered: Bool {
        get { defaults.bool(forKey: Keys.offered) }
        set { defaults.set(newValue, forKey: Keys.offered) }
    }

    /// At launch and on returning to the app: catches up with changes in Settings, and
    /// refreshes the token (Apple recommends asking for it every launch).
    public func refresh() async {
        authorization = await system.authorization()
        if isOn {
            system.registerForRemoteNotifications()
        } else {
            await forgetToken()
        }
        updatePrompt()
    }

    /// Counts time spent listening, while a mix plays.
    public func recordListening(_ seconds: TimeInterval) {
        guard !hasOffered else { return }
        defaults.set(defaults.double(forKey: Keys.listened) + seconds, forKey: Keys.listened)
        updatePrompt()
    }

    /// "Notify me" in the prompt.
    public func acceptPrompt() async {
        hasOffered = true
        updatePrompt()
        await turnOn()
    }

    /// "Not now": the prompt doesn't come back, but the bell is still there.
    public func dismissPrompt() {
        hasOffered = true
        updatePrompt()
    }

    /// The bell.
    public func toggle() async {
        if isOn { await turnOff() } else { await turnOn() }
    }

    public func turnOn() async {
        hasOffered = true
        updatePrompt()
        authorization = await system.authorization()
        switch authorization {
        case .notDetermined:
            let allowed = await system.requestAuthorization()
            authorization = allowed ? .authorized : .denied
            isWanted = allowed
        case .denied:
            // Only Settings can undo a denial; registration follows when the app returns
            isWanted = true
            system.openSettings()
        case .authorized:
            isWanted = true
        }
        if isOn { system.registerForRemoteNotifications() }
    }

    public func turnOff() async {
        isWanted = false
        await forgetToken()
    }

    /// The APNs token, from the app delegate. Sent to the server whenever it arrives, in case it changed or the server dropped it.
    public func didRegister(token: Data) async {
        guard isOn else { return }
        if let old = registeredToken, old != token {
            try? await registry.unregisterDevice(old)
        }
        do {
            try await registry.registerDevice(token)
            registeredToken = token
        } catch {
            // Tried again next launch
        }
    }

    private func forgetToken() async {
        guard let token = registeredToken else { return }
        do {
            try await registry.unregisterDevice(token)
            registeredToken = nil
        } catch {
            // Kept, so the next refresh tries again
        }
    }

    private func updatePrompt() {
        isPromptVisible = !hasOffered && !isWanted && authorization == .notDetermined
            && defaults.double(forKey: Keys.listened) >= promptDelay
    }
}

/// The custom payload of a new-mix push (`NewMixPayload` in shared/api-types.ts).
public enum NewMixNotification {
    /// The session number to play, if this is a new-mix notification.
    public static func mixNumber(in userInfo: [AnyHashable: Any]) -> Int? {
        userInfo["mix"] as? Int
    }
}
