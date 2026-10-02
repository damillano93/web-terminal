import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        Preferences.registerDefaults()
        return true
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        UISceneConfiguration(name: "Default", sessionRole: connectingSceneSession.role)
    }

    // A window closed for good (swiped away in the iPad app switcher): forget its workspace.
    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
        for s in sceneSessions { WorkspaceStore.forget(scene: s.persistentIdentifier) }
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var terminal: TerminalViewController?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let vc = TerminalViewController(sceneKey: session.persistentIdentifier)
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = vc
        window.makeKeyAndVisible()
        self.window = window
        terminal = vc
        if let item = connectionOptions.shortcutItem { vc.perform(shortcut: item) }
    }

    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem,
                     completionHandler: @escaping (Bool) -> Void) {
        terminal?.perform(shortcut: shortcutItem)
        completionHandler(true)
    }

    func sceneWillEnterForeground(_ scene: UIScene) { terminal?.willEnterForeground() }
    func sceneDidEnterBackground(_ scene: UIScene) { terminal?.didEnterBackground() }
}

/// User settings (iOS Settings → Terminal), backed by Settings.bundle.
enum Preferences {
    static func registerDefaults() {
        UserDefaults.standard.register(defaults: ["lock_enabled": true, "lock_after": 5, "server_url": ""])
    }
    static var lockEnabled: Bool { UserDefaults.standard.bool(forKey: "lock_enabled") }
    static var lockAfterSeconds: TimeInterval { TimeInterval(UserDefaults.standard.integer(forKey: "lock_after") * 60) }
    static var serverURL: URL {
        if let s = UserDefaults.standard.string(forKey: "server_url")?.trimmingCharacters(in: .whitespaces),
           let u = URL(string: s), u.scheme == "https" || u.scheme == "http", u.host != nil { return u }
        let raw = Bundle.main.object(forInfoDictionaryKey: "WTServerURL") as? String
        return URL(string: raw ?? "") ?? URL(string: "https://terminal.example.com/")!
    }
}

/// Which web-terminal workspace (?w=…) each window shows, so tabs come back
/// after iOS kills the app instead of starting a fresh workspace every launch.
enum WorkspaceStore {
    private static let lastKey = "ws.last"
    private static func key(_ scene: String) -> String { "ws.scene.\(scene)" }

    static func workspace(scene: String, isOnlyWindow: Bool) -> String? {
        if let w = UserDefaults.standard.string(forKey: key(scene)) { return w }
        // A brand-new window: the first one resumes the last workspace, extra
        // iPad windows start their own.
        return isOnlyWindow ? UserDefaults.standard.string(forKey: lastKey) : nil
    }
    static func remember(_ id: String, scene: String) {
        UserDefaults.standard.set(id, forKey: key(scene))
        UserDefaults.standard.set(id, forKey: lastKey)
    }
    static func forget(scene: String) { UserDefaults.standard.removeObject(forKey: key(scene)) }
}
