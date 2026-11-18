import UIKit
import WebKit
import UserNotifications

/// Full-screen WKWebView on the web-terminal. Over Safari / the PWA it adds: no
/// keyboard bars, iPad keyboard shortcuts, quick reconnect on return, Face ID
/// lock, an expiry warning, home-screen quick actions, native copy/paste
/// (images too) and a haptic bell. It drives the page through `window.wt` and
/// hears from it on the "wtEvent" message handler (see public/app.src.js).
final class TerminalViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private let sceneKey: String
    private var webView: AccessoryFreeWebView!
    private let background = UIColor(red: 0x0d / 255, green: 0x11 / 255, blue: 0x17 / 255, alpha: 1)
    private let lock = LockController()
    private var pageReady = false
    private var pending: [String] = []
    private var workspaceID: String?
    /// The terminal's current selection, as reported by the page.
    private var lastSelection = ""
    /// Whether the page's keyboard focus is in a terminal (reported by the page).
    private var terminalFocused = true
    /// The server address in use (LAN at home, public elsewhere; see ConnectionManager).
    private var currentBase: URL = Preferences.publicURL

    init(sceneKey: String) {
        self.sceneKey = sceneKey
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("not used") }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()   // Cloudflare Access + app cookies persist
        config.allowsInlineMediaPlayback = true
        let ucc = config.userContentController
        ucc.add(WeakScriptHandler(self), name: "wtClipboard")
        ucc.add(WeakScriptHandler(self), name: "wtEvent")
        ucc.addUserScript(WKUserScript(source: "window.__WT_NATIVE__ = { platform: 'ios', version: 3 };",
                                       injectionTime: .atDocumentStart, forMainFrameOnly: true))

        webView = AccessoryFreeWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        webView.isOpaque = false
        webView.backgroundColor = background
        webView.scrollView.backgroundColor = background
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        webView.onPaste = { [weak self] in self?.pasteImagesFromPasteboard() ?? false }
        webView.onControlKey = { [weak self] ch in
            guard let self, self.terminalFocused, let code = Self.controlCode(ch) else { return false }
            self.run("wt.sendInput(\(Self.jsString(String(UnicodeScalar(code)))))")
            return true
        }
        webView.onCopy = { [weak self] in
            guard let self, !self.lastSelection.isEmpty else { return false }
            UIPasteboard.general.string = self.lastSelection
            self.run("wt.copied(\(self.lastSelection.count))")
            return true
        }
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        NotificationCenter.default.addObserver(forName: Notifier.openTab, object: nil, queue: .main) { [weak self] n in
            if let id = n.userInfo?["tabId"] as? Int { self?.openFromNotification(tabId: id, workspace: n.userInfo?["workspace"] as? String) }
        }
        view.backgroundColor = background
        lock.attach(to: view)
        NotificationCenter.default.addObserver(forName: ConnectionManager.networkChanged, object: nil, queue: .main) { [weak self] _ in
            self?.recheckConnection()
        }
        workspaceID = WorkspaceStore.workspace(scene: sceneKey, isOnlyWindow: UIApplication.shared.openSessions.count <= 1)
        // No server yet (first launch of a release build): viewDidAppear asks.
        if !Preferences.needsSetup { connect() }
    }

    /// Pick the address (LAN at home, public elsewhere) and open the workspace.
    private func connect() {
        let workspace = workspaceID
        Task { @MainActor in
            currentBase = await ConnectionManager.shared.chooseBase()
            loadWorkspace(workspace)
        }
    }

    /// Ask which web-terminal to open. Shown by itself on the first launch
    /// when the build carries no server; the answer is saved for good
    /// (Preferences.save) and only asked again from "Cambiar servidor…".
    private func askServer(typed: String? = nil, invalid: Bool = false) {
        guard presentedViewController == nil else { return }
        let first = Preferences.needsSetup
        let intro = first
            ? "Escribe la dirección de tu web-terminal. Se guarda en este equipo y no se vuelve a pedir."
            : "Escribe la dirección del web-terminal al que conectarse."
        let alert = UIAlertController(title: first ? "¿A qué servidor te conectas?" : "Cambiar servidor",
                                      message: invalid ? "Esa dirección no es válida. Ejemplo: terminal.example.com" : intro,
                                      preferredStyle: .alert)
        alert.addTextField { field in
            field.placeholder = "terminal.example.com"
            field.text = typed ?? (first ? nil : Preferences.publicURL.absoluteString)
            field.keyboardType = .URL
            field.autocapitalizationType = .none
            field.autocorrectionType = .no
            field.clearButtonMode = .whileEditing
        }
        if !first { alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel)) }
        let ok = UIAlertAction(title: "Conectar", style: .default) { [weak self, weak alert] _ in
            guard let self else { return }
            let text = alert?.textFields?.first?.text ?? ""
            guard let url = Preferences.serverURL(from: text) else {
                // Next turn of the run loop: this alert is still on its way out.
                return DispatchQueue.main.async { self.askServer(typed: text, invalid: true) }
            }
            Preferences.save(server: url)
            self.connect()
        }
        alert.addAction(ok)
        alert.preferredAction = ok
        present(alert, animated: true)
    }

    /// Back in the app or on a different network: switch between the LAN and
    /// the public address if the right one changed. The page reloads on the same
    /// workspace and reattaches its shells, which live on the server.
    private func recheckConnection() {
        guard !Preferences.needsSetup else { return }
        Task { @MainActor in
            let base = await ConnectionManager.shared.chooseBase()
            if base != currentBase {
                currentBase = base
                loadWorkspace(workspaceID)
            }
        }
    }

    #if targetEnvironment(macCatalyst)
    // Full screen with an auto-hiding menu bar: the window covers the whole
    // screen and the menu bar slides down over the tab bar whenever the
    // pointer nears the top, swallowing clicks on its buttons. Keep that strip
    // free. (With the menu bar always shown, or under a notch, the window
    // already stops below it and nothing is reserved.)
    private var topReserve: CGFloat = -1

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let reserve = Self.fullScreenMenuBarReserve(for: view.window)
        guard reserve != topReserve else { return }
        topReserve = reserve
        run("wt.setTopInset(\(Int(reserve)))")
    }

    static func fullScreenMenuBarReserve(for window: UIWindow?) -> CGFloat {
        guard let window, let screen = window.windowScene?.screen else { return 0 }
        let w = window.bounds.size, s = screen.bounds.size
        guard abs(w.width - s.width) < 1, abs(w.height - s.height) < 1 else { return 0 }
        var height: CGFloat = 24
        if let app = NSClassFromString("NSApplication") as? NSObject.Type,
           let shared = app.value(forKey: "sharedApplication") as? NSObject,
           let menu = shared.value(forKey: "mainMenu") as? NSObject,
           let h = menu.value(forKey: "menuBarHeight") as? NSNumber, h.doubleValue > 0 {
            height = CGFloat(h.doubleValue)
        }
        return height
    }
    #endif

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        #if targetEnvironment(macCatalyst)
        // A plain dark window: no title text or toolbar over the tab bar.
        if let scene = view.window?.windowScene {
            scene.titlebar?.titleVisibility = .hidden
            scene.titlebar?.toolbar = nil
            scene.sizeRestrictions?.minimumSize = CGSize(width: 520, height: 320)
        }
        #endif
        if Preferences.needsSetup { askServer(); return }
        lock.lockOnLaunchIfNeeded()
        ExpiryWatch.check(from: self)
    }

    private func loadWorkspace(_ id: String?) {
        var comps = URLComponents(url: currentBase, resolvingAgainstBaseURL: false)!
        if let id { comps.queryItems = [URLQueryItem(name: "w", value: id)] }
        pageReady = false
        webView.load(URLRequest(url: comps.url!))
    }

    // MARK: Lifecycle (from SceneDelegate)

    func willEnterForeground() {
        lock.willEnterForeground()
        run("wt.reconnect()")
        recheckConnection()
        ExpiryWatch.check(from: self)
    }

    func didEnterBackground() { lock.didEnterBackground() }

    // MARK: Talking to the page

    /// Runs JS against window.wt, queued until the page has booted.
    private func run(_ js: String) {
        guard pageReady else { pending.append(js); return }
        webView.evaluateJavaScript("window.wt && (\(js))", completionHandler: nil)
    }

    /// Control+a…z → 0x01…0x1a; Control+[ \\ ] → ESC, FS, GS.
    private static func controlCode(_ ch: Character) -> UInt8? {
        guard let a = ch.asciiValue else { return nil }
        switch a {
        case 97...122: return a - 96
        case 91: return 27
        case 92: return 28
        case 93: return 29
        default: return nil
        }
    }

    private static func jsString(_ s: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: [s])
        let arr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\"]"
        return String(arr.dropFirst().dropLast())
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "wtClipboard", let text = message.body as? String {
            UIPasteboard.general.string = text
            return
        }
        guard message.name == "wtEvent", let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }
        switch type {
        case "workspace":
            if let id = body["id"] as? String {
                workspaceID = id
                WorkspaceStore.remember(id, scene: sceneKey)
            }
            pageReady = true
            #if targetEnvironment(macCatalyst)
            topReserve = -1; view.setNeedsLayout()   // a fresh page needs the inset again
            #endif
            let queued = pending; pending = []
            queued.forEach(run)
            // On the public address: learn the LAN key (once), then see whether
            // we are at home and could go direct.
            if currentBase == Preferences.publicURL {
                let store = webView.configuration.websiteDataStore.httpCookieStore
                Task { @MainActor in
                    await ConnectionManager.shared.ensureKey(cookies: store)
                    recheckConnection()
                }
            }
        case "tabs":
            QuickActions.update(workspace: body["workspace"] as? String,
                                tabs: (body["tabs"] as? [[String: Any]]) ?? [])
        case "bell":
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case "notify":
            Notifier.post(title: body["title"] as? String ?? "Terminal", body: body["body"] as? String ?? "",
                          tabId: body["tabId"] as? Int, workspace: body["workspace"] as? String)
        case "focus":
            terminalFocused = (body["terminal"] as? Bool) ?? true
        case "selection":
            lastSelection = body["text"] as? String ?? ""
        case "open":
            if let str = body["url"] as? String, let url = URL(string: str),
               ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
                UIApplication.shared.open(url)
            }
        case "copy":
            if let text = body["text"] as? String { UIPasteboard.general.string = text }
        case "paste":
            let wantImage = (body["image"] as? Bool) ?? false
            let pb = UIPasteboard.general
            if wantImage, let image = pb.image ?? pb.images?.first {
                pasteImage(image)
            } else if pasteImagesFromPasteboard() {
                break
            } else if let text = pb.string {
                run("wt.pasteText(\(Self.jsString(text)))")
            }
        default: break
        }
    }

    /// Decide whether a paste is images (upload them) or text (let WebKit paste):
    ///  - image files copied in the Finder → upload the files;
    ///  - an image with nothing else, or with only its own URL (a browser's
    ///    "Copy Image") → upload the image;
    ///  - real text → text, even if an image came along (rich-text copies).
    /// Returns true when it took the paste.
    func pasteImagesFromPasteboard() -> Bool {
        let pb = UIPasteboard.general
        let imageExts: [String: String] = ["png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                                           "gif": "image/gif", "webp": "image/webp", "heic": "image/heic", "heif": "image/heic"]
        if let files = pb.urls?.filter({ $0.isFileURL }), !files.isEmpty {
            let images = files.filter { imageExts[$0.pathExtension.lowercased()] != nil || $0.pathExtension.lowercased() == "tiff" }
            guard !images.isEmpty else { return false }
            for url in images {
                let ext = url.pathExtension.lowercased()
                if let mime = imageExts[ext], let data = try? Data(contentsOf: url) {
                    pasteImageData(data, mime: mime)
                } else if let data = try? Data(contentsOf: url), let img = UIImage(data: data) {
                    pasteImage(img)
                }
            }
            return true
        }
        guard pb.hasImages, let image = pb.image ?? pb.images?.first else { return false }
        let text = pb.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let textIsOnlyAURL = text.isEmpty || (URL(string: text)?.scheme.map { ["http", "https", "file", "data"].contains($0) } ?? false)
        guard textIsOnlyAURL else { return false }
        pasteImage(image)
        return true
    }

    private func pasteImageData(_ data: Data, mime: String) {
        run("wt.pasteImage('\(data.base64EncodedString())', '\(mime)')")
    }

    private func pasteImage(_ image: UIImage) {
        // PNG keeps screenshots crisp; fall back to JPEG for big photos.
        var data = image.pngData()
        var mime = "image/png"
        if (data?.count ?? 0) > 8_000_000 { data = image.jpegData(compressionQuality: 0.85); mime = "image/jpeg" }
        guard let b64 = data?.base64EncodedString() else { return }
        run("wt.pasteImage('\(b64)', '\(mime)')")
    }

    /// A tapped notification: show its tab if it belongs to this window.
    func openFromNotification(tabId: Int, workspace: String?) {
        guard workspace == nil || workspace == workspaceID else { return }
        run("wt.switchTabId(\(tabId))")
    }

    // MARK: Quick actions

    func perform(shortcut: UIApplicationShortcutItem) {
        switch shortcut.type {
        case QuickActions.newTab:
            run("wt.newTab()")
        case QuickActions.openTab:
            guard let id = shortcut.userInfo?["id"] as? Int else { return }
            let ws = shortcut.userInfo?["workspace"] as? String
            if let ws, ws != workspaceID { loadWorkspace(ws) }
            run("wt.switchTabId(\(id))")
        default: break
        }
    }

    // MARK: Keyboard commands. On iPad they show in the hold-⌘ overlay; on the
    // Mac (Catalyst) the same list becomes the "Terminal" menu, built in
    // AppDelegate.buildMenu, so it is only returned here on iOS.

    static func commands(mac: Bool) -> [UIKeyCommand] {
        func key(_ input: String, _ mods: UIKeyModifierFlags, _ title: String, _ action: Selector) -> UIKeyCommand {
            let c = UIKeyCommand(title: title, action: action, input: input, modifierFlags: mods)
            c.wantsPriorityOverSystemBehavior = true
            return c
        }
        var cmds: [UIKeyCommand] = [
            key("t", .command, "Nueva tab", #selector(newTab)),
            key("w", .command, "Cerrar tab", #selector(closeTab)),
            key("d", .command, "Dividir a la derecha", #selector(splitRight)),
            key("d", [.command, .shift], "Dividir hacia abajo", #selector(splitDown)),
            key("f", .command, "Buscar", #selector(findInTerminal)),
            key("k", .command, "Limpiar", #selector(clear)),
            key("p", .command, "Comandos", #selector(palette)),
            key(UIKeyCommand.inputUpArrow, .command, "Comando anterior", #selector(promptUp)),
            key(UIKeyCommand.inputDownArrow, .command, "Comando siguiente", #selector(promptDown)),
            key("r", [.command, .shift], "Recargar", #selector(reload)),
            key(",", [.command, .shift], "Cambiar servidor…", #selector(changeServer)),
        ]
        // The Mac has File → New Window (⌘N) already.
        if !mac { cmds.append(key("n", [.command, .shift], "Nueva ventana", #selector(newWindow))) }
        // Same action for all nine: the menu bar needs each told apart, which the
        // propertyList (the tab number) does.
        for n in 1...9 {
            let c = UIKeyCommand(title: n == 9 ? "Última tab" : "Tab \(n)", action: #selector(switchTab(_:)),
                                 input: "\(n)", modifierFlags: .command, propertyList: n)
            c.wantsPriorityOverSystemBehavior = true
            cmds.append(c)
        }
        return cmds
    }

    override var keyCommands: [UIKeyCommand]? {
        #if targetEnvironment(macCatalyst)
        return nil
        #else
        return Self.commands(mac: false)
        #endif
    }

    @objc func newTab() { run("wt.newTab()") }
    @objc func closeTab() { run("wt.closeTab()") }
    @objc func splitRight() { run("wt.split('right')") }
    @objc func splitDown() { run("wt.split('down')") }
    @objc func findInTerminal() { run("wt.find()") }
    @objc func clear() { run("wt.clear()") }
    @objc func reload() { pageReady = false; webView.reload() }
    @objc func newWindow() { openNewWindow() }
    @objc func changeServer() { askServer() }
    @objc func palette() { run("wt.palette()") }
    @objc func promptUp() { run("wt.jumpPrompt(-1)") }
    @objc func promptDown() { run("wt.jumpPrompt(1)") }
    @objc func switchTab(_ cmd: UIKeyCommand) {
        if let n = (cmd.propertyList as? Int) ?? Int(cmd.input ?? "") { run("wt.switchTab(\(n))") }
    }

    private func openNewWindow() {
        if UIApplication.shared.supportsMultipleScenes {
            UIApplication.shared.requestSceneSessionActivation(nil, userActivity: nil, options: nil, errorHandler: nil)
        } else {
            run("wt.newTab()")
        }
    }

    // MARK: Navigation: stay on the terminal and its login; everything else opens in Safari.

    private func isInternal(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return true }   // about:blank, blob:, data:
        let known = [currentBase, Preferences.publicURL, Preferences.lanURL, Preferences.overrideURL]
        if known.contains(where: { $0?.host?.lowercased() == host }) { return true }
        return host.hasSuffix(".cloudflareaccess.com")
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.allow) }
        if action.targetFrame?.isMainFrame == false || isInternal(url) {
            if action.targetFrame?.isMainFrame == true { pageReady = false }
            decisionHandler(.allow)
        } else {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }
    }

    // window.open: links (Cmd/Ctrl+click) go to Safari; the menu's "New window"
    // (a bare "/") opens a second iPad window.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let url = action.request.url else { return nil }
        if isInternal(url) {
            let hasWorkspace = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?.contains { $0.name == "w" } ?? false
            if hasWorkspace { webView.load(URLRequest(url: url)) } else { openNewWindow() }
        } else {
            UIApplication.shared.open(url)
        }
        return nil
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { showRetry(error) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { showRetry(error) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { pageReady = false; webView.reload() }

    private func showRetry(_ error: Error) {
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCancelled { return }
        let alert = UIAlertController(title: "No se pudo conectar",
                                      message: error.localizedDescription, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Reintentar", style: .default) { [weak self] _ in
            guard let self else { return }
            self.loadWorkspace(self.workspaceID)
        })
        // A mistyped server would otherwise leave nothing but "Reintentar".
        alert.addAction(UIAlertAction(title: "Cambiar servidor…", style: .default) { [weak self] _ in
            DispatchQueue.main.async { self?.askServer() }
        })
        present(alert, animated: true)
    }

    // JS alert/confirm/prompt (tab rename uses prompt()).
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        a.addTextField { $0.text = defaultText }
        a.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
        present(a, animated: true)
    }
}

/// WKUserContentController retains its handlers; this breaks the cycle.
private final class WeakScriptHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        target?.userContentController(c, didReceive: m)
    }
}

/// Home-screen quick actions: "Nueva tab" plus the first tabs by name.
enum QuickActions {
    static let newTab = "webterminal.newtab"
    static let openTab = "webterminal.tab"

    static func update(workspace: String?, tabs: [[String: Any]]) {
        var items = [UIApplicationShortcutItem(type: newTab, localizedTitle: "Nueva tab", localizedSubtitle: nil,
                                               icon: UIApplicationShortcutIcon(systemImageName: "plus"), userInfo: nil)]
        for t in tabs.prefix(3) {
            guard let id = t["id"] as? Int, let name = t["name"] as? String else { continue }
            var info: [String: NSSecureCoding] = ["id": NSNumber(value: id)]
            if let workspace { info["workspace"] = workspace as NSString }
            items.append(UIApplicationShortcutItem(type: openTab, localizedTitle: name, localizedSubtitle: nil,
                                                   icon: UIApplicationShortcutIcon(systemImageName: "terminal"),
                                                   userInfo: info))
        }
        UIApplication.shared.shortcutItems = items
    }
}

/// Local notifications for terminal events (a long command finished, Claude
/// Code asking for attention, a bell in another tab). The page decides when
/// one is due; this only shows it, also while the app is in front.
final class Notifier: NSObject, UNUserNotificationCenterDelegate {
    static let shared = Notifier()
    static let openTab = Notification.Name("WTOpenTab")
    private static var asked = false

    static func post(title: String, body: String, tabId: Int?, workspace: String?) {
        let center = UNUserNotificationCenter.current()
        center.delegate = shared
        let send = {
            let content = UNMutableNotificationContent()
            content.title = title
            if !body.isEmpty { content.body = body }
            content.sound = .default
            var info: [String: Any] = [:]
            if let tabId { info["tabId"] = tabId }
            if let workspace { info["workspace"] = workspace }
            content.userInfo = info
            center.add(UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil))
        }
        if asked { send(); return }
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            asked = true
            if granted { send() }
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler done: @escaping (UNNotificationPresentationOptions) -> Void) {
        done([.banner, .sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler done: @escaping () -> Void) {
        let info = response.notification.request.content.userInfo
        NotificationCenter.default.post(name: Self.openTab, object: nil, userInfo: info)
        done()
    }
}

