import MixKit
import UIKit
import UserNotifications

/// New-mix notifications through UserNotifications and APNs.
@MainActor
final class SystemNotifications: NotificationSystem {
    func authorization() async -> NewMixAlerts.Authorization {
        switch await UNUserNotificationCenter.current().notificationSettings().authorizationStatus {
        case .notDetermined: .notDetermined
        case .denied: .denied
        default: .authorized
        }
    }

    func requestAuthorization() async -> Bool {
        (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    func registerForRemoteNotifications() {
        UIApplication.shared.registerForRemoteNotifications()
    }

    func openSettings() {
        guard let url = URL(string: UIApplication.openNotificationSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }
}

/// UI tests: allows notifications without the system alert, and hands back a made-up token.
@MainActor
final class UITestNotifications: NotificationSystem {
    weak var alerts: NewMixAlerts?
    private var status = NewMixAlerts.Authorization.notDetermined

    func authorization() async -> NewMixAlerts.Authorization { status }

    func requestAuthorization() async -> Bool {
        status = .authorized
        return true
    }

    func registerForRemoteNotifications() {
        Task { await alerts?.didRegister(token: Data(repeating: 0xAB, count: 32)) }
    }

    func openSettings() {}
}

/// Receives the APNs token and notification taps, which only an app delegate can.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Set before launch finishes, so a tap that launched the app is delivered
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { await AppModel.shared.alerts.didRegister(token: deviceToken) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("Couldn't register for notifications: \(error.localizedDescription)")
    }

    /// Tapped: play that mix.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        guard let number = NewMixNotification.mixNumber(in: response.notification.request.content.userInfo) else { return }
        await AppModel.shared.openMix(number: number)
    }

    /// Shown even while the app is open.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }
}
