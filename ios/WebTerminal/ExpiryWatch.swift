import UIKit
import UserNotifications

/// Apps signed with a free Apple ID stop opening 7 days after install. Read the
/// expiry from the embedded provisioning profile, warn in-app when it is close,
/// and schedule a local notification for the day before.
enum ExpiryWatch {
    static func expiryDate() -> Date? {
        guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url),
              let start = data.range(of: Data("<?xml".utf8)),
              let end = data.range(of: Data("</plist>".utf8)) else { return nil }
        let plist = data.subdata(in: start.lowerBound..<end.upperBound)
        let dict = try? PropertyListSerialization.propertyList(from: plist, format: nil) as? [String: Any]
        return dict?["ExpirationDate"] as? Date
    }

    static func check(from vc: UIViewController) {
        guard let expiry = expiryDate() else { return }
        scheduleReminder(expiry)
        let left = expiry.timeIntervalSinceNow
        guard left < 36 * 3600 else { return }
        // At most one in-app warning every 12 hours.
        let last = UserDefaults.standard.double(forKey: "expiry.warnedAt")
        guard Date().timeIntervalSince1970 - last > 12 * 3600 else { return }
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "expiry.warnedAt")

        let when = DateFormatter.localizedString(from: expiry, dateStyle: .medium, timeStyle: .short)
        let alert = UIAlertController(
            title: left > 0 ? "La app caduca pronto" : "La app ha caducado",
            message: "Caduca el \(when). Conecta el dispositivo al Mac y ejecuta scripts/ios-build.sh para renovarla.",
            preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Entendido", style: .default))
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            if vc.presentedViewController == nil { vc.present(alert, animated: true) }
        }
    }

    private static func scheduleReminder(_ expiry: Date) {
        let fireAt = expiry.addingTimeInterval(-24 * 3600)
        guard fireAt > Date() else { return }
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            guard granted else { return }
            let content = UNMutableNotificationContent()
            content.title = "Terminal caduca mañana"
            content.body = "Conecta el dispositivo al Mac y ejecuta scripts/ios-build.sh."
            let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: fireAt)
            let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
            center.add(UNNotificationRequest(identifier: "expiry", content: content, trigger: trigger))
        }
    }
}
